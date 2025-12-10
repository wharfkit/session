import type {ChainDefinitionType, Fetch} from '@wharfkit/common'
import type {Contract} from '@wharfkit/contract'

import zlib from 'pako'
import {
    APIClient,
    Checksum256,
    Checksum256Type,
    FetchProvider,
    Name,
    NameType,
    PermissionLevel,
    PermissionLevelType,
    Serializer,
    Signature,
    SignedTransaction,
    Transaction,
    TransactionType,
} from '@wharfkit/antelope'
import {ChainDefinition} from '@wharfkit/common'
import {
    ChainId,
    RequestDataV2,
    RequestDataV3,
    RequestSignature,
    ResolvedSigningRequest,
    SigningRequest,
} from '@wharfkit/signing-request'

import {ABICache, ABICacheInterface} from '@wharfkit/abicache'
import {
    AbstractTransactPlugin,
    BaseTransactPlugin,
    TransactABIDef,
    TransactArgs,
    TransactContext,
    TransactOptions,
    TransactPlugin,
    TransactPluginsOptions,
    TransactResult,
    TransactResultReturnValue,
    TransactRevisions,
} from './transact'
import {SessionStorage} from './storage'
import {
    actionMatchesPermission,
    extractActions,
    getFetch,
    getPluginTranslations,
    rewriteAuthorizations,
} from './utils'
import {SerializedWalletPlugin, WalletPlugin, WalletPluginSignResponse} from './wallet'
import {UserInterface} from './ui'
import {SessionKeyManager} from './sessionkey/manager'
import {
    isSessionKeyWallet,
    SessionKeyMismatch,
    SessionKeySetupResult,
    SessionKeyStatus,
    SessionKeyWalletInterface,
} from './sessionkey/types'

/**
 * Arguments required to create a new [[Session]].
 */
export interface SessionArgs {
    actor?: NameType
    chain: ChainDefinitionType
    permission?: NameType
    permissionLevel?: PermissionLevelType | string
    walletPlugin: WalletPlugin
}

/**
 * Options for creating a new [[Session]].
 */
export interface SessionOptions {
    abis?: TransactABIDef[]
    abiCache?: ABICacheInterface
    allowModify?: boolean
    appName?: NameType
    broadcast?: boolean
    contracts?: Contract[]
    expireSeconds?: number
    fetch?: Fetch
    storage?: SessionStorage
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    ui?: UserInterface
    sessionKeyManager?: SessionKeyManager
    onPersist?: (session: Session) => Promise<void>
}

export interface SerializedSession {
    actor: NameType
    chain: Checksum256Type
    default?: boolean
    permission: NameType
    walletPlugin: SerializedWalletPlugin
    data?: Record<string, any>
}

/**
 * A representation of a session to interact with a specific blockchain account.
 */
export class Session {
    readonly appName?: string
    readonly abis: TransactABIDef[] = []
    readonly abiCache: ABICacheInterface
    readonly allowModify: boolean = true
    readonly broadcast: boolean = true
    readonly chain: ChainDefinition
    readonly expireSeconds: number = 120
    readonly fetch: Fetch
    readonly permissionLevel: PermissionLevel
    readonly storage?: SessionStorage
    readonly transactPlugins: TransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly ui?: UserInterface
    readonly sessionKeyManager?: SessionKeyManager
    readonly onPersist?: (session: Session) => Promise<void>
    private _walletPlugin: WalletPlugin
    private _data: Record<string, any> = {}

    /**
     * Get the wallet plugin for this session.
     */
    get walletPlugin(): WalletPlugin {
        return this._walletPlugin
    }

