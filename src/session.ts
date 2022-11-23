import {
    ABIDef,
    AnyAction,
    AnyTransaction,
    APIClient,
    APIClientOptions,
    Checksum256Type,
    FetchProvider,
    Name,
    PermissionLevel,
    PermissionLevelType,
    Signature,
} from '@greymass/eosio'
import {
    AbiProvider,
    ResolvedSigningRequest,
    ResolvedTransaction,
    SigningRequest,
} from 'eosio-signing-request'
import zlib from 'pako'

import {ChainDefinition, ChainDefinitionType, Fetch} from './types'

export type TransactPluginsOptions = Record<string, unknown>

export enum TransactHookTypes {
    beforeSign = 'beforeSign',
    afterSign = 'afterSign',
    beforeBroadcast = 'beforeBroadcast',
    afterBroadcast = 'afterBroadcast',
}

export type TransactHook = (
    request: SigningRequest,
    context: TransactContext
) => Promise<TransactHookResponse>

export interface TransactHooks {
    afterSign: TransactHook[]
    beforeSign: TransactHook[]
    afterBroadcast: TransactHook[]
    beforeBroadcast: TransactHook[]
}

export interface TransactHookResponse {
    request: SigningRequest
    signatures?: Signature[]
}

export interface WalletPluginOptions {
    name?: string
}

export interface WalletPluginLoginOptions {
    appName: Name
    chains: ChainDefinition[]
    context: SessionOptions
}

export interface WalletPluginLoginResponse {
    chain: ChainDefinition
    permissionLevel: PermissionLevel
}

export interface WalletPlugin {
    login(options: WalletPluginLoginOptions): WalletPluginLoginResponse
    sign(chain: ChainDefinition, transaction: ResolvedSigningRequest): Signature
}

export abstract class AbstractWalletPlugin implements WalletPlugin {
    public abstract login(options: WalletPluginLoginOptions): WalletPluginLoginResponse
    public abstract sign(chain: ChainDefinition, transaction: ResolvedSigningRequest): Signature
}

/**
 * Options for creating a new context for a [[Session.transact]] call.
 */
export interface TransactContextOptions {
    client: APIClient
    session: PermissionLevel
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
}

/**
 * Temporary context created for the duration of a [[Session.transact]] call.
 *
 * This context is used to store the state of the transact request and
 * provide a way for plugins to add hooks into the process.
 */
export class TransactContext {
    client: APIClient
    hooks: TransactHooks = {
        afterBroadcast: [],
        afterSign: [],
        beforeBroadcast: [],
        beforeSign: [],
    }
    session: PermissionLevel
    transactPluginsOptions: TransactPluginsOptions
    constructor(options: TransactContextOptions) {
        this.client = options.client
        this.session = options.session
        this.transactPluginsOptions = options.transactPluginsOptions || {}
        options.transactPlugins?.forEach((plugin: AbstractTransactPlugin) => {
            plugin.register(this)
        })
    }
    addHook(t: TransactHookTypes, hook: TransactHook) {
        this.hooks[t].push(hook)
    }
}

/**
 * Payload accepted by the [[Session.transact]] method.
 * Note that one of `action`, `actions` or `transaction` must be set.
 */
export interface TransactArgs {
    /** Full transaction to sign. */
    transaction?: AnyTransaction
    /** Action to sign. */
    action?: AnyAction
    /** Actions to sign. */
    actions?: AnyAction[]
    /** An ESR payload */
    request?: SigningRequest | string
}

/**
 * Options for the [[Session.transact]] method.
 */
export interface TransactOptions {
    /**
     * Whether to allow the signer to make modifications to the request
     * (e.g. applying a cosigner action to pay for resources).
     *
     * Defaults to true if [[broadcast]] is true or unspecified; otherwise false.
     */
    allowModify?: boolean
    /**
     * Whether to broadcast the transaction or just return the signature.
     * Defaults to true.
     */
    broadcast?: boolean
    /**
     * Chain to use when configured with multiple chains.
     */
    chain?: Checksum256Type
    /**
     * Specific transact plugins to use for this transaction.
     */
    transactPlugins?: AbstractTransactPlugin[]
    /**
     * Optional parameters passed in to the various transact plugins.
     */
    transactPluginsOptions?: TransactPluginsOptions
}

/**
 * The response from a [[Session.transact]] call.
 */
export interface TransactResult {
    /** The chain that was used. */
    chain: ChainDefinition
    /** The SigningRequest representation of the transaction. */
    request: SigningRequest
    /** The ResolvedSigningRequest of the transaction */
    resolved: ResolvedSigningRequest | undefined
    /** The transaction signatures. */
    signatures: Signature[]
    /** The signer authority. */
    signer: PermissionLevel
    /** The resulting transaction. */
    transaction: ResolvedTransaction | undefined
    /** Push transaction response from api node, only present if transaction was broadcast. */
    processed?: {[key: string]: any}
}

/**
 * Interface which a [[Session.transact]] plugin must implement.
 */
export interface TransactPlugin {
    register: (context: TransactContext) => void
}

/**
 * Abstract class for [[Session.transact]] plugins to extend.
 */
export abstract class AbstractTransactPlugin implements TransactPlugin {
    public abstract register(context: TransactContext): void
}

export class BaseTransactPlugin extends AbstractTransactPlugin {
    register() {
        // console.log('Register hooks via context.addHook')
    }
}

