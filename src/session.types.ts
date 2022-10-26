import {
    AnyAction,
    AnyTransaction,
    APIClient,
    Checksum256Type,
    PermissionLevel,
    PermissionLevelType,
    Signature,
    Transaction,
} from '@greymass/eosio'

import {Hook} from './types'

import {SessionContext} from './session'
import {ChainDefinition, WalletPlugin} from './kit.types'

export abstract class AbstractSession {
    /**
     * Transact using this session. See [[Session.transact]].
     */
    abstract transact(args: TransactArgs, options?: TransactOptions): Promise<TransactResult>
}

export interface SessionOptions {
    chain: ChainDefinition
    client?: APIClient
    permissionLevel: PermissionLevelType | string
    walletPlugin: WalletPlugin
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
}

export interface TransactHook extends Hook {
    process(transaction: Transaction, context: SessionContext): Transaction
}

export interface TransactHooks {
    afterSign: AfterSignHook[]
    beforeSign: BeforeSignHook[]
    afterBroadcast: AfterBroadcastHook[]
    beforeBroadcast: BeforeBroadcastHook[]
}

export interface BeforeSignHook extends TransactHook {}
export interface AfterSignHook extends TransactHook {}

export interface BroadcastHook extends Hook {}
export interface BeforeBroadcastHook extends BroadcastHook {}
export interface AfterBroadcastHook extends BroadcastHook {}

/**
 * Options for the [[Session.transact]] method.
 */
export interface TransactOptions {
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
     * Whether to allow the signer to make modifications to the request
     * (e.g. applying a cosigner action to pay for resources).
     *
     * Defaults to true if [[broadcast]] is true or unspecified; otherwise false.
     */
    allowModify?: boolean
    /**
     * Hooks to execute against a transaction before signing.
     */
    beforeSignHooks?: BeforeSignHook[]
    /**
     * Hooks to execute against a transaction after signing.
     */
    afterSignHooks?: AfterSignHook[]
    /**
     * Hooks to execute against a transaction before broadcasting.
     */
    beforeBroadcastHooks?: BeforeBroadcastHook[]
    /**
     * Hooks to execute against a transaction after broadcasting.
     */
    afterBroadcastHooks?: AfterBroadcastHook[]
}

/**
 * The result of a [[Session.transact]] call.
 */
export interface TransactResult {
    /** The chain that was used. */
    chain: ChainDefinition
    /** The transaction signatures. */
    signatures: Signature[]
    /** The signer authority. */
    signer: PermissionLevel
    /** The resulting transaction. */
    transaction: Transaction
    /** Push transaction response from api node, only present if transaction was broadcast. */
    processed?: {[key: string]: any}
}