    /**
     * Check if two sessions match by comparing chain, actor, and permission.
     *
     * @param s1 Session or SerializedSession
     * @param s2 Session or SerializedSession
     * @returns boolean indicating if the sessions match
     */
    static matches(s1: SerializedSession | Session, s2: SerializedSession | Session): boolean {
        const ser1 = s1 instanceof Session ? s1.serialize() : s1
        const ser2 = s2 instanceof Session ? s2.serialize() : s2

        return (
            Checksum256.from(ser1.chain).equals(Checksum256.from(ser2.chain)) &&
            Name.from(ser1.actor).equals(Name.from(ser2.actor)) &&
            Name.from(ser1.permission).equals(Name.from(ser2.permission))
        )
    }

    /**
     * Get the data stored in this session instance.
     */
    get data(): Record<string, any> {
        return this._data
    }

    /**
     * Set the data stored in this session instance.
     */
    set data(data: Record<string, any>) {
        this._data = data
    }

    /**
     * The constructor of the `Session` class.
     *
     * @param options SessionOptions
     */
    constructor(args: SessionArgs, options: SessionOptions = {}) {
        // Set the ChainDefinition for this session
        this.chain = ChainDefinition.from(args.chain)

        // Determine the permission level to use for this session
        if (args.permissionLevel) {
            this.permissionLevel = PermissionLevel.from(args.permissionLevel)
        } else if (args.actor && args.permission) {
            this.permissionLevel = PermissionLevel.from(`${args.actor}@${args.permission}`)
        } else {
            throw new Error(
                'Either a permissionLevel or actor/permission must be provided when creating a new Session.'
            )
        }

        // Set the WalletPlugin for this session
        this._walletPlugin = args.walletPlugin

        // Handle all the optional values provided
        if (options.appName) {
            this.appName = String(options.appName)
        }
        if (options.abis) {
            this.abis = [...options.abis]
        }
        // Extract any ABIs from the Contract instances provided
        if (options.contracts) {
            this.abis.push(...options.contracts.map((c) => ({account: c.account, abi: c.abi})))
        }
        if (options.allowModify !== undefined) {
            this.allowModify = options.allowModify
        }
        if (options.broadcast !== undefined) {
            this.broadcast = options.broadcast
        }
        if (options.expireSeconds) {
            this.expireSeconds = options.expireSeconds
        }
        if (options.fetch) {
            this.fetch = options.fetch
        } else {
            this.fetch = getFetch(options)
        }
        if (options.storage) {
            this.storage = options.storage
        }
        if (options.transactPlugins) {
            this.transactPlugins = options.transactPlugins
        } else {
            this.transactPlugins = [new BaseTransactPlugin()]
        }
        if (options.transactPluginsOptions) {
            this.transactPluginsOptions = options.transactPluginsOptions
        }
        if (options.abiCache) {
            this.abiCache = options.abiCache
        } else {
            this.abiCache = new ABICache(this.client)
        }
        if (options.ui) {
            this.ui = options.ui
        }
        if (options.sessionKeyManager) {
            this.sessionKeyManager = options.sessionKeyManager
        }
        if (options.onPersist) {
            this.onPersist = options.onPersist
        }
    }

    /**
     * Returns the name of the actor that is being used for this session.
     */
    get actor(): Name {
        return this.permissionLevel.actor
    }

    /**
     * Returns the name of the permission that is being used for this session.
     */
    get permission(): Name {
        return this.permissionLevel.permission
    }

    /**
     * Returns an APIClient configured for this session.
     */
    get client(): APIClient {
        return new APIClient({provider: new FetchProvider(this.chain.url, {fetch: this.fetch})})
    }

    /**
     * Alters the session config to change the API endpoint in use
     */
    setEndpoint(url: string) {
        this.chain.url = url
    }

