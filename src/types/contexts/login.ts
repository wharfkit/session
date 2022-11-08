import {APIClient} from '@greymass/eosio'

import {LoginHook, LoginHooks, LoginHookTypes} from '../hooks'
import {AbstractLoginPlugin} from '../plugins'

export interface LoginContextOptions {
    client: APIClient
    loginPlugins?: AbstractLoginPlugin[]
}

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
