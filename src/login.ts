import {ChainDefinition} from './types'
import {UserInterface} from './ui'
import {WalletPluginMetadata} from './wallet'

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
    // client: APIClient
    chain?: ChainDefinition
    chains?: ChainDefinition[]
    loginPlugins?: AbstractLoginPlugin[]
    walletPlugins?: WalletPluginMetadata[]
    ui: UserInterface
}

/**
 * Temporary context created for the duration of a [[Kit.login]] call.
 *
 * This context is used to store the state of the login request and
 * provide a way for plugins to add hooks into the process.
 */
export class LoginContext {
    // client: APIClient
    chain?: ChainDefinition
    chains: ChainDefinition[] = []
    hooks: LoginHooks = {
        afterLogin: [],
        beforeLogin: [],
    }
    ui: UserInterface
    walletPlugins: WalletPluginMetadata[] = []
    constructor(options: LoginContextOptions) {
        // this.client = options.client
        if (options.chains) {
            this.chains = options.chains
        }
        if (options.chain) {
            this.chain = options.chain
        }
        this.walletPlugins = options.walletPlugins || []
        this.ui = options.ui
        options.loginPlugins?.forEach((plugin: AbstractLoginPlugin) => {
            plugin.register(this)
        })
    }
    addHook(t: LoginHookTypes, hook: LoginHook) {
        this.hooks[t].push(hook)
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