    /**
     * Templates in any missing fields from partial transactions.
     *
     * @param args TransactArgs
     * @returns TransactArgs
     */
    upgradeTransaction(args: TransactArgs): TransactArgs {
        // eosjs transact compat: upgrade to transaction if args have any header fields
        const anyArgs = args as any
        if (
            args.actions &&
            (anyArgs.expiration ||
                anyArgs.ref_block_num ||
                anyArgs.ref_block_prefix ||
                anyArgs.max_net_usage_words ||
                anyArgs.max_cpu_usage_ms ||
                anyArgs.delay_sec)
        ) {
            return (args = {
                transaction: {
                    expiration: '1970-01-01T00:00:00',
                    ref_block_num: 0,
                    ref_block_prefix: 0,
                    max_net_usage_words: 0,
                    max_cpu_usage_ms: 0,
                    delay_sec: 0,
                    ...anyArgs,
                },
            })
        }
        // if any context free data is provided, upgrade to a transaction and include them
        if (args.context_free_actions || args.context_free_data) {
            const actions = args.actions || [args.action]
            delete args.action
            return {
                transaction: {
                    expiration: '1970-01-01T00:00:00',
                    ref_block_num: 0,
                    ref_block_prefix: 0,
                    max_net_usage_words: 0,
                    max_cpu_usage_ms: 0,
                    delay_sec: 0,
                    context_free_actions: [],
                    context_free_data: [],
                    actions,
                    ...anyArgs,
                },
            }
        }
        return args
    }

    /**
     * Lifted from @wharfkit/antelope-signing-request.
     *
     * Copy of: https://github.com/greymass/@wharfkit/signing-request/blob/6fc84b2355577d6461676bff417c76e4f6f2f5c3/src/signing-request.ts#L305
     *
     * TODO: Remove. This will no longer be needed once the `clone` functionality in ESR is updated
     */
    /* istanbul ignore next */
    private storageType(version: number): typeof RequestDataV3 | typeof RequestDataV2 {
        return version === 2 ? RequestDataV2 : RequestDataV3
    }

    /**
     * Create a clone of the given SigningRequest
     *
     * Overrides: https://github.com/greymass/@wharfkit/signing-request/blob/6fc84b2355577d6461676bff417c76e4f6f2f5c3/src/signing-request.ts#L1112
     *
     * @param {SigningRequest} request The SigningRequest to clone
     * @param {ABICacheInterface} abiCache The ABICacheInterface to use for the clone
     * @returns Returns a cloned SigningRequest with updated abiCache and zlib
     */
    /* istanbul ignore next */
    cloneRequest(request: SigningRequest, abiCache: ABICacheInterface): SigningRequest {
        // Lifted from @wharfkit/antelope-signing-request method `clone()`
        // This was done to modify the zlib and abiProvider
        // TODO: Modify ESR library to expose this `clone()` functionality
        // TODO: This if statement should potentially just be:
        //          request = args.request.clone(abiProvider, zlib)
        let signature: RequestSignature | undefined
        if (request.signature) {
            signature = RequestSignature.from(JSON.parse(JSON.stringify(request.signature)))
        }
        const RequestData = this.storageType(request.version)
        const data = RequestData.from(JSON.parse(JSON.stringify(request.data)))
        return new SigningRequest(request.version, data, zlib, abiCache, signature)
    }

    /**
     * Convert any provided form of TransactArgs to a SigningRequest
     *
     * @param {TransactArgs} args
     * @param {ABICacheInterface} abiCache
     * @returns Returns a SigningRequest
     */
    async createRequest(args: TransactArgs, abiCache: ABICacheInterface): Promise<SigningRequest> {
        let request: SigningRequest
        const options = {
            abiProvider: abiCache,
            zlib,
        }
        if (args.request && args.request instanceof SigningRequest) {
            request = this.cloneRequest(args.request, abiCache)
        } else if (args.request) {
            request = SigningRequest.from(args.request, options)
        } else {
            args = this.upgradeTransaction(args)
            request = await SigningRequest.create(
                {
                    ...args,
                    chainId: this.chain.id,
                },
                options
            )
        }
        // Always set the broadcast flag to false on signing requests, Wharf needs to do it
        request.setBroadcast(false)
        return request
    }

