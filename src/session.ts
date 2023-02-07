import zlib from 'pako'
import {
    APIClient,
    Checksum256,
    FetchProvider,
    Name,
    NameType,
    PermissionLevel,
    PermissionLevelType,
    Signature,
    SignedTransaction,
} from '@greymass/eosio'
import {
    AbiProvider,
    RequestDataV2,
    RequestDataV3,
    RequestSignature,
    ResolvedSigningRequest,
    SigningRequest,
} from 'eosio-signing-request'

import {ABICache} from './abi'
import {LoginContext, UserInterface} from './kit'
import {UserInterfaceHeadless} from './plugins/userinterface/headless'
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
import {ChainDefinition, ChainDefinitionType, Fetch} from './types'
import {getFetch} from './utils'

export interface WalletPluginOptions {
    name?: string
}

export interface WalletPluginContext {
    chain: ChainDefinition
    permissionLevel: PermissionLevelType | string
}

export interface WalletPluginLoginOptions {
    appName: Name
    chain?: ChainDefinition
    chains: ChainDefinition[]
    context: LoginContext
    permissionLevel?: PermissionLevel
}

/**
 * The response required for a login call by a walletPlugin.
 */
export interface WalletPluginLoginResponse {
    /**
     * The chain
     */
    chain: Checksum256
    permissionLevel: PermissionLevel
}

export interface WalletPluginConfig {
    /**
     * Indicates if the walletPlugin requires the user to manually select the blockchain to authorize against.
     */
    requiresChainSelect: boolean
    /**
     * Indicates if the walletPlugin requires the user to manually select a permission to use.
     */
    requiresPermissionSelect: boolean
}

export interface WalletPluginMetadata {
    /**
     * Display name for the wallet that is presented to users.
     */
    name?: string
    /**
     * Wallet description to further identify the wallet for users.
     */
    description?: string
    /**
     * Wallet branding
     */
    logo?: string
    /**
     * Link to the homepage for the wallet
     */
    homepage?: string
    /**
     * Link to the download page for the wallet
     */
    download?: string
}

export interface WalletPlugin {
    config: WalletPluginConfig
    metadata: WalletPluginMetadata
    login(
        context: LoginContext,
        options: WalletPluginLoginOptions
    ): Promise<WalletPluginLoginResponse>
    sign(transaction: ResolvedSigningRequest, context: TransactContext): Promise<Signature>
}

export abstract class AbstractWalletPlugin implements WalletPlugin {
    config: WalletPluginConfig = {
        requiresChainSelect: true,
        requiresPermissionSelect: false,
    }
    metadata: WalletPluginMetadata = {}
    abstract login(
        context: LoginContext,
        options: WalletPluginLoginOptions
    ): Promise<WalletPluginLoginResponse>
    abstract sign(transaction: ResolvedSigningRequest, context: TransactContext): Promise<Signature>
}

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
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    ui?: UserInterface
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
    readonly transactPlugins: TransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly ui: UserInterface
    readonly wallet: WalletPlugin

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
        this.wallet = args.walletPlugin

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
        } else {
            this.ui = new UserInterfaceHeadless()
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
        // The abi provider to use for this transaction, falling back to the session instance
        const abiProvider = options?.abiProvider || this.abiProvider

        // The context object for this transaction
        const context = new TransactContext({
            abiProvider,
            client: this.client,
            fetch: this.fetch,
            permissionLevel: this.permissionLevel,
            transactPlugins: options?.transactPlugins || this.transactPlugins,
            transactPluginsOptions: options?.transactPluginsOptions || this.transactPluginsOptions,
            ui: this.ui,
        })

        // Notify the UI that a transaction is about to begin
        await context.ui.onTransact(context)
        context.ui.status('Preparing transaction...')

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

        // A flag to determine whether or not the request should be able to be modified by beforeSign hooks
        const allowModify =
            options && typeof options.allowModify !== 'undefined'
                ? options.allowModify
                : this.allowModify

        // The number of seconds before this transaction expires
        const expireSeconds =
            options && options.expireSeconds ? options.expireSeconds : this.expireSeconds

        // Whether or not the request should be broadcast during the transact call
        const willBroadcast =
            options && typeof options.broadcast !== 'undefined' ? options.broadcast : this.broadcast

        // Call the `beforeSign` hooks that were registered by the TransactPlugins
        for (const hook of context.hooks.beforeSign) {
            // Get the response of the hook by passing a cloned request.
            const response = await hook(request.clone(), context)

            // Save revision history for developers to debug modifications to requests.
            result.revisions.addRevision(response, String(hook), allowModify)

            // If modification is allowed, change the current request.
            if (allowModify) {
                request = await this.updateRequest(request, response.request, abiProvider)
            }

            // If signatures were returned, append them
            if (response.signatures) {
                result.signatures = [...result.signatures, ...response.signatures]
            }
        }

        // Notify the UI that we are now awaiting a signature from the WalletPlugin
        context.ui.status('Awaiting transaction signature...')

        // Resolve the SigningRequest and assign it to the TransactResult
        result.request = request
        result.resolved = await context.resolve(request, expireSeconds)
        result.transaction = result.resolved.resolvedTransaction

        // Retrieve the signature for this request from the WalletPlugin
        const signature = await this.wallet.sign(result.resolved, context)
        result.signatures.push(signature)

        // Notify the UI that the signing process has completed and afterSign hooks are now processing.
        context.ui.status('Signature received, post-processing...')

        // Run the `afterSign` hooks that were registered by the TransactPlugins
        for (const hook of context.hooks.afterSign) await hook(result.request.clone(), context)

        // Broadcast transaction if requested
        if (willBroadcast) {
            // Notify the UI that the transaction is about to be broadcast
            context.ui.status('Broadcasting transaction...')

            // Assemble the SignedTransaction to broadcast
            const signed = SignedTransaction.from({
                ...result.resolved.transaction,
                signatures: result.signatures,
            })

            // Broadcast the SignedTransaction
            result.response = await context.client.v1.chain.send_transaction(signed)

            // Notify the UI that the transaction has been broadcast and afterBroadcast hooks are now processing.
            context.ui.status('Transaction broadcast, post-processing...')

            // Run the `afterBroadcast` hooks that were registered by the TransactPlugins
            for (const hook of context.hooks.afterBroadcast)
                await hook(result.request.clone(), context)
        }

        // Notify the UI that the transaction has completed
        await context.ui.onTransactResult(result)

        // Return the TransactResult to the caller
        return result
    }
}
