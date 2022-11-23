import {APIClient, Checksum256Type, NameType, PermissionLevelType} from '@greymass/eosio'

import {ChainDefinitionType, Fetch} from '../types'
import {LoginPlugin} from './login'
import {TransactPlugin, TransactPluginsOptions} from './transact'
import {WalletPlugin} from './wallet'

export interface LoginOptions {
    chain?: Checksum256Type
    client?: APIClient
    loginPlugins?: LoginPlugin[]
    transactPlugins?: TransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    permissionLevel?: PermissionLevelType | string
    walletPlugin?: WalletPlugin
}

export interface SessionKitOptions {
    appName: NameType
    chains: ChainDefinitionType[]
    fetch?: Fetch
    loginPlugins?: LoginPlugin[]
    transactPlugins?: TransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    walletPlugins: WalletPlugin[]
}
