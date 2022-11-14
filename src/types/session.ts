import {APIClient, PermissionLevelType} from '@greymass/eosio'

import {ChainDefinitionType} from '../types'
import {AbstractTransactPlugin, TransactPluginsOptions} from './transact'
import {WalletPlugin} from './wallet'

/**
 * Options for creating a new instance of a [[Session]].
 */
export interface SessionOptions {
    chain: ChainDefinitionType
    client?: APIClient
    permissionLevel: PermissionLevelType | string
    transactPlugins?: AbstractTransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    walletPlugin: WalletPlugin
}
