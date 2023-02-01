import {
    APIClient,
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
import zlib from 'pako'
import {ABICache} from './abi'
import {UserInterface} from './kit'
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
    chains: ChainDefinition[]
    context: WalletPluginContext
}

export interface WalletPluginLoginResponse {
    chain: ChainDefinition
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
    login(options: WalletPluginLoginOptions): WalletPluginLoginResponse
    sign(chain: ChainDefinition, transaction: ResolvedSigningRequest): Signature
}

export abstract class AbstractWalletPlugin implements WalletPlugin {
    public config: WalletPluginConfig = {
        requiresChainSelect: true,
        requiresPermissionSelect: false,
    }
    public metadata: WalletPluginMetadata = {}
    public abstract login(options: WalletPluginLoginOptions): WalletPluginLoginResponse
    public abstract sign(chain: ChainDefinition, transaction: ResolvedSigningRequest): Signature
}

/**
 * Options for creating a new instance of a [[Session]].
 */
export interface SessionOptions {
    abiProvider?: AbiProvider
    actor?: NameType
    allowModify?: boolean
    appName?: NameType
    broadcast?: boolean
    chain: ChainDefinitionType
    expireSeconds?: number
    fetch?: Fetch
    permission?: NameType
    permissionLevel?: PermissionLevelType | string
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    ui?: UserInterface
    walletPlugin: WalletPlugin
}

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

    constructor(options: SessionOptions) {
        if (options.appName) {
            this.appName = Name.from(options.appName)
        }
        this.chain = ChainDefinition.from(options.chain)
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
        if (options.permissionLevel) {
            this.permissionLevel = PermissionLevel.from(options.permissionLevel)
        } else if (options.actor && options.permission) {
            this.permissionLevel = PermissionLevel.from(`${options.actor}@${options.permission}`)
        } else {
            throw new Error(
                'Either a permissionLevel or actor/permission must be provided when creating a new Session.'
            )
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
        this.wallet = options.walletPlugin
    }

    get actor(): Name {
        return this.permissionLevel.actor
    }

    get permission(): Name {
        return this.permissionLevel.permission
    }

    get client(): APIClient {
        return new APIClient({provider: new FetchProvider(this.chain.url, {fetch: this.fetch})})
    }

    upgradeTransaction(args) {
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
     * TODO: Remove. This will no longer be needed once the `clone` functionality in ESR is updated
     */
    private storageType(version: number): typeof RequestDataV3 | typeof RequestDataV2 {
        return version === 2 ? RequestDataV2 : RequestDataV3
    }

    /**
     * Create a clone of the given SigningRequest
     *
     * @param {SigningRequest} request
     * @param {AbiProvider} abiProvider
     * @returns Returns a cloned SigningRequest with updated abiProvider and zlib
     */
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
        // The abi provider to use for this transaction, defaulting to the one from the session
        const abiProvider = options?.abiProvider || this.abiProvider

        // The context for this transaction
        const context = new TransactContext({
            abiProvider,
            client: this.client,
            fetch: this.fetch,
            permissionLevel: this.permissionLevel,
            transactPlugins: options?.transactPlugins || this.transactPlugins,
            transactPluginsOptions: options?.transactPluginsOptions || this.transactPluginsOptions,
            ui: this.ui,
        })

        await context.ui.onTransact(context)
        context.ui.status('Preparing transaction...')

        // Process TransactArgs and convert to a SigningRequest
        let request: SigningRequest = await this.createRequest(args, abiProvider)

        // Create response template to this transact call
        const result: TransactResult = {
            chain: this.chain,
            request,
            resolved: undefined,
            revisions: new TransactRevisions(request),
            signatures: [],
            signer: this.permissionLevel,
            transaction: undefined,
        }

        // Whether or not the request should be able to be modified by beforeSign hooks
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

        // Run the `beforeSign` hooks
        for (const hook of context.hooks.beforeSign) {
            // Get the response of the hook by passing a clonied request.
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

        context.ui.status('Awaiting transaction signature...')

        // Resolve the SigningRequest and assign it to the TransactResult
        result.request = request
        result.resolved = await context.resolve(request, expireSeconds)
        result.transaction = result.resolved.resolvedTransaction

        // Sign transaction based on wallet plugin
        const signature = await this.wallet.sign(this.chain, result.resolved)
        result.signatures.push(signature)

        context.ui.status('Post processing transaction...')

        // Run the `afterSign` hooks
        for (const hook of context.hooks.afterSign) await hook(result.request.clone(), context)

        // Broadcast transaction if requested
        if (willBroadcast) {
            context.ui.status('Preparing to broadcast transaction...')

            // Assemble the signed transaction to broadcast
            const signed = SignedTransaction.from({
                ...result.resolved.transaction,
                signatures: result.signatures,
            })

            // Broadcast the signed transaction
            result.response = await context.client.v1.chain.send_transaction(signed)

            context.ui.status('Completing transaction...')

            // Run the `afterBroadcast` hooks
            for (const hook of context.hooks.afterBroadcast)
                await hook(result.request.clone(), context)
        }

        await context.ui.onTransactResult(result)

        return result
    }
}
