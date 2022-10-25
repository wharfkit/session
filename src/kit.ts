import {Name, PermissionLevel} from '@greymass/eosio'

import {Session} from './session'

import {
    AbstractSessionKit,
    AfterLoginHook,
    BeforeLoginHook,
    ChainDefinition,
    LoginOptions,
    SessionKitOptions,
    WalletPlugin,
    WalletPluginLoginOptions,
} from './kit.types'
import {SessionOptions} from './session.types'

export class SessionKit extends AbstractSessionKit {
    readonly appName: Name
    readonly chains: ChainDefinition[]
    readonly beforeLoginHooks: BeforeLoginHook[]
    readonly afterLoginHooks: AfterLoginHook[]
    readonly walletPlugins: WalletPlugin[]

    constructor(options: SessionKitOptions) {
        super()
        this.appName = Name.from(options.appName)
        this.chains = options.chains.map((chain) => ChainDefinition.from(chain))
        this.beforeLoginHooks = options.loginHooks?.beforeLogin || []
        this.afterLoginHooks = options.loginHooks?.afterLogin || []
        this.walletPlugins = options.walletPlugins
    }

    /**
     * Request a session from an account.
     *
     * @mermaid - Login sequence diagram
     * flowchart LR
     *   A((Login)) --> B{{"beforeLogin"}}
     *   B --> C[Wallet Plugin]
     *   C --> D{{"Hook(s): afterLogin"}}
     *   D --> E[Session]
     */
    async login(options?: LoginOptions): Promise<Session> {
        // Configuration for the Login
        const context: SessionOptions = {
            chain: this.chains[0],
            permissionLevel: 'eosio@active',
            walletPlugin: this.walletPlugins[0],
        }

        const walletOptions: WalletPluginLoginOptions = {
            appName: this.appName,
            chains: this.chains,
            context,
        }

        // Use the default wallet plugin if none are specified (defaulting to first in list)
        if (options?.walletPlugin) {
            context.walletPlugin = options.walletPlugin
        }

        // Use the default chain if none are specified (defaulting to first in list)
        if (options?.chain) {
            context.chain = ChainDefinition.from(options.chain)
        }

        // Allow a permission level to be specified via options
        if (options?.permissionLevel) {
            context.permissionLevel = PermissionLevel.from(options.permissionLevel)
        }

        if (options?.beforeLoginHooks) {
            // Use pre-login hooks specified in the options of this login call
        } else {
            // Use pre-login hooks defined within this instance of the SessionKit
        }

        // Perform login based on wallet plugin
        const response = await context.walletPlugin.login(walletOptions)
        context.permissionLevel = response.permissionLevel

        if (options?.afterLoginHooks) {
            // Use post-login hooks specified in the options of this login call
        } else {
            // Use post-login hooks defined within this instance of the SessionKit
        }

        return new Session(context)
    }
}
