import {
    AnyAction,
    AnyTransaction,
    APIClient,
    Checksum256Type,
    PermissionLevel,
    PermissionLevelType,
    Signature,
} from '@greymass/eosio'

import {Hook} from './types'

import {ChainDefinition, ChainDefinitionType, WalletPlugin} from './kit.types'
import {ResolvedSigningRequest, ResolvedTransaction, SigningRequest} from 'eosio-signing-request'

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

export interface TransactContextOptions {
    client: APIClient
    session: PermissionLevel
}

export class TransactContext {
    client: APIClient
    session: PermissionLevel
    constructor(options: TransactContextOptions) {
        this.client = options.client
        this.session = options.session
    }
}

export interface SessionOptions {
    chain: ChainDefinitionType
    client?: APIClient
    transactFlow?: TransactFlow
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
    process(request: SigningRequest, context: TransactContext): Promise<TransactHookResponse>
}

export interface TransactHookResponse {
    request: SigningRequest
    signatures?: Signature[]
}

export interface TransactHooks {
    afterSign: AfterSignHook[]
    beforeSign: BeforeSignHook[]
    afterBroadcast: AfterBroadcastHook[]
    beforeBroadcast: BeforeBroadcastHook[]
}

export interface TransactOptionsHooks {
    afterSign?: AfterSignHook[]
    beforeSign?: BeforeSignHook[]
    afterBroadcast?: AfterBroadcastHook[]
    beforeBroadcast?: BeforeBroadcastHook[]
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
     * Hooks to use for this transaction.
     */
    transactFlow?: TransactFlow
    /**
     * Whether to allow the signer to make modifications to the request
     * (e.g. applying a cosigner action to pay for resources).
     *
     * Defaults to true if [[broadcast]] is true or unspecified; otherwise false.
     */
    allowModify?: boolean
    /**
     * Specific hooks to use for this transaction.
     */
    hooks?: TransactOptionsHooks
}

export interface TransactFlow {
    beforeSign(request: SigningRequest, context: TransactContext): Promise<TransactHookResponse>
    afterSign(request: SigningRequest, context: TransactContext): Promise<TransactHookResponse>
    beforeBroadcast(
        request: SigningRequest,
        context: TransactContext
    ): Promise<TransactHookResponse>
    afterBroadcast(request: SigningRequest, context: TransactContext): Promise<TransactHookResponse>
}

export class BaseTransactFlow implements TransactFlow {
    async beforeSign(
        request: SigningRequest
        // context: TransactContext
    ): Promise<TransactHookResponse> {
        return {
            request,
        }
    }
    async afterSign(
        request: SigningRequest
        // context: TransactContext
    ): Promise<TransactHookResponse> {
        return {
            request,
        }
    }
    async beforeBroadcast(
        request: SigningRequest
        // context: TransactContext
    ): Promise<TransactHookResponse> {
        return {
            request,
        }
    }
    async afterBroadcast(
        request: SigningRequest
        // context: TransactContext
    ): Promise<TransactHookResponse> {
        return {
            request,
        }
    }
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
