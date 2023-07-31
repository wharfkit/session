import {Checksum256, Checksum256Type, PermissionLevel, Signature, Struct} from '@wharfkit/antelope'
import {Logo} from '@wharfkit/common'
import type {LocaleDefinitions} from '@wharfkit/common'
import {ResolvedSigningRequest} from '@wharfkit/signing-request'

import {LoginContext} from './login'
import {TransactContext} from './transact'

/**
 * The static configuration of a [[WalletPlugin]].
 */
export interface WalletPluginConfig {
    /**
     * Indicates if the pp requires the user to manually select the blockchain to authorize against.
     */
    requiresChainSelect: boolean
    /**
     * Indicates if the [[WalletPlugin]] requires the user to select a permission to use from a list.
     */
    requiresPermissionSelect: boolean
    /**
     * Indicates if the [[WalletPlugin]] requires the user to manually enter a permission to use.
     */
    requiresPermissionEntry?: boolean
    /**
     * If set, indicates which blockchains are compatible with this [[WalletPlugin]].
     */
    supportedChains?: Checksum256Type[]
}

/**
 * The metadata of a [[WalletPlugin]] for display purposes.
 */
@Struct.type('wallet_plugin_metadata')
export class WalletPluginMetadata extends Struct {
    /**
     * A display name for the wallet that is presented to users.
     */
    @Struct.field('string', {optional: true}) declare name?: string
    /**
     * A wallet description to further identify the wallet for users.
     */
    @Struct.field('string', {optional: true}) declare description?: string
    /**
     * Wallet branding
     */
    @Struct.field(Logo, {optional: true}) declare logo?: Logo
    /**
     * Link to the homepage for the wallet
     */
    @Struct.field('string', {optional: true}) declare homepage?: string
    /**
     * Link to the download page for the wallet
     */
    @Struct.field('string', {optional: true}) declare download?: string
    /**
     * The public key being used by the wallet plugin
     */
    @Struct.field('string', {optional: true}) declare publicKey?: string

    static from(data) {
        return new WalletPluginMetadata({
            ...data,
            logo: data.logo ? Logo.from(data.logo) : undefined,
        })
    }
}

/**
 * The response for a login call of a [[WalletPlugin]].
 */
export interface WalletPluginLoginResponse {
    chain: Checksum256
    permissionLevel: PermissionLevel
}

/**
 * The response for a sign call of a [[WalletPlugin]].
 */
export interface WalletPluginSignResponse {
    resolved?: ResolvedSigningRequest
    signatures: Signature[]
}

/**
 * Persistent storage format for wallet specified data.
 */
export type WalletPluginData = Record<string, any>

/**
 * The serialized form of a [[WalletPlugin]] instance.
 */
export interface SerializedWalletPlugin {
    id: string
    data: WalletPluginData
}

/**
 * Interface which all 3rd party wallet plugins must implement.
 */
export interface WalletPlugin {
    /** A URL friendly (lower case, no spaces, etc) ID for this plugin - Used in serialization */
    get id(): string
    /** A method to return the data that needs to persist for the plguin - Used in serialization */
    get data(): WalletPluginData
    set data(data: WalletPluginData)
    /** The [[SessionKit]] configuration parameters for this [[WalletPlugin]]. */
    config: WalletPluginConfig
    /** The metadata for the [[WalletPlugin]] itself. */
    metadata: WalletPluginMetadata
    /** Any translations this plugin requires */
    translations?: LocaleDefinitions
    /**
     * Request the [[WalletPlugin]] to log in a user and return a [[WalletPluginLoginResponse]].
     *
     * @param context The [[LoginContext]] for the [[WalletPlugin]] to use.
     */
    login(context: LoginContext): Promise<WalletPluginLoginResponse>
    /**
     * Requests the [[WalletPlugin]] to sign a transaction and return a [[WalletPluginSignResponse]]]
     *
     * @param transaction The transaction to sign.
     * @param context The [[TransactContext]] for the [[WalletPlugin]] to use.
     */
    sign(
        transaction: ResolvedSigningRequest,
        context: TransactContext
    ): Promise<WalletPluginSignResponse>
    /**
     * Serialize the [[WalletPlugin]] ID and data into a plain object.
     */
    serialize(): WalletPluginData
}

/**
 * Abstract class which all 3rd party [[WalletPlugin]] implementations may extend.
 */
export abstract class AbstractWalletPlugin implements WalletPlugin {
    _data: WalletPluginData = {}
    config: WalletPluginConfig = {
        requiresChainSelect: true,
        requiresPermissionSelect: false,
        requiresPermissionEntry: false,
    }
    metadata: WalletPluginMetadata = new WalletPluginMetadata({})
    translations?: LocaleDefinitions
    abstract get id(): string
    abstract login(context: LoginContext): Promise<WalletPluginLoginResponse>
    abstract sign(
        transaction: ResolvedSigningRequest,
        context: TransactContext
    ): Promise<WalletPluginSignResponse>
    get data(): WalletPluginData {
        return this._data
    }
    set data(data: WalletPluginData) {
        this._data = data
    }
    serialize(): SerializedWalletPlugin {
        return {
            id: this.id,
            data: this.data,
        }
    }
}
