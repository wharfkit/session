import {Checksum256, Checksum256Type, NameType, PermissionLevel, PublicKey} from '@wharfkit/antelope'
import { LocaleDefinitions } from '.'

/**
 * The static configuration of an [[AccountCreationPlugin]].
 */
export interface AccountCreationPluginConfig {
    /**
     * Indicates if the pp requires the user to manually select the blockchain to authorize against.
     */
    requiresChainSelect: boolean
    /**
     * Indicates if the [[AccountCreationPlugin]] requires the user to select an account name to use from a list.
     */
    requiresAccountNameSelect?: boolean
    /**
     * If set, indicates which blockchains are compatible with this [[AccountCreationPlugin]].
     */
    supportedChains?: Checksum256Type[]
    /**
     * Indicates the return url to be used to return users to the site after the account creation service is used.
     */
    returnUrl?: string
}

/**
 * The metadata of an [[AccountCreationPlugin]] for display purposes.
 */
export interface AccountCreationPluginMetadata {
    /**
     * A display name for the account creation service that is presented to users.
     */
    name?: string
    /**
     * A wallet description to further identify the account creation service for users.
     */
    description?: string
    /**
     * Account creation service branding.
     */
    logo?: string
    /**
     * Link to the homepage for the account creation service.
     */
    homepage?: string
    /**
     * The public key being used by the account creation plugin.
     */
    publicKey?: PublicKey
}


/**
 * The response for a login call of a [[WalletPlugin]].
 */
export interface AccountCreationPluginCreateResponse {
    chain: Checksum256
    permissionLevel: PermissionLevel
}

interface AccountCreationContext {
    chain: Checksum256
    accountName: NameType
}

/**
 * Interface which all 3rd party account creation plugins must implement.
 */

export interface AccountCreationPlugin {
    /** A URL friendly (lower case, no spaces, etc) ID for this plugin - Used in serialization */
    get id(): string
    /** The [[SessionKit]] configuration parameters for this [[WalletPlugin]]. */
    config: AccountCreationPluginConfig
    /** The metadata for the [[WalletPlugin]] itself. */
    metadata: AccountCreationPluginMetadata
    /** Any translations this plugin requires */
    translations?: LocaleDefinitions

    /**
     * Request the [[AccountCreationPlugin]] to create a new account.
     *
     * @param context The [[AccountCreationContext]] for the [[WalletPlugin]] to use.
     */
    create(context: AccountCreationContext): Promise<AccountCreationPluginCreateResponse>
}

/**
 * Abstract class which all 3rd party [[AccountCreation]] implementations may extend.
 */
export abstract class AbstractAccounCreationPlugin implements AccountCreationPlugin {
    config: AccountCreationPluginConfig = {
        requiresChainSelect: true,
        requiresAccountNameSelect: true,
    }
    metadata: AccountCreationPluginMetadata = {}
    translations?: LocaleDefinitions
    abstract get id(): string
    abstract create(context: AccountCreationContext): Promise<AccountCreationPluginCreateResponse>
}