    /**
     * Update a SigningRequest, ensuring its old metadata is retained.
     *
     * @param {SigningRequest} previous
     * @param {SigningRequest} modified
     * @param abiCache
     * @returns
     */
    async updateRequest(
        previous: SigningRequest,
        modified: SigningRequest,
        abiCache: ABICacheInterface
    ): Promise<SigningRequest> {
        const updatedRequest: SigningRequest = this.cloneRequest(modified, abiCache)
        const info = updatedRequest.getRawInfo()
        // Take all the metadata from the previous and set it on the modified request.
        // This will preserve the metadata as it is modified by various plugins.
        previous.data.info.forEach((metadata) => {
            if (info[metadata.key]) {
                // eslint-disable-next-line no-console -- warn the developer since this may be unintentional
                console.warn(
                    `During an updateRequest call, the previous request had already set the ` +
                        `metadata key of "${metadata.key}" which will not be overwritten.`
                )
            }
            updatedRequest.setRawInfoKey(metadata.key, metadata.value)
        })
        return updatedRequest
    }

    /**
     * Perform a transaction using this session.
     *
     * @param {TransactArgs} args
     * @param {TransactOptions} options
     * @returns {TransactResult} The status and data gathered during the operation.
     * @mermaid - Transaction sequence diagram
     * flowchart LR
     *   A((Transact)) --> B{{"Hook(s): beforeSign"}}
     *   B --> C[Wallet Plugin]
     *   C --> D{{"Hook(s): afterSign"}}
     *   D --> E[Broadcast Plugin]
     *   E --> F{{"Hook(s): afterBroadcast"}}
     *   F --> G[TransactResult]
     */
    async transact(args: TransactArgs, options?: TransactOptions): Promise<TransactResult> {
        // Check if this transaction will be signed by session key (declared outside try for finally block)
        const willUseSessionKey = this.willUseSessionKey(args)

        // Save original minimal state to restore later
        let originalMinimalState: boolean | undefined

        try {
            // The number of seconds before this transaction expires
            const expireSeconds =
                options && options.expireSeconds ? options.expireSeconds : this.expireSeconds

            // Whether or not the request should be broadcast during the transact call
            const willBroadcast =
                options && typeof options.broadcast !== 'undefined'
                    ? options.broadcast
                    : this.broadcast

            // The abi provider to use for this transaction, falling back to the session instance
            const abiCache = this.getMergedAbiCache(args, options)

            // The TransactPlugins to use for this transaction, falling back to the session instance
            const transactPlugins = options?.transactPlugins || this.transactPlugins
            const transactPluginsOptions =
                options?.transactPluginsOptions || this.transactPluginsOptions

            // A flag to determine whether or not the request can be modified by the beforeSign hooks or wallet plugins
            let allowModify =
                options && typeof options.allowModify !== 'undefined'
                    ? options.allowModify
                    : this.allowModify

            // Rewrite authorizations for session key if applicable
            if (willUseSessionKey) {
                args = this.rewriteAuthorizationsForSessionKey(args)
            }

            // The context object for this transaction
            const context = new TransactContext({
                abiCache,
                appName: this.appName,
                chain: this.chain,
                client: this.client,
                createRequest: (a: TransactArgs) => this.createRequest(a, abiCache),
                fetch: this.fetch,
                permissionLevel: this.permissionLevel,
                storage: this.storage,
                transactPlugins,
                transactPluginsOptions,
                ui: this.ui,
            })

            if (context.ui) {
                // Enable minimal mode for session key transactions
                if (willUseSessionKey && context.ui.setMinimal) {
                    // Save current minimal state to restore later
                    if (context.ui.getMinimal) {
                        originalMinimalState = context.ui.getMinimal()
                    }
                    context.ui.setMinimal(true)
                }
                // Notify the UI that a transaction is about to begin
                await context.ui.onTransact()
                // Merge in any new localization strings from the plugins
                for (const translation of transactPlugins.map((transactPlugin) =>
                    getPluginTranslations(transactPlugin)
                )) {
                    context.ui.addTranslations(translation)
                }
            }

            // Process incoming TransactArgs and convert to a SigningRequest
            let request: SigningRequest = await this.createRequest(args, abiCache)

            // Create TransactResult to eventually respond to this call with
            const result: TransactResult = {
                chain: this.chain,
                request,
                resolved: undefined,
                returns: [],
                revisions: new TransactRevisions(request),
                signatures: [],
                signer: this.permissionLevel,
                transaction: undefined,
            }

            // Call the `beforeSign` hooks that were registered by the TransactPlugins
            for (const hook of context.hooks.beforeSign) {
                // Get the response of the hook by passing a cloned request.
                const response = await hook(request.clone(), context)

                if (response) {
                    // Save revision history for developers to debug modifications to requests.
                    result.revisions.addRevision(response, String(hook), allowModify)

                    // If modification is allowed, change the current request.
                    if (allowModify) {
                        request = await this.updateRequest(request, response.request, abiCache)
                    }

                    if (response.signatures) {
                        // If signatures were returned, append them
                        result.signatures = [...result.signatures, ...response.signatures]
                        // Disable any further modifications to the request if the request was signed
                        allowModify = false
                    }
                }
            }

            // Resolve the final SigningRequest and assign it to the TransactResult
            result.request = request
            result.resolved = await context.resolve(request, expireSeconds)
            result.transaction = result.resolved.resolvedTransaction

            // Merge in any new localization strings from the wallet plugin
            if (context.ui) {
                await context.ui.onSign()
                context.ui.addTranslations(getPluginTranslations(this.walletPlugin))
            }

            // Retrieve the signature(s) and request modifications for this request from the WalletPlugin
            const walletResponse: WalletPluginSignResponse = await this.walletPlugin.sign(
                result.resolved,
                context
            )

            // Merge signatures in to the TransactResult
            result.signatures.push(...walletResponse.signatures)

            // If a ResolvedSigningRequest was returned from the wallet, determine if it was modified, then if it was allowed.
            if (walletResponse.resolved) {
                const {resolved} = walletResponse
                const requestWasModified = !result.resolved.transaction.equals(resolved.transaction)
                if (requestWasModified) {
                    if (allowModify) {
                        result.request = resolved.request
                        result.resolved = resolved
                        result.transaction = resolved.resolvedTransaction
                    } else {
                        throw new Error(
                            `The ${this.walletPlugin.metadata.name} plugin modified the transaction when it was not allowed to.`
                        )
                    }
                }
            }

            // Run the `afterSign` hooks that were registered by the TransactPlugins
            for (const hook of context.hooks.afterSign) await hook(result, context)

            // Notify the UI that the signing operations are complete
            if (context.ui) {
                await context.ui.onSignComplete()
            }

            if (willBroadcast) {
                if (context.ui) {
                    // Notify the UI that broadcast logic will be run against the transaction
                    await context.ui.onBroadcast()
                }

                // Assemble the SignedTransaction to broadcast
                const signed = SignedTransaction.from({
                    ...result.resolved.transaction,
                    signatures: result.signatures,
                })

                // Broadcast the SignedTransaction and save the API response to the TransactResult
                result.response = await context.client.v1.chain.send_transaction(signed)

                // Find and process any return values from the transaction
                if (result.response.processed && result.response.processed.action_traces) {
                    result.returns = await processReturnValues(result.response, abiCache)
                }

                // Run the `afterBroadcast` hooks that were registered by the TransactPlugins
                for (const hook of context.hooks.afterBroadcast) await hook(result, context)

                if (context.ui) {
                    // Notify the UI that the transaction has completed the broadcast logic
                    await context.ui.onBroadcastComplete()
                }
            }

            // Notify the UI that the transaction has completed
            if (context.ui) {
                await context.ui.onTransactComplete()
            }

            // Return the TransactResult to the caller
            return result
        } catch (error: any) {
            // TODO: Improve API response detection and error handling
            // Possible plugin that interprets them?
            if (error.response && error.response.json) {
                const {json} = error.response
                if (json.error && json.error.details) {
                    const e = new Error(json.error.details[0].message)
                    if (this.ui) {
                        await this.ui.onError(e)
                    }
                    throw e
                }
            } else {
                if (this.ui) {
                    await this.ui.onError(error)
                }
            }
            throw new Error(error)
        } finally {
            if (willUseSessionKey && this.ui?.setMinimal) {
                this.ui.setMinimal(originalMinimalState ?? false)
            }
        }
    }

