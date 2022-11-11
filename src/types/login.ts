import {APIClient} from '@greymass/eosio'

import {LoginHook, LoginHooks, LoginHookTypes} from './hook'

/**
 * Options for creating a new context for a [[Kit.login]] call.
 */
export interface LoginContextOptions {
    client: APIClient
    loginPlugins?: AbstractLoginPlugin[]
}

/**
 * Temporary context created for the duration of a [[Kit.login]] call.
 *
 * This context is used to store the state of the login request and
 * provide a way for plugins to add hooks into the process.
 */
export class LoginContext {
    client: APIClient
    hooks: LoginHooks = {
        afterLogin: [],
        beforeLogin: [],
    }
    constructor(options: LoginContextOptions) {
        this.client = options.client
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
    public abstract register(context: LoginContext): void
}
