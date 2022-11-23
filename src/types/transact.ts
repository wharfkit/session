import {
    AnyAction,
    AnyTransaction,
    APIClient,
    Checksum256Type,
    PermissionLevel,
    Signature,
} from '@greymass/eosio'

import {ResolvedSigningRequest, ResolvedTransaction, SigningRequest} from 'eosio-signing-request'

import {ChainDefinition} from '../types'
import {TransactHook, TransactHooks, TransactHookTypes} from './hook'

export type TransactPluginsOptions = Record<string, unknown>

/**
 * Options for creating a new context for a [[Session.transact]] call.
 */
export interface TransactContextOptions {
    client: APIClient
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
    client: APIClient
    hooks: TransactHooks = {
        afterBroadcast: [],
        afterSign: [],
        beforeBroadcast: [],
        beforeSign: [],
    }
    session: PermissionLevel
    transactPluginsOptions: TransactPluginsOptions
    constructor(options: TransactContextOptions) {
        this.client = options.client
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
    /** The transaction signatures. */
    signatures: Signature[]
    /** The signer authority. */
    signer: PermissionLevel
    /** The resulting transaction. */
    transaction: ResolvedTransaction | undefined
    /** Push transaction response from api node, only present if transaction was broadcast. */
    processed?: {[key: string]: any}
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
