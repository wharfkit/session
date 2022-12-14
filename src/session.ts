import {
    ABIDef,
    AnyAction,
    AnyTransaction,
    APIClient,
    Checksum256Type,
    FetchProvider,
    Name,
    PermissionLevel,
    PermissionLevelType,
    Signature,
    SignedTransaction,
} from '@greymass/eosio'
import {
    AbiProvider,
    ResolvedSigningRequest,
    ResolvedTransaction,
    SigningRequest,
} from 'eosio-signing-request'
import zlib from 'pako'

import {ChainDefinition, ChainDefinitionType, Fetch} from './types'
import {getFetch} from './utils'

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
    fetch: Fetch
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
    readonly client: APIClient
    readonly fetch: Fetch
    readonly hooks: TransactHooks = {
        afterBroadcast: [],
        afterSign: [],
        beforeBroadcast: [],
        beforeSign: [],
    }
    readonly session: PermissionLevel
    readonly transactPluginsOptions: TransactPluginsOptions
    constructor(options: TransactContextOptions) {
        this.client = options.client
        this.fetch = options.fetch
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
    /** The response from the API after sending the transaction, only present if transaction was broadcast. */
    response?: {[key: string]: any}
    /** The transaction signatures. */
    signatures: Signature[]
    /** The signer authority. */
    signer: PermissionLevel
    /** The resulting transaction. */
    transaction: ResolvedTransaction | undefined
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
    allowModify?: boolean
    broadcast?: boolean
    chain: ChainDefinitionType
    fetch?: Fetch
    permissionLevel: PermissionLevelType | string
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    walletPlugin: WalletPlugin
}

export class Session {
    readonly allowModify: boolean = true
    readonly broadcast: boolean = true
    readonly chain: ChainDefinition
    readonly fetch: Fetch
    readonly transactPlugins: TransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly permissionLevel: PermissionLevel
    readonly wallet: WalletPlugin

    constructor(options: SessionOptions) {
        this.chain = ChainDefinition.from(options.chain)
        if (options.allowModify !== undefined) {
            this.allowModify = options.allowModify
        }
        if (options.broadcast !== undefined) {
            this.broadcast = options.broadcast
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
        this.permissionLevel = PermissionLevel.from(options.permissionLevel)
        this.wallet = options.walletPlugin
    }

    get account(): Name {
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
            fetch: this.fetch,
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
            options && typeof options.allowModify !== 'undefined'
                ? options.allowModify
                : this.allowModify

        // Whether or not the request should be broadcast during the transact call
        const willBroadcast =
            options && typeof options.broadcast !== 'undefined' ? options.broadcast : this.broadcast

        // Run the `beforeSign` hooks
        for (const hook of context.hooks.beforeSign) {
            const response = await hook(result.request.clone(), context)
            // TODO: Verify we should be cloning the requests here, and write tests to verify they cannot be modified
            if (allowModify) {
                result.request = response.request.clone()
            }
            // If signatures were returned, append them
            if (response.signatures) {
                result.signatures = [...result.signatures, ...response.signatures]
            }
        }

        // Resolve SigningRequest with authority + tapos
        const info = await context.client.v1.chain.get_info()
        const expireSeconds = 120 // TODO: Needs to be configurable by parameters
        const header = info.getTransactionHeader(expireSeconds)
        const abis = await result.request.fetchAbis() // TODO: ABI Cache Implementation

        // Resolve the request and get the resolved transaction
        result.resolved = await result.request.resolve(abis, this.permissionLevel, header)
        result.transaction = result.resolved.resolvedTransaction

        // Sign transaction based on wallet plugin
        const signature = await this.wallet.sign(this.chain, result.resolved)
        result.signatures.push(signature)

        // Run the `afterSign` hooks
        for (const hook of context.hooks.afterSign) await hook(result.request.clone(), context)

        // Broadcast transaction if requested
        if (willBroadcast) {
            // Run the `beforeBroadcast` hooks
            for (const hook of context.hooks.beforeBroadcast)
                await hook(result.request.clone(), context)

            // Assemble the signed transaction to broadcast
            const signed = SignedTransaction.from({
                ...result.resolved.transaction,
                signatures: result.signatures,
            })

            // Broadcast the signed transaction
            result.response = await context.client.v1.chain.send_transaction(signed)

            // Run the `afterBroadcast` hooks
            for (const hook of context.hooks.afterBroadcast)
                await hook(result.request.clone(), context)
        }

        return result
    }
}
