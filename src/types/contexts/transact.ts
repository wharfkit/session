import {APIClient, PermissionLevel} from '@greymass/eosio'

import {TransactHook, TransactHooks, TransactHookTypes} from '../hooks'
import {AbstractTransactPlugin} from '../plugins'

export interface TransactContextOptions {
    client: APIClient
    session: PermissionLevel
    transactPlugins?: AbstractTransactPlugin[]
}

export class TransactContext {
    client: APIClient
    hooks: TransactHooks = {
        afterBroadcast: [],
        afterSign: [],
        beforeBroadcast: [],
        beforeSign: [],
    }
    session: PermissionLevel
    constructor(options: TransactContextOptions) {
        this.client = options.client
        this.session = options.session
        options.transactPlugins?.forEach((plugin: AbstractTransactPlugin) => {
            plugin.register(this)
        })
    }
    addHook(t: TransactHookTypes, hook: TransactHook) {
        this.hooks[t].push(hook)
    }
}
