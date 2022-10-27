import {
    //ABI,
    APIClient,
    Name,
    PermissionLevel,
    Transaction,
} from '@greymass/eosio'
import {
    //AbiMap,
    SigningRequest,
} from 'eosio-signing-request'
import zlib from 'pako'

import {ChainDefinition, WalletPlugin} from './kit.types'

import {
    AbstractSession,
    SessionOptions,
    TransactArgs,
    TransactHooks,
    TransactOptions,
    TransactResult,
} from './session.types'

export interface SessionContextOptions {
    client: APIClient
}

export class SessionContext {
    client: APIClient
    constructor(options: SessionContextOptions) {
        this.client = options.client
    }
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
            client = new APIClient({url: this.chain.url})
        }
        // TODO: Implement passing of default hooks into the session
        this.hooks = {
            afterBroadcast: [],
            afterSign: [],
            beforeBroadcast: [],
            beforeSign: [],
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
        if (args.request && args.request instanceof SigningRequest) {
            return args.request
        } else if (args.request) {
            return SigningRequest.from(args.request, {zlib})
        } else {
            args = this.upgradeTransaction(args)
            const request = await SigningRequest.create(
                {
                    ...args,
                    chainId: this.chain.id,
                },
                {zlib}
            )
            return request
        }
    }

    async transact(args: TransactArgs, options?: TransactOptions): Promise<TransactResult> {
        let request: SigningRequest = await this.createRequest(args)
        const transaction: Transaction = request.getRawTransaction()

        // TODO: Needs to resolve request with current session
        // const abis: Map<string, ABI> = new Map()
        // transaction.actions.forEach(async (action) => {
        //     const abi = await this.context.client.v1.chain.get_abi(action.account)
        //     if (abi.abi) {
        //         abis.set(String(action.account), ABI.from(abi.abi))
        //     }
        // })
        // const resolved = request.resolve(abis, this.permissionLevel)
        // console.log(resolved)

        // Response to the transact call
        const result: TransactResult = {
            chain: this.chain,
            request,
            signatures: [],
            signer: this.permissionLevel,
            transaction,
        }

        // Whether or not the request should be able to be modified by beforeSign hooks
        const allowModify = options?.allowModify ?? true

        // Determine which set of hooks to use, with hooks specified in the options taking priority
        const beforeSignHooks = options?.beforeSignHooks || this.hooks.beforeSign
        const afterSignHooks = options?.afterSignHooks || this.hooks.afterSign
        const beforeBroadcastHooks = options?.beforeBroadcastHooks || this.hooks.beforeBroadcast
        const afterBroadcastHooks = options?.afterBroadcastHooks || this.hooks.afterBroadcast

        // Run the beforeSign hooks
        beforeSignHooks.forEach(async (hook) => {
            const modifiedRequest = await hook.process(request, this.context)
            if (allowModify) {
                request = modifiedRequest
            }
        })

        // Sign transaction based on wallet plugin
        const signature = await this.wallet.sign(this.chain, transaction)
        result.signatures.push(signature)

        // Run the afterSign hooks
        afterSignHooks.forEach(async (hook) => await hook.process(request, this.context))

        if (options?.broadcast) {
            // Run the beforeBroadcast hooks
            beforeBroadcastHooks.forEach(async (hook) => await hook.process(request, this.context))

            // broadcast transaction
            // TODO: Implement broadcast

            // Run the afterBroadcast hooks
            afterBroadcastHooks.forEach(async (hook) => await hook.process(request, this.context))
        }

        return {
            ...result,
            request, // Pass the transaction that may have been modified by hooks
        }
    }
}
