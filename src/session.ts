import {
    APIClient,
    FetchProvider,
    Name,
    PermissionLevel,
    PermissionLevelType,
    Signature,
    SignedTransaction,
} from '@greymass/eosio'
import {
    RequestDataV2,
    RequestDataV3,
    RequestSignature,
    ResolvedSigningRequest,
    SigningRequest,
} from 'eosio-signing-request'
import zlib from 'pako'
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

import {ChainDefinition, ChainDefinitionType, Fetch} from './types'
import {getFetch} from './utils'

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
 * Options for creating a new instance of a [[Session]].
 */
export interface SessionOptions {
    allowModify?: boolean
    broadcast?: boolean
    chain: ChainDefinitionType
    expireSeconds?: number
    fetch?: Fetch
    permissionLevel: PermissionLevelType | string
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    walletPlugin: WalletPlugin
}

export class Session {
    readonly abiCache = ABICache
    readonly allowModify: boolean = true
    readonly broadcast: boolean = true
    readonly chain: ChainDefinition
    readonly expireSeconds: number = 120
    readonly fetch: Fetch
    readonly permissionLevel: PermissionLevel
    readonly transactPlugins: TransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly wallet: WalletPlugin

    constructor(options: SessionOptions) {
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
        this.permissionLevel = PermissionLevel.from(options.permissionLevel)
        this.wallet = options.walletPlugin
    }

    get accountName(): Name {
        return this.permissionLevel.actor
    }

    get permissionName(): Name {
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

    // Lifted from @greymass/eosio-signing-request
    private storageType(version: number): typeof RequestDataV3 | typeof RequestDataV2 {
        return version === 2 ? RequestDataV2 : RequestDataV3
    }

    async createRequest(args: TransactArgs, abiCache: ABICache): Promise<SigningRequest> {
        let request: SigningRequest
        const options = {
            abiProvider: abiCache,
            zlib,
        }
        if (args.request && args.request instanceof SigningRequest) {
            // Lifted from @greymass/eosio-signing-request method `clone()`
            // This was done to modify the zlib and abiProvider
            // TODO: Modify ESR library to expose this `clone()` functionality
            let signature: RequestSignature | undefined
            if (args.request.signature) {
                signature = RequestSignature.from(
                    JSON.parse(JSON.stringify(args.request.signature))
                )
            }
            const RequestData = this.storageType(args.request.version)
            const data = RequestData.from(JSON.parse(JSON.stringify(args.request.data)))
            request = new SigningRequest(args.request.version, data, zlib, abiCache, signature)
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
     * Perform a transaction using this session.
     *
     * @mermaid - Transaction sequence diagram
     * flowchart LR
     *   A((Transact)) --> B{{"Hook(s): beforeSign"}}
     *   B --> C[Wallet Plugin]
     *   C --> D{{"Hook(s): afterSign"}}
     *   D --> F[Broadcast Plugin]
     *   E --> G{{"Hook(s): afterBroadcast"}}
     *   F --> H[TransactResult]
     */
    async transact(args: TransactArgs, options?: TransactOptions): Promise<TransactResult> {
        const abiCache = new ABICache(this.client)

        // The context for this transaction
        const context = new TransactContext({
            abiCache,
            client: this.client,
            fetch: this.fetch,
            permissionLevel: this.permissionLevel,
            transactPlugins: options?.transactPlugins || this.transactPlugins,
            transactPluginsOptions: options?.transactPluginsOptions || this.transactPluginsOptions,
        })

        // Process TransactArgs and convert to a SigningRequest
        let request: SigningRequest = await this.createRequest(args, abiCache)

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
                request = response.request.clone()
            }
            // If signatures were returned, append them
            if (response.signatures) {
                result.signatures = [...result.signatures, ...response.signatures]
            }
        }

        // Resolve the SigningRequest and assign it to the TransactResult
        result.request = request
        result.resolved = await context.resolve(request, expireSeconds)
        result.transaction = result.resolved.resolvedTransaction

        // Sign transaction based on wallet plugin
        const signature = await this.wallet.sign(this.chain, result.resolved)
        result.signatures.push(signature)

        // Run the `afterSign` hooks
        for (const hook of context.hooks.afterSign) await hook(result.request.clone(), context)

        // Broadcast transaction if requested
        if (willBroadcast) {
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
export {AbstractTransactPlugin}
