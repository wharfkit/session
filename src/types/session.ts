import {APIClient, PermissionLevelType} from '@greymass/eosio'

import {ChainDefinitionType, Fetch} from '../types'
import {AbstractTransactPlugin, TransactPluginsOptions} from './transact'
import {WalletPlugin} from './wallet'

/**
 * Options for creating a new instance of a [[Session]].
 */
export interface SessionOptions {
    chain: ChainDefinitionType
    client?: APIClient
    fetch?: Fetch
    permissionLevel: PermissionLevelType | string
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    walletPlugin: WalletPlugin
}
