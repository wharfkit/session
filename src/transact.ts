import zlib from 'pako'
import {
    ABIDef,
    AnyAction,
    AnyTransaction,
    API,
    APIClient,
    Checksum256Type,
    Name,
    NameType,
    PermissionLevel,
    Serializer,
    Signature,
} from '@wharfkit/antelope'
import {
    ResolvedSigningRequest,
    ResolvedTransaction,
    SigningRequest,
    SigningRequestEncodingOptions,
} from 'eosio-signing-request'

import {SessionStorage} from './storage'
import {ChainDefinition, Fetch, LocaleDefinitions} from './types'
import {UserInterface} from './ui'
import {ABICacheInterface} from '@wharfkit/abicache'

export type TransactPluginsOptions = Record<string, unknown>

export enum TransactHookTypes {
    beforeSign = 'beforeSign',
    afterSign = 'afterSign',
    afterBroadcast = 'afterBroadcast',
}

export type TransactHookMutable = (
    request: SigningRequest,
    context: TransactContext
) => Promise<TransactHookResponse | void>

export type TransactHookImmutable = (
    result: TransactResult,
    context: TransactContext
) => Promise<TransactHookResponse | void>

export interface TransactHooks {
    afterSign: TransactHookImmutable[]
    beforeSign: TransactHookMutable[]
    afterBroadcast: TransactHookImmutable[]
}

export interface TransactHookResponse {
    request: SigningRequest
    signatures?: Signature[]
}

export type TransactHookResponseType = TransactHookResponse | void

/**
 * Options for creating a new context for a [[Session.transact]] call.
 */
export interface TransactContextOptions {
    abiCache: ABICacheInterface
    appName?: NameType
    chain: ChainDefinition
    client: APIClient
    createRequest: (args: TransactArgs) => Promise<SigningRequest>
    fetch: Fetch
    permissionLevel: PermissionLevel
    storage?: SessionStorage
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    ui?: UserInterface
}

/**
 * Temporary context created for the duration of a [[Session.transact]] call.
 *
 * This context is used to store the state of the transact request and
 * provide a way for plugins to add hooks into the process.
 */
export class TransactContext {
    readonly abiCache: ABICacheInterface
    readonly appName?: string
    readonly chain: ChainDefinition
    readonly client: APIClient
    readonly createRequest: (args: TransactArgs) => Promise<SigningRequest>
    readonly fetch: Fetch
    readonly hooks: TransactHooks = {
        afterBroadcast: [],
        afterSign: [],
        beforeSign: [],
    }
    public info: API.v1.GetInfoResponse | undefined
    readonly permissionLevel: PermissionLevel
    readonly storage?: SessionStorage
    readonly transactPluginsOptions: TransactPluginsOptions
    readonly ui?: UserInterface

    constructor(options: TransactContextOptions) {
        this.abiCache = options.abiCache
        this.appName = String(options.appName)
        this.chain = options.chain
        this.client = options.client
        this.createRequest = options.createRequest
        this.fetch = options.fetch
        this.permissionLevel = options.permissionLevel
        if (options.storage) {
            this.storage = options.storage
        }
        this.transactPluginsOptions = options.transactPluginsOptions || {}
        this.ui = options.ui
        options.transactPlugins?.forEach((plugin: AbstractTransactPlugin) => {
            plugin.register(this)
        })
    }

    get accountName(): Name {
        return this.permissionLevel.actor
    }

    get permissionName(): Name {
        return this.permissionLevel.permission
    }

    get esrOptions(): SigningRequestEncodingOptions {
        return {
            abiProvider: this.abiCache,
            zlib,
        }
    }

    addHook(t: TransactHookTypes, hook: TransactHookMutable | TransactHookImmutable) {
        switch (t) {
            case TransactHookTypes.beforeSign: {
                this.hooks[t].push(hook as TransactHookMutable)
                break
            }
            case TransactHookTypes.afterSign:
            case TransactHookTypes.afterBroadcast: {
                this.hooks[t].push(hook as TransactHookImmutable)
                break
            }
        }
    }

