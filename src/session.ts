import {
    ABIDef,
    APIClient,
    APIClientOptions,
    FetchProvider,
    Name,
    PermissionLevel,
} from '@greymass/eosio'
import {AbiProvider, SigningRequest} from 'eosio-signing-request'
import zlib from 'pako'

import {
    ChainDefinition,
    SessionOptions,
    TransactArgs,
    TransactContext,
    TransactOptions,
    TransactPlugin,
    TransactResult,
    WalletPlugin,
} from './types'

import {BaseTransactPlugin} from './plugins'
import {TransactPluginsOptions} from './types'

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
