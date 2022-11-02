import {ABIDef, APIClient, Name, PermissionLevel} from '@greymass/eosio'
import {AbiProvider, SigningRequest} from 'eosio-signing-request'
import zlib from 'pako'

import {ChainDefinition, WalletPlugin} from './kit.types'

import {
    AbstractSession,
    SessionContext,
    SessionOptions,
    TransactArgs,
    TransactContext,
    TransactHooks,
    TransactOptions,
    TransactResult,
} from './session.types'

const defaultHooks = {
    afterBroadcast: [],
    afterSign: [],
    beforeBroadcast: [],
    beforeSign: [],
}

export class Session extends AbstractSession {
    readonly chain: ChainDefinition
    readonly context: SessionContext
    readonly hooks: TransactHooks
    readonly permissionLevel: PermissionLevel
    readonly wallet: WalletPlugin

    constructor(options: SessionOptions) {
        super()
        this.chain = ChainDefinition.from(options.chain)
        let client: APIClient
        if (options.client) {
            client = options.client
        } else {
            /* istanbul ignore next */
            client = new APIClient({url: this.chain.url})
        }
        this.hooks = defaultHooks
        if (options.hooks) {
            this.hooks = {
                ...defaultHooks,
                ...options.hooks,
            }
        }
        this.context = new SessionContext({client})
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
                const response = await this.context.client.v1.chain.get_abi(account)
                if (!response.abi) {
                    throw new Error('could not load abi')
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

    async transact(args: TransactArgs, options?: TransactOptions): Promise<TransactResult> {
        // The context for this transaction
        const context = new TransactContext({
            client: this.context.client,
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

        // Determine which set of hooks to use, with hooks specified in the options taking priority
        const afterBroadcastHooks = options?.hooks?.afterBroadcast || this.hooks.afterBroadcast
        const afterSignHooks = options?.hooks?.afterBroadcast || this.hooks.afterSign
        const beforeBroadcastHooks = options?.hooks?.beforeBroadcast || this.hooks.beforeBroadcast
        const beforeSignHooks = options?.hooks?.beforeSign || this.hooks.beforeSign

        // Run the `beforeSign` hooks
        beforeSignHooks.forEach(async (hook) => {
            // TODO: Verify we should be cloning the requests here, and write tests to verify they cannot be modified
            const response = await hook.process(result.request.clone(), context)
            if (allowModify) {
                result.request = response.request
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
        afterSignHooks.forEach(async (hook) => await hook.process(result.request.clone(), context))

        if (options?.broadcast) {
            // Run the `beforeBroadcast` hooks
            beforeBroadcastHooks.forEach(
                async (hook) => await hook.process(result.request.clone(), context)
            )

            // broadcast transaction
            // TODO: Implement broadcast

            // Run the `afterBroadcast` hooks
            afterBroadcastHooks.forEach(
                async (hook) => await hook.process(result.request.clone(), context)
            )
        }

        return result
    }
}
