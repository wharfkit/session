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

/**
 * Request a session from an account.
 *
 * @mermaid - SessionKit Architecture
 * classDiagram
 *    SessionKit <|-- Session
 *    SessionKitOptions --> SessionKit
 *    LoginHooks --> SessionKitOptions
 *    TransactHooks --> SessionKitOptions
 *    ChainDefinition --> SessionKitOptions
 *    WalletPlugin --> SessionKitOptions
 *    AfterSignHook --> TransactHooks
 *    BeforeSignHook --> TransactHooks
 *    AfterBroadcastHook --> TransactHooks
 *    BeforeBroadcastHook --> TransactHooks
 *    AfterLoginHook --> LoginHooks
 *    BeforeLoginHook --> LoginHooks
 *    class SessionKit {
 *        +Name appName
 *        +ChainDefinition[] chains
 *        +BeforeLoginHook[] beforeLoginHooks
 *        +AfterLoginHook[] afterLoginHooks
 *        +WalletPlugin[] walletPlugins
 *        +login(LoginOptions options) Session
 *        +mate()
 *    }
 *    class LoginHooks{
 *        <<interface>>
 *        +AfterLoginHook[] afterLogin
 *        +BeforeLoginHook[] beforeLogin
 *    }
 *    class TransactHooks{
 *        <<interface>>
 *        +AfterSignHook[] afterSign
 *        +BeforeSignHook[] beforeSign
 *        +AfterBroadcastHook[] afterBroadcast
 *        +BeforeBroadcastHook[] beforeBroadcast
 *    }
 *    class WalletPlugin{
 *        +login(WalletPluginLoginOptions options)
 *        +sign(ChainDefinition chain, Transaction
 *    }
 *    class WalletPluginLoginOptions{
 *        <<interface>>
 *        +Name appName
 *        +ChainDefinition[] chains
 *        +SessionOptions context
 *    }
 *    class AfterLoginHook{
 *        <<interface>>
 *    }
 *    class BeforeLoginHook{
 *        <<interface>>
 *    }
 *    class AfterSignHook{
 *        <<interface>>
 *    }
 *    class BeforeSignHook{
 *        <<interface>>
 *    }
 *    class AfterBroadcastHook{
 *        <<interface>>
 *    }
 *    class BeforeBroadcastHook{
 *        <<interface>>
 *    }
 *    class ChainDefinition{
 *        +Checksum256 id
 *        +string url
 *    }
 *    class SessionKitOptions{
 *        <<interface>>
 *        +NameType appName
 *        +ChainDefinitionType chains
 *        +LoginHooks loginHooks
 *        +TransactHooks transactHooks
 *        +WalletPlugin[] walletPlugins
 *    }
 *    class Session{
 *        +String beakColor
 *        +swim()
 *        +quack()
 *    }
 */

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
     *   A((Login)) --> B{{"Hook(s): beforeLogin"}}
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
