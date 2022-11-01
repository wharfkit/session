import {
    Checksum256,
    Checksum256Type,
    Name,
    NameType,
    PermissionLevel,
    PermissionLevelType,
    Signature,
    Struct,
} from '@greymass/eosio'
import {ResolvedSigningRequest} from 'eosio-signing-request'

import {Session} from './session'
import {SessionOptions, TransactOptionsHooks} from './session.types'
import {Fetch, Hook} from './types'

export abstract class AbstractSessionKit {
    abstract login(options?: LoginOptions): Promise<Session>
}

@Struct.type('chain_definition')
export class ChainDefinition extends Struct {
    @Struct.field('checksum256') declare id: Checksum256
    @Struct.field('string') declare url: string
}

export type ChainDefinitionType = ChainDefinition | {id: Checksum256Type; url: string}

export interface SessionKitOptions {
    appName: NameType
    chains: ChainDefinitionType[]
    fetch?: Fetch
    loginHooks?: LoginOptionsHooks
    transactHooks?: TransactOptionsHooks
    walletPlugins: WalletPlugin[]
}

export interface LoginHook extends Hook {
    process(context: SessionOptions): void
}
export interface BeforeLoginHook extends LoginHook {}
export interface AfterLoginHook extends LoginHook {}

export interface LoginHooks {
    afterLogin: AfterLoginHook[]
    beforeLogin: BeforeLoginHook[]
}

export interface LoginOptions {
    afterLoginHooks?: AfterLoginHook[]
    beforeLoginHooks?: BeforeLoginHook[]
    chain?: Checksum256Type
    hooks?: LoginOptionsHooks
    permissionLevel?: PermissionLevelType | string
    walletPlugin?: WalletPlugin
}

export interface LoginOptionsHooks {
    afterLogin?: AfterLoginHook[]
    beforeLogin?: BeforeLoginHook[]
}

export interface WalletPluginOptions {
    name?: string
}

export interface WalletPluginLoginOptions {
    appName: Name
    chains: ChainDefinition[]
    context: SessionOptions
}

export interface WalletPlugin {
    login(options: WalletPluginLoginOptions): WalletPluginLoginResponse
    sign(chain: ChainDefinition, transaction: ResolvedSigningRequest): Signature
}

export interface WalletPluginLoginResponse {
    chain: ChainDefinition
    permissionLevel: PermissionLevel
    walletPlugin: AbstractWalletPlugin
}

export abstract class AbstractWalletPlugin {}
