import {Name, PermissionLevel, Signature} from '@greymass/eosio'
import {ResolvedSigningRequest} from 'eosio-signing-request'
import {ChainDefinition} from '../types'

import {SessionOptions} from './session'

export interface WalletPluginOptions {
    name?: string
}

export interface WalletPluginLoginOptions {
    appName: Name
    chains: ChainDefinition[]
    context: SessionOptions
}

export interface WalletPluginLoginResponse {
    chain: ChainDefinition
    permissionLevel: PermissionLevel
}

export interface WalletPlugin {
    login(options: WalletPluginLoginOptions): WalletPluginLoginResponse
    sign(chain: ChainDefinition, transaction: ResolvedSigningRequest): Signature
}

export abstract class AbstractWalletPlugin implements WalletPlugin {
    public abstract login(options: WalletPluginLoginOptions): WalletPluginLoginResponse
    public abstract sign(chain: ChainDefinition, transaction: ResolvedSigningRequest): Signature
}