    /**
     * Request a signature for a given transaction.
     *
     * This function will NOT use plugins and will NOT broadcast the transaction.
     *
     * @param {TransactionType} transaction A full transaction-like object
     * @returns {Promise<Signature[]>} The signature(s) for the transaction
     */
    async signTransaction(transaction: TransactionType): Promise<Signature[]> {
        // Create a TransactContext for the WalletPlugin to use
        const context = new TransactContext({
            abiCache: this.abiCache,
            chain: this.chain,
            client: this.client,
            createRequest: (args: TransactArgs) => this.createRequest(args, this.abiCache),
            fetch: this.fetch,
            permissionLevel: this.permissionLevel,
        })
        // Create a request based on the incoming transaction
        const request = await SigningRequest.create(
            {
                transaction,
                chainId: this.chain.id,
            },
            context.esrOptions
        )
        // Always set the broadcast flag to false on signing requests, Wharf needs to do it
        request.setBroadcast(false)
        // Resolve the request since the WalletPlugin expects a ResolvedSigningRequest
        const resolvedRequest = new ResolvedSigningRequest(
            request,
            this.permissionLevel,
            Transaction.from(transaction),
            Serializer.objectify(Transaction.from(transaction)),
            ChainId.from(this.chain.id)
        )
        // Request the signature from the WalletPlugin
        const walletResponse: WalletPluginSignResponse = await this.walletPlugin.sign(
            resolvedRequest,
            context
        )
        // Return the array of signature
        return walletResponse.signatures
    }

