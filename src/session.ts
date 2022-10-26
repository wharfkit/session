import {APIClient, Name, PermissionLevel, Transaction} from '@greymass/eosio'
import {SigningRequest} from 'eosio-signing-request'
import zlib from 'pako'

import {ChainDefinition, WalletPlugin} from './kit.types'

import {
    AbstractSession,
    SessionOptions,
    TransactArgs,
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

    async createRequest(args: TransactArgs): Promise<SigningRequest> {
        if (args.request && args.request instanceof SigningRequest) {
            return args.request
        } else if (args.request) {
            return SigningRequest.from(args.request, {zlib})
        } else {
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
        const result: TransactResult = {
            chain: this.chain,
            request,
            signatures: [],
            signer: this.permissionLevel,
            transaction,
        }

        if (options?.beforeSignHooks) {
            // Use before-sign hooks specified in the options of this sign call
            options.beforeSignHooks.forEach((hook) => {
                const modifiedRequest = hook.process(transaction, this.context)
                if (options.allowModify) {
                    request = modifiedRequest
                }
            })
        } else {
            // Use before-sign hooks defined within this instance of the SessionKit
            // this.beforeSignHooks.forEach((hook) => {
            //     transaction = hook.process(transaction)
            // })
        }

        // Sign transaction based on wallet plugin
        const signature = await this.wallet.sign(this.chain, transaction)
        result.signatures.push(signature)

        if (options?.afterSignHooks) {
            // Use after-sign hooks specified in the options of this sign call
        } else {
            // Use after-sign hooks defined within this instance of the SessionKit
        }

        if (options?.broadcast) {
            if (options?.beforeBroadcastHooks) {
                // Use before-broadcast hooks specified in the options of this broadcast call
            } else {
                // Use before-broadcast hooks defined within this instance of the SessionKit
            }

            // broadcast transaction

            if (options?.afterBroadcastHooks) {
                // Use after-broadcast hooks specified in the options of this broadcast call
            } else {
                // Use after-broadcast hooks defined within this instance of the SessionKit
            }
        }

        return {
            ...result,
            request, // Pass the transaction that may have been modified by hooks
        }
    }
}
