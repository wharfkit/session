import {Checksum256Type, NameType, PermissionLevelType} from '@greymass/eosio'

import {Session} from '../session'
import {ChainDefinitionType, Fetch} from '../types'

import {LoginPlugin, TransactPlugin, WalletPlugin} from './plugins'

export abstract class AbstractSessionKit {
    abstract login(options?: LoginOptions): Promise<Session>
}

export interface LoginOptions {
    chain?: Checksum256Type
    loginPlugins?: LoginPlugin[]
    transactPlugins?: TransactPlugin[]
    permissionLevel?: PermissionLevelType | string
    walletPlugin?: WalletPlugin
}

export interface SessionKitOptions {
    appName: NameType
    chains: ChainDefinitionType[]
    fetch?: Fetch
    loginPlugins?: LoginPlugin[]
    transactPlugins?: TransactPlugin[]
    walletPlugins: WalletPlugin[]
}