    /**
     * Serialize the session to a plain object for storage.
     *
     * @returns SerializedSession object containing chain, actor, permission, and wallet plugin data
     */
    serialize = (): SerializedSession => {
        const serializableData: Record<string, any> = {
            chain: this.chain.id,
            actor: this.permissionLevel.actor,
            permission: this.permissionLevel.permission,
            walletPlugin: {
                id: this.walletPlugin.id,
                data: this.walletPlugin.data,
            },
        }

        // Only include data if it's not empty
        if (Object.keys(this._data).length > 0) {
            serializableData.data = this.data
        }

        return Serializer.objectify(serializableData)
    }

    /**
     * Check if this session has a session key wallet.
     * Type guard that narrows walletPlugin to SessionKeyWalletInterface.
     *
     * @returns True if the wallet plugin is a session key wallet
     */
    hasSessionKey(): this is Session & {walletPlugin: SessionKeyWalletInterface} {
        return isSessionKeyWallet(this.walletPlugin)
    }

    /**
     * Determine if the given transaction will be signed using the session key.
     * Checks if session has a session key and all relevant actions are whitelisted.
     *
     * @param args The transaction arguments to check
     * @returns True if the session key will be used for signing
     */
    willUseSessionKey(args: TransactArgs): boolean {
        if (!this.hasSessionKey()) {
            return false
        }

        const actions = extractActions(args)
        if (actions.length === 0) {
            return false
        }

        const actionsMatchingSession = actions.filter((action) =>
            actionMatchesPermission(action, this.permissionLevel)
        )

        if (actionsMatchingSession.length === 0) {
            return false
        }

        return this.walletPlugin.allActionsWhitelisted(actionsMatchingSession)
    }

