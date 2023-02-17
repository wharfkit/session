import {
    Checksum256,
    Checksum256Type,
    Name,
    PermissionLevel,
    PermissionLevelType,
    Signature,
} from '@greymass/eosio'
import {ResolvedSigningRequest, SigningRequest} from 'eosio-signing-request'
import {LoginContext} from './login'
import {TransactContext} from './transact'
import {ChainDefinition} from './types'

export interface WalletPluginOptions {
    name?: string
}

export interface WalletPluginContext {
    chain: ChainDefinition
    permissionLevel: PermissionLevelType | string
}

export interface WalletPluginLoginOptions {
    appName: Name
    chain?: ChainDefinition
    chains: ChainDefinition[]
    permissionLevel?: PermissionLevel
}

/**
 * The response required for a login call by a walletPlugin.
 */
export interface WalletPluginLoginResponse {
    /**
     * The chain
     */
    chain: Checksum256
    permissionLevel: PermissionLevel
}

export interface WalletPluginSignResponse {
    request?: SigningRequest
    signatures: Signature[]
}

export interface WalletPluginConfig {
    /**
     * Indicates if the pp requires the user to manually select the blockchain to authorize against.
     */
    requiresChainSelect: boolean
    /**
     * Indicates if the [[WalletPlugin]] requires the user to manually select a permission to use.
     */
    requiresPermissionSelect: boolean
    /**
     * If set, indicates which blockchains are compatible with this [[WalletPlugin]].
     */
    supportedChains?: Checksum256Type[]
}

export interface WalletPluginMetadata {
    /**
     * Display name for the wallet that is presented to users.
     */
    name?: string
    /**
     * Wallet description to further identify the wallet for users.
     */
    description?: string
    /**
     * Wallet branding
     */
    logo?: string
    /**
     * Link to the homepage for the wallet
     */
    homepage?: string
    /**
     * Link to the download page for the wallet
     */
    download?: string
}

export interface WalletPlugin {
    config: WalletPluginConfig
    metadata: WalletPluginMetadata
    get name(): string
    login(
        context: LoginContext,
        options: WalletPluginLoginOptions
    ): Promise<WalletPluginLoginResponse>
    sign(
        transaction: ResolvedSigningRequest,
        context: TransactContext
    ): Promise<WalletPluginSignResponse>
    serialize(): Record<string, any>
}

export abstract class AbstractWalletPlugin implements WalletPlugin {
    config: WalletPluginConfig = {
        requiresChainSelect: true,
        requiresPermissionSelect: false,
    }
    metadata: WalletPluginMetadata = {}
    abstract get name(): string
    abstract login(
        context: LoginContext,
        options: WalletPluginLoginOptions
    ): Promise<WalletPluginLoginResponse>
    abstract sign(
        transaction: ResolvedSigningRequest,
        context: TransactContext
    ): Promise<WalletPluginSignResponse>
    abstract serialize(): Record<string, any>
}
