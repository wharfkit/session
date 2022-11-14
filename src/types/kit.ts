import {Checksum256Type, NameType, PermissionLevelType} from '@greymass/eosio'

import {ChainDefinitionType, Fetch} from '../types'
import {LoginPlugin} from './login'
import {TransactPlugin} from './transact'
import {WalletPlugin} from './wallet'

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