    /**
     * Rewrite action authorizations to use the session key permission instead of the primary permission.
     * Only rewrites actions that match the session permission and are whitelisted.
     *
     * @param args The transaction arguments to rewrite
     * @returns Modified TransactArgs with session key permissions, or original args if not applicable
     */
    rewriteAuthorizationsForSessionKey(args: TransactArgs): TransactArgs {
        if (!isSessionKeyWallet(this.walletPlugin)) {
            return args
        }

        const sessionKeyPermission = this.walletPlugin.getPermission()
        const actions = extractActions(args)

        if (actions.length === 0) {
            return args
        }

        const actionsMatchingSession = actions.filter((action) =>
            actionMatchesPermission(action, this.permissionLevel)
        )

        if (actionsMatchingSession.length === 0) {
            return args
        }

        if (!this.walletPlugin.allActionsWhitelisted(actionsMatchingSession)) {
            return args
        }

        return rewriteAuthorizations(args, this.permissionLevel, sessionKeyPermission)
    }

    getMergedAbiCache(args: TransactArgs, options?: TransactOptions): ABICacheInterface {
        const abiCache = options?.abiCache || this.abiCache

        // If the abiCache supports appending ABIs, merge all from args/options
        if (!abiCache['setAbi']) {
            throw new Error('Custom `abiCache` does not support `setAbi` method.')
        }

        // Append all ABIs that exist on the Session
        this.abis.forEach((def: TransactABIDef) => abiCache.setAbi(def.account, def.abi))

        if (options?.abis) {
            // If we have ABIs from the TransactOptions, append
            options.abis.forEach((def: TransactABIDef) => abiCache.setAbi(def.account, def.abi))
        }

        if (options?.contracts) {
            // Append ABIs from any Contract instances
            options.contracts.forEach((c) => abiCache.setAbi(c.account, c.abi))
        }

        if (args.action && args.action['abi']) {
            // Merge any partial ABIs from the action
            abiCache.setAbi(args.action.account, args.action['abi'], true)
        }

        if (args.actions) {
            args.actions.forEach((action) => {
                if (action['abi']) {
                    // Merge any partial ABIs from the actions
                    abiCache.setAbi(action.account, action['abi'], true)
                }
            })
        }

        if (args.transaction && args.transaction.actions) {
            args.transaction.actions.forEach((action) => {
                if (action['abi']) {
                    // Merge any partial ABIs from the transaction
                    abiCache.setAbi(action.account, action['abi'], true)
                }
            })
        }

        return abiCache
    }

    /**
     * Get the current status of the session key for this session.
     *
     * @returns SessionKeyStatus indicating whether a session key is active, inactive, has a mismatch, or is not set up
     */
    async getSessionKeyStatus(): Promise<SessionKeyStatus> {
        const status: SessionKeyStatus = {active: false, exists: false, state: 'not-setup'}

        if (!this.sessionKeyManager) {
            return status
        }

        if (this.sessionKeyManager.hasSessionKey(this)) {
            status.active = true
            status.exists = true
            status.state = 'active'
            if (isSessionKeyWallet(this.walletPlugin)) {
                status.permission = this.walletPlugin.getPermission()
                status.publicKey = this.walletPlugin.getPublicKey()
            }
            return status
        }

        const result = await this.sessionKeyManager.checkExistingSessionKey(this)

        if (result.exists) {
            status.exists = true
            status.state = result.mismatch ? 'mismatch' : 'inactive'
            status.permission = result.permission
            status.mismatch = result.mismatch
        }

        return status
    }

