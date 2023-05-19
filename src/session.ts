import zlib from 'pako'
import {
    APIClient,
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
} from '@greymass/eosio'
import {
    AbiProvider,
    ChainId,
    RequestDataV2,
    RequestDataV3,
    RequestSignature,
    ResolvedSigningRequest,
    SigningRequest,
} from 'eosio-signing-request'

import {ABICache} from './abi'
import {
    AbstractTransactPlugin,
    BaseTransactPlugin,
    TransactArgs,
    TransactContext,
    TransactOptions,
    TransactPlugin,
    TransactPluginsOptions,
    TransactResult,
    TransactRevisions,
} from './transact'
import {SessionStorage} from './storage'
import {ChainDefinition, ChainDefinitionType, Fetch, LocaleDefinitions} from './types'
import {getFetch} from './utils'
import {SerializedWalletPlugin, WalletPlugin, WalletPluginSignResponse} from './wallet'
import {UserInterface} from './ui'

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
    abiProvider?: AbiProvider
    allowModify?: boolean
    appName?: NameType
    broadcast?: boolean
    expireSeconds?: number
    fetch?: Fetch
    storage?: SessionStorage
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    ui?: UserInterface
}

export interface SerializedSession {
    actor: NameType
    chain: Checksum256Type
    permission: NameType
    walletPlugin: SerializedWalletPlugin
}

/**
 * A representation of a session to interact with a specific blockchain account.
 */
export class Session {
    readonly appName: Name | undefined
    readonly abiProvider: AbiProvider
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
    readonly walletPlugin: WalletPlugin

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
        this.walletPlugin = args.walletPlugin

        // Handle all the optional values provided
        if (options.appName) {
            this.appName = Name.from(options.appName)
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
        if (options.abiProvider) {
            this.abiProvider = options.abiProvider
        } else {
            this.abiProvider = new ABICache(this.client)
        }
        if (options.ui) {
            this.ui = options.ui
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
        return args
    }

    /**
     * Lifted from @greymass/eosio-signing-request.
     *
     * Copy of: https://github.com/greymass/eosio-signing-request/blob/6fc84b2355577d6461676bff417c76e4f6f2f5c3/src/signing-request.ts#L305
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
     * Overrides: https://github.com/greymass/eosio-signing-request/blob/6fc84b2355577d6461676bff417c76e4f6f2f5c3/src/signing-request.ts#L1112
     *
     * @param {SigningRequest} request The SigningRequest to clone
     * @param {AbiProvider} abiProvider The AbiProvider to use for the clone
     * @returns Returns a cloned SigningRequest with updated abiProvider and zlib
     */
    /* istanbul ignore next */
    cloneRequest(request: SigningRequest, abiProvider: AbiProvider): SigningRequest {
        // Lifted from @greymass/eosio-signing-request method `clone()`
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
        return new SigningRequest(request.version, data, zlib, abiProvider, signature)
    }

    /**
     * Convert any provided form of TransactArgs to a SigningRequest
     *
     * @param {TransactArgs} args
     * @param {AbiProvider} abiProvider
     * @returns Returns a SigningRequest
     */
    async createRequest(args: TransactArgs, abiProvider: AbiProvider): Promise<SigningRequest> {
        let request: SigningRequest
        const options = {
            abiProvider,
            zlib,
        }
        if (args.request && args.request instanceof SigningRequest) {
            request = this.cloneRequest(args.request, abiProvider)
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
     * @param abiProvider
     * @returns
     */
    async updateRequest(
        previous: SigningRequest,
        modified: SigningRequest,
        abiProvider: AbiProvider
    ): Promise<SigningRequest> {
        const updatedRequest: SigningRequest = this.cloneRequest(modified, abiProvider)
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
            const abiProvider = options?.abiProvider || this.abiProvider

            // The TransactPlugins to use for this transaction, falling back to the session instance
            const transactPlugins = options?.transactPlugins || this.transactPlugins
            const transactPluginsOptions =
                options?.transactPluginsOptions || this.transactPluginsOptions

            // A flag to determine whether or not the request can be modified by the beforeSign hooks or wallet plugins
            let allowModify =
                options && typeof options.allowModify !== 'undefined'
                    ? options.allowModify
                    : this.allowModify

            // The context object for this transaction
            const context = new TransactContext({
                abiProvider,
                appName: this.appName,
                chain: this.chain,
                client: this.client,
                createRequest: (args: TransactArgs) => this.createRequest(args, abiProvider),
                fetch: this.fetch,
                permissionLevel: this.permissionLevel,
                storage: this.storage,
                transactPlugins,
                transactPluginsOptions,
                ui: this.ui,
            })

            if (context.ui) {
                // Notify the UI that a transaction is about to begin
                await context.ui.onTransact()
                // Merge in any new localization strings from the plugins
                for (const translation of transactPlugins.map((transactPlugin) =>
                    this.getPluginTranslations(transactPlugin)
                )) {
                    context.ui.addTranslations(translation)
                }
            }

            // Process incoming TransactArgs and convert to a SigningRequest
            let request: SigningRequest = await this.createRequest(args, abiProvider)

            // Create TransactResult to eventually respond to this call with
            const result: TransactResult = {
                chain: this.chain,
                request,
                resolved: undefined,
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
                        request = await this.updateRequest(request, response.request, abiProvider)
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
                context.ui.addTranslations(this.getPluginTranslations(this.walletPlugin))
            }

            // Retrieve the signature(s) and request modifications for this request from the WalletPlugin
            const walletResponse: WalletPluginSignResponse = await this.walletPlugin.sign(
                result.resolved,
                context
            )

            if (context.ui) {
                await context.ui.onSignComplete()
            }

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
            for (const hook of context.hooks.afterSign) await hook(result.request.clone(), context)

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

                // Run the `afterBroadcast` hooks that were registered by the TransactPlugins
                for (const hook of context.hooks.afterBroadcast)
                    await hook(result.request.clone(), context, result)

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
        }
    }

    async sign(transaction: TransactionType): Promise<Signature[]> {
        // Create a TransactContext for the WalletPlugin to use
        const context = new TransactContext({
            abiProvider: this.abiProvider,
            chain: this.chain,
            client: this.client,
            createRequest: (args: TransactArgs) => this.createRequest(args, this.abiProvider),
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

    serialize = (): SerializedSession =>
        Serializer.objectify({
            chain: this.chain.id,
            actor: this.permissionLevel.actor,
            permission: this.permissionLevel.permission,
            walletPlugin: this.walletPlugin.serialize(),
        })

    getPluginTranslations(transactPlugin: TransactPlugin | WalletPlugin): LocaleDefinitions {
        if (!transactPlugin.translations) {
            return {}
        }
        const prefixed = {}
        const languages = Object.keys(transactPlugin.translations)
        languages.forEach((lang) => {
            if (transactPlugin.translations) {
                prefixed[lang] = {[transactPlugin.id]: transactPlugin.translations[lang]}
            }
        })
        return prefixed
    }
}