    async getInfo(): Promise<API.v1.GetInfoResponse> {
        let info: API.v1.GetInfoResponse | undefined = this.info
        if (this.info) {
            info = this.info
        } else {
            this.info = info = await this.client.v1.chain.get_info()
        }
        return info
    }

    async resolve(request: SigningRequest, expireSeconds = 120): Promise<ResolvedSigningRequest> {
        // Build the transaction header
        let resolveArgs = {
            chainId: this.chain.id,
        }

        // Check if this request requires tapos generation
        if (request.requiresTapos()) {
            const info = await this.getInfo()
            const header = info.getTransactionHeader(expireSeconds)
            // override resolve args to include tapos headers
            resolveArgs = {
                ...resolveArgs,
                ...header,
            }
        }

        // Load ABIs required to resolve this request
        const abis = await request.fetchAbis(this.abiCache)

        // Resolve the request and return
        return request.resolve(abis, this.permissionLevel, resolveArgs)
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
     * An array of ABIs to use when resolving the transaction.
     */
    abis?: TransactABIDef[]
    /**
     * An optional ABICacheInterface to control how ABIs are loaded.
     */
    abiCache?: ABICacheInterface
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
     * The number of seconds in the future this transaction will expire.
     */
    expireSeconds?: number
    /**
     * Specific transact plugins to use for this transaction.
     */
    transactPlugins?: AbstractTransactPlugin[]
    /**
     * Optional parameters passed in to the various transact plugins.
     */
    transactPluginsOptions?: TransactPluginsOptions
    /**
     * Optional parameter to control whether signatures returned from plugins are validated.
     */
    validatePluginSignatures?: boolean
}

export interface TransactABIDef {
    account: NameType
    abi: ABIDef
}

export interface TransactRevision {
    /**
     * Whether or not the context allowed any modification to take effect.
     */
    allowModify: boolean
    /**
     * The string representation of the code executed.
     */
    code: string
    /**
     * If the request was modified by this code.
     */
    modified: boolean
    /**
     * The response from the code that was executed.
     */
    response: {
        request: string
        signatures: string[]
    }
}

export class TransactRevisions {
    readonly revisions: TransactRevision[] = []
    constructor(request: SigningRequest) {
        this.addRevision({request, signatures: []}, 'original', true)
    }
    addRevision(response: TransactHookResponse, code: string, allowModify: boolean) {
        // Determine if the new response modifies the request
        let modified = false
        const previous = this.revisions[this.revisions.length - 1]
        if (previous) {
            modified = previous.response.request !== String(response.request)
        }
        // Push this revision in to the stack
        this.revisions.push({
            allowModify,
            code: String(code),
            modified,
            response: {
                request: String(response.request),
                signatures: response.signatures ? Serializer.objectify(response.signatures) : [],
            },
        })
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
    /** The response from the API after sending the transaction, only present if transaction was broadcast. */
    response?: {[key: string]: any}
    /** An array containing revisions of the transaction as modified by plugins as ESR payloads */
    revisions: TransactRevisions
    /** The transaction signatures. */
    signatures: Signature[]
    /** The signer authority. */
    signer: PermissionLevel
    /** The resulting transaction. */
    transaction: ResolvedTransaction | undefined
}

/**
 * Interface which a [[Session.transact]] plugin must implement.
 */
export interface TransactPlugin {
    /** A URL friendly (lower case, no spaces, etc) ID for this plugin - Used in serialization */
    get id(): string
    /** Any translations this plugin requires */
    translations?: LocaleDefinitions
    /** A function that registers hooks into the transaction flow */
    register: (context: TransactContext) => void
}

/**
 * Abstract class for [[Session.transact]] plugins to extend.
 */
export abstract class AbstractTransactPlugin implements TransactPlugin {
    translations?: LocaleDefinitions
    abstract register(context: TransactContext): void
    abstract get id(): string
}

export class BaseTransactPlugin extends AbstractTransactPlugin {
    get id() {
        return 'base-transact-plugin'
    }
    register() {
        // console.log('Register hooks via context.addHook')
    }
}
