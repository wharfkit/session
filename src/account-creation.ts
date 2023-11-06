import {APIClient, FetchProvider, NameType, Struct} from '@wharfkit/antelope'
import {Logo} from '@wharfkit/common'
import type {ChainDefinition, Fetch, LocaleDefinitions} from '@wharfkit/common'
import {UserInterface} from '.'

/**
 * The static configuration of an [[AccountCreationPlugin]].
 */
export interface AccountCreationPluginConfig {
    /**
     * Indicates if the plugin requires the user to manually select the blockchain to create an account on.
     */
    requiresChainSelect: boolean
    /**
     * If set, indicates which blockchains are compatible with this [[AccountCreationPlugin]].
     */
    supportedChains?: ChainDefinition[]
}

/**
 * The metadata of an [[AccountCreationPlugin]].
 */
@Struct.type('account_creation_plugin_metadata')
export class AccountCreationPluginMetadata extends Struct {
    /**
     * A display name for the account creation service that is presented to users.
     */
    @Struct.field('string') declare name: string
    /**
     * A description to further identify the account creation service for users.
     */
    @Struct.field('string', {optional: true}) declare description?: string
    /**
     * Account creation service branding.
     */
    @Struct.field(Logo, {optional: true}) declare logo?: Logo
    /**
     * Link to the homepage for the account creation service.
     */
    @Struct.field('string', {optional: true}) declare homepage?: string

    static from(data) {
        return new AccountCreationPluginMetadata({
            ...data,
            logo: data.logo ? Logo.from(data.logo) : undefined,
        })
    }
}

/**
 * Options for createAccount call.
 **/
export interface CreateAccountOptions {
    chain?: ChainDefinition
    chains?: ChainDefinition[]
    accountName?: NameType
}

/**
 * The response for a createAccount call.
 */
export interface CreateAccountResponse {
    chain: ChainDefinition
    accountName: NameType
}

export interface CreateAccountContextOptions {
    appName?: NameType
    // client: APIClient
    chain?: ChainDefinition
    chains?: ChainDefinition[]
    fetch: Fetch
    accountCreationPlugins?: AccountCreationPlugin[]
    accountCreationPlugin?: AccountCreationPlugin
    ui: UserInterface
}

export class CreateAccountContext {
    appName?: string
    chain?: ChainDefinition
    chains?: ChainDefinition[]
    fetch: Fetch
    ui: UserInterface
    accountCreationPlugin?: AccountCreationPlugin
    accountCreationPlugins: AccountCreationPlugin[] = []

    constructor(options: CreateAccountContextOptions) {
        this.appName = String(options.appName)
        if (options.chains) {
            this.chains = options.chains
        }
        if (options.chain) {
            this.chain = options.chain
        }
        this.fetch = options.fetch
        this.ui = options.ui
        if (options.accountCreationPlugins) {
            this.accountCreationPlugins = options.accountCreationPlugins
        }
        this.accountCreationPlugin = options.accountCreationPlugin
    }

    getClient(chain: ChainDefinition): APIClient {
        return new APIClient({provider: new FetchProvider(chain.url, {fetch: this.fetch})})
    }
}

/**
 * Interface which all 3rd party account creation plugins must implement.
 */

export interface AccountCreationPlugin {
    /** A URL friendly (lower case, no spaces, etc) ID for this plugin - Used in serialization */
    get id(): string

    /** A display name for the account creation service that is presented to users. */
    get name(): string

    /** The [[SessionKit]] configuration parameters for this [[WalletPlugin]]. */
    config: AccountCreationPluginConfig
    /** Any translations this plugin requires */
    translations?: LocaleDefinitions

    /**
     * Request the [[AccountCreationPlugin]] to create a new account.
     *
     * @param context The [[AccountCreationContext]] for the [[WalletPlugin]] to use.
     */
    create(options: CreateAccountContext): Promise<CreateAccountResponse>
}

/**
 * Abstract class which all 3rd party [[AccountCreation]] implementations may extend.
 */
export abstract class AbstractAccountCreationPlugin implements AccountCreationPlugin {
    config: AccountCreationPluginConfig = {
        requiresChainSelect: true,
    }
    metadata: AccountCreationPluginMetadata = new AccountCreationPluginMetadata({})
    translations?: LocaleDefinitions
    abstract get id(): string
    abstract get name(): string
    abstract create(options: CreateAccountOptions): Promise<CreateAccountResponse>
}
