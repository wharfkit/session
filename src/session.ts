import {AnyTransaction, Checksum256, Name, PermissionLevel, Transaction} from '@greymass/eosio'

import {ChainDefinition, WalletPlugin} from './kit.types'

import {AbstractSession, SessionOptions, TransactOptions, TransactResult} from './session.types'

export class SessionContext {}

export class Session extends AbstractSession {
    readonly chain: ChainDefinition
    readonly context: SessionContext
    readonly permissionLevel: PermissionLevel
    readonly wallet: WalletPlugin

    constructor(options: SessionOptions) {
        super()
        this.chain = ChainDefinition.from(options.chain)
        this.context = new SessionContext()
        this.permissionLevel = PermissionLevel.from(options.permissionLevel)
        this.wallet = options.walletPlugin
    }

    get account(): Name {
        return this.permissionLevel.actor
    }

    get permission(): Name {
        return this.permissionLevel.permission
    }

    async transact(tx: AnyTransaction, options?: TransactOptions): Promise<TransactResult> {
        let transaction: Transaction = Transaction.from(tx)
        const result: TransactResult = {
            chain: this.chain,
            signatures: [],
            signer: this.permissionLevel,
            transaction,
        }

        if (options?.beforeSignHooks) {
            // Use before-sign hooks specified in the options of this sign call
            options.beforeSignHooks.forEach((hook) => {
                const modifiedTransaction = hook.process(transaction, this.context)
                if (options.allowModify) {
                    transaction = Transaction.from(modifiedTransaction)
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
            transaction, // Pass the transaction that may have been modified by hooks
        }
    }
}
