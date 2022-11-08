import {APIClient, PermissionLevelType} from '@greymass/eosio'

import {TransactArgs, TransactOptions, TransactResult} from './transact'
import {AbstractTransactPlugin, WalletPlugin} from './plugins'
import {ChainDefinitionType} from '../types'

export abstract class AbstractSession {
    /**
     * Transact using this session. See [[Session.transact]].
     */
    abstract transact(args: TransactArgs, options?: TransactOptions): Promise<TransactResult>
}

export interface SessionOptions {
    chain: ChainDefinitionType
    client?: APIClient
    transactPlugins?: AbstractTransactPlugin[]
    permissionLevel: PermissionLevelType | string
    walletPlugin: WalletPlugin
}