/**
 * Options for creating a new instance of a [[Session]].
 */
export interface SessionOptions {
    chain: ChainDefinitionType
    client?: APIClient
    fetch?: Fetch
    permissionLevel: PermissionLevelType | string
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    walletPlugin: WalletPlugin
}

export class Session {
    readonly chain: ChainDefinition
    readonly client: APIClient
    readonly transactPlugins: TransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly permissionLevel: PermissionLevel
    readonly wallet: WalletPlugin

    constructor(options: SessionOptions) {
        this.chain = ChainDefinition.from(options.chain)
        if (options.client) {
            this.client = options.client
        } else {
            const clientOptions: APIClientOptions = {
                url: this.chain.url,
            }
            if (options.fetch) {
                /* istanbul ignore next */
                clientOptions.provider = new FetchProvider(this.chain.url, {
                    fetch: options.fetch,
                })
            }
            this.client = new APIClient(clientOptions)
        }
        if (options.transactPlugins) {
            this.transactPlugins = options.transactPlugins
        } else {
            this.transactPlugins = [new BaseTransactPlugin()]
        }
        if (options.transactPluginsOptions) {
            this.transactPluginsOptions = options.transactPluginsOptions
        }
        this.permissionLevel = PermissionLevel.from(options.permissionLevel)
        this.wallet = options.walletPlugin
    }

    get account(): Name {
        return this.permissionLevel.actor
    }

    get permission(): Name {
        return this.permissionLevel.permission
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

    async createRequest(args: TransactArgs): Promise<SigningRequest> {
        const abiProvider: AbiProvider = {
            getAbi: async (account: Name): Promise<ABIDef> => {
                const response = await this.client.v1.chain.get_abi(account)
                if (!response.abi) {
                    /* istanbul ignore next */
                    throw new Error('could not load abi') // TODO: Better coverage for this
                }
                return response.abi
            },
        }
        const options = {
            abiProvider,
            zlib,
        }
        if (args.request && args.request instanceof SigningRequest) {
            return SigningRequest.from(String(args.request), options)
        } else if (args.request) {
            return SigningRequest.from(args.request, options)
        } else {
            args = this.upgradeTransaction(args)
            const request = await SigningRequest.create(
                {
                    ...args,
                    chainId: this.chain.id,
                },
                options
            )
            return request
        }
    }

    /**
     * Perform a transaction using this session.
     *
     * @mermaid - Transaction sequence diagram
     * flowchart LR
     *   A((Transact)) --> B{{"Hook(s): beforeSign"}}
     *   B --> C[Wallet Plugin]
     *   C --> D{{"Hook(s): afterSign"}}
     *   D --> E{{"Hook(s): beforeBroadcast"}}
     *   E --> F[Broadcast Plugin]
     *   F --> G{{"Hook(s): afterBroadcast"}}
     *   G --> H[TransactResult]
     */
    async transact(args: TransactArgs, options?: TransactOptions): Promise<TransactResult> {
        // The context for this transaction
        const context = new TransactContext({
            client: this.client,
            transactPlugins: options?.transactPlugins || this.transactPlugins,
            transactPluginsOptions: options?.transactPluginsOptions || this.transactPluginsOptions,
            session: this.permissionLevel,
        })

        // Process TransactArgs and convert to a SigningRequest
        const request: SigningRequest = await this.createRequest(args)

        // Create response template to this transact call
        const result: TransactResult = {
            chain: this.chain,
            request,
            resolved: undefined,
            signatures: [],
            signer: this.permissionLevel,
            transaction: undefined,
        }

        // Whether or not the request should be able to be modified by beforeSign hooks
        const allowModify =
            options && typeof options.allowModify !== 'undefined' ? options.allowModify : true

        // Whether or not the request should be broadcast during the transact call
        const willBroadcast =
            options && typeof options.broadcast !== 'undefined' ? options.broadcast : true

        // Run the `beforeSign` hooks
        context.hooks.beforeSign.forEach(async (hook) => {
            // TODO: Verify we should be cloning the requests here, and write tests to verify they cannot be modified
            const response = await hook(result.request.clone(), context)
            if (allowModify) {
                result.request = response.request.clone()
            }
        })

        // Resolve SigningRequest with authority + tapos
        const info = await context.client.v1.chain.get_info()
        const expireSeconds = 120 // TODO: Needs to be configurable by parameters
        const header = info.getTransactionHeader(expireSeconds)
        const abis = await result.request.fetchAbis() // TODO: ABI Cache Implementation
        result.resolved = await result.request.resolve(abis, this.permissionLevel, header)
        result.transaction = result.resolved.resolvedTransaction

        // Sign transaction based on wallet plugin
        const signature = await this.wallet.sign(this.chain, result.resolved)
        result.signatures.push(signature)

        // Run the `afterSign` hooks
        context.hooks.afterSign.forEach(async (hook) => await hook(result.request.clone(), context))

        // Broadcast transaction if requested
        if (willBroadcast) {
            // Run the `beforeBroadcast` hooks
            context.hooks.beforeBroadcast.forEach(
                async (hook) => await hook(result.request.clone(), context)
            )

            // broadcast transaction
            // TODO: Implement broadcast

            // Run the `afterBroadcast` hooks
            context.hooks.afterBroadcast.forEach(
                async (hook) => await hook(result.request.clone(), context)
            )
        }

        return result
    }
}
