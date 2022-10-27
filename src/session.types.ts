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
import {ChainDefinition, ChainDefinitionType, WalletPlugin} from './kit.types'
import {SigningRequest} from 'eosio-signing-request'

export abstract class AbstractSession {
    /**
     * Transact using this session. See [[Session.transact]].
     */
    abstract transact(args: TransactArgs, options?: TransactOptions): Promise<TransactResult>
}

export interface SessionContextOptions {
    client: APIClient
}

export class SessionContext {
    client: APIClient
    constructor(options: SessionContextOptions) {
        this.client = options.client
    }
}

export interface SessionOptions {
    chain: ChainDefinitionType
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
    /** An ESR payload */
    request?: SigningRequest | string
}

export interface TransactHook extends Hook {
    process(request: SigningRequest, context: SessionContext): SigningRequest
}

export interface TransactHooks {
    afterSign: AfterSignHook[]
    beforeSign: BeforeSignHook[]
    afterBroadcast: AfterBroadcastHook[]
    beforeBroadcast: BeforeBroadcastHook[]
}

export interface SignHook extends TransactHook {}
export interface BeforeSignHook extends SignHook {}
export interface AfterSignHook extends SignHook {}

export interface BroadcastHook extends TransactHook {}
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
 * The response frmo a [[Session.transact]] call.
 */
export interface TransactResult {
    /** The chain that was used. */
    chain: ChainDefinition
    /** The SigningRequest representation of the transaction. */
    request: SigningRequest
    /** The transaction signatures. */
    signatures: Signature[]
    /** The signer authority. */
    signer: PermissionLevel
    /** The resulting transaction. */
    transaction: Transaction
    /** Push transaction response from api node, only present if transaction was broadcast. */
    processed?: {[key: string]: any}
}
