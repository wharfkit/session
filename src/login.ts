import {APIClient, FetchProvider, Name, PermissionLevel} from '@greymass/eosio'
import {SigningRequestEncodingOptions} from 'eosio-signing-request'
import zlib from 'pako'

import {ChainDefinition, Fetch} from './types'
import {UserInterface} from './ui'
import {WalletPluginConfig, WalletPluginMetadata} from './wallet'

export enum LoginHookTypes {
    beforeLogin = 'beforeLogin',
    afterLogin = 'afterLogin',
}

export type LoginHook = (context: LoginContext) => Promise<void>

export interface LoginHooks {
    afterLogin: LoginHook[]
    beforeLogin: LoginHook[]
}

/**
 * Options for creating a new context for a [[Kit.login]] call.
 */
export interface LoginContextOptions {
    appName?: Name
    // client: APIClient
    chain?: ChainDefinition
    chains?: ChainDefinition[]
    fetch: Fetch
    loginPlugins?: AbstractLoginPlugin[]
    permissionLevel?: PermissionLevel
    walletPlugins?: UserInterfaceWalletPlugin[]
    ui: UserInterface
}

export interface UserInterfaceRequirements {
    requiresChainSelect: boolean
    requiresPermissionSelect: boolean
    requiresPermissionEntry: boolean
    requiresWalletSelect: boolean
}

export interface UserInterfaceWalletPlugin {
    config: WalletPluginConfig
    metadata: WalletPluginMetadata
}

/**
 * Temporary context created for the duration of a [[Kit.login]] call.
 *
 * This context is used to store the state of the login request and
 * provide a way for plugins to add hooks into the process.
 */
export class LoginContext {
    appName: Name | undefined
    // client: APIClient
    chain?: ChainDefinition
    chains: ChainDefinition[] = []
    fetch: Fetch
    hooks: LoginHooks = {
        afterLogin: [],
        beforeLogin: [],
    }
    permissionLevel?: PermissionLevel
    ui: UserInterface
    uiRequirements: UserInterfaceRequirements = {
        requiresChainSelect: true,
        requiresPermissionSelect: true,
        requiresPermissionEntry: false,
        requiresWalletSelect: true,
    }
    walletPlugins: UserInterfaceWalletPlugin[] = []
    constructor(options: LoginContextOptions) {
        this.appName = options.appName
        // this.client = options.client
        if (options.chains) {
            this.chains = options.chains
        }
        if (options.chain) {
            this.chain = options.chain
        }
        this.fetch = options.fetch
        this.permissionLevel = options.permissionLevel
        this.walletPlugins = options.walletPlugins || []
        this.ui = options.ui
        options.loginPlugins?.forEach((plugin: AbstractLoginPlugin) => {
            plugin.register(this)
        })
    }
    addHook(t: LoginHookTypes, hook: LoginHook) {
        this.hooks[t].push(hook)
    }
    getClient(chain: ChainDefinition): APIClient {
        return new APIClient({provider: new FetchProvider(chain.url, {fetch: this.fetch})})
    }
    get esrOptions(): SigningRequestEncodingOptions {
        return {
            zlib,
        }
    }
}

/**
 * Payload accepted by the [[Kit.login]] method.
 */
export interface LoginPlugin {
    register: (context: LoginContext) => void
}

/**
 * Abstract class for [[Kit.login]] plugins to extend.
 */
export abstract class AbstractLoginPlugin implements LoginPlugin {
    abstract register(context: LoginContext): void
}

export class BaseLoginPlugin extends AbstractLoginPlugin {
    register() {
        // console.log('Register hooks via context.addHook')
    }
}