    /**
     * Set up a session key for this session, creating a new permission with a generated key.
     * Shows consent UI if configured, handles conflicts with existing keys, and persists the session.
     *
     * @returns SessionKeySetupResult containing the public key and permission name
     * @throws Error if session keys are not configured or if setup is cancelled by user
     */
    async setupSessionKey(): Promise<SessionKeySetupResult> {
        if (!this.sessionKeyManager) {
            throw new Error('Session keys are not configured. Add sessionKey to SessionKitOptions.')
        }

        if (!this.sessionKeyManager.config.skipConsent && this.ui?.onSessionKeyConsent) {
            const consent = await this.ui.onSessionKeyConsent({
                appName: String(this.appName || 'this app'),
                whitelist: this.sessionKeyManager.whitelist.map((e) => ({
                    contract: String(e.contract),
                    actions: e.actions?.map((a) => String(a)),
                })),
            })

            if (!consent) {
                throw new Error('Session key setup cancelled by user')
            }
        }

        const result = await this.sessionKeyManager.setup(this, async (existingKeys) => {
            if (!this.ui?.onSessionKeyConflict) {
                return 'replace'
            }
            return this.ui.onSessionKeyConflict({
                appName: String(this.appName || 'this app'),
                existingKeyCount: existingKeys.length,
            })
        })

        if (this.onPersist) {
            await this.onPersist(this)
        }

        return result
    }

    /**
     * Remove the session key from this session, reverting to the primary wallet.
     * Removes the key from the blockchain permission and persists the session.
     *
     * @throws Error if session keys are not configured or if the session does not have a session key
     */
    async removeSessionKey(): Promise<void> {
        if (!this.sessionKeyManager) {
            throw new Error('Session keys are not configured. Add sessionKey to SessionKitOptions.')
        }

        await this.sessionKeyManager.remove(this)

        if (this.onPersist) {
            await this.onPersist(this)
        }
    }

    /**
     * Validate the session key whitelist against the on-chain permission links.
     * Returns any mismatches between configured whitelist and actual blockchain state.
     *
     * @returns SessionKeyMismatch if there are differences, undefined if in sync or no session key
     */
    async validateSessionKeyWhitelist(): Promise<SessionKeyMismatch | undefined> {
        if (!this.sessionKeyManager) {
            return undefined
        }

        return this.sessionKeyManager.validateWhitelist(this)
    }

    /**
     * Update the on-chain permission links to match the configured whitelist.
     * Adds missing links and removes extra links, then persists the session.
     *
     * @throws Error if session keys are not configured or if the session does not have a session key
     */
    async updateSessionKeyLinks(): Promise<void> {
        if (!this.sessionKeyManager) {
            throw new Error('Session keys are not configured. Add sessionKey to SessionKitOptions.')
        }

        await this.sessionKeyManager.updateLinks(this)

        if (this.onPersist) {
            await this.onPersist(this)
        }
    }
}

async function processReturnValues(
    response: any,
    abiCache: ABICacheInterface
): Promise<TransactResultReturnValue[]> {
    const decoded: TransactResultReturnValue[] = []
    for (const actionTrace of response.processed.action_traces) {
        if (actionTrace.return_value_hex_data) {
            const contract = Name.from(actionTrace.act.account)
            const action = Name.from(actionTrace.act.name)
            const abi = await abiCache.getAbi(contract)
            const returnType = abi.action_results.find((a) => Name.from(a.name).equals(action))
            if (returnType) {
                try {
                    const data = Serializer.decode({
                        data: actionTrace.return_value_hex_data,
                        type: returnType.result_type,
                        abi,
                    })
                    decoded.push({
                        contract,
                        action,
                        hex: actionTrace.return_value_hex_data,
                        data,
                        returnType,
                    })
                } catch (error) {
                    // eslint-disable-next-line no-console -- warn the developer since this may be unintentional
                    console.warn(`Error decoding return value for ${contract}::${action}:`, error)
                    decoded.push({
                        contract,
                        action,
                        hex: actionTrace.return_value_hex_data,
                        data: '',
                        returnType,
                    })
                }
            } else {
                // eslint-disable-next-line no-console -- warn the developer since this may be unintentional
                console.warn(`No return type found for ${contract}::${action}`)
                decoded.push({
                    contract,
                    action,
                    hex: actionTrace.return_value_hex_data,
                    data: '',
                    returnType: {
                        name: action,
                        result_type: '',
                    },
                })
            }
        }
    }
    return decoded
}
