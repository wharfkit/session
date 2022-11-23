import {
    APIClient,
    Checksum256,
    Checksum256Type,
    FetchProvider,
    FetchProviderOptions,
    Name,
    PermissionLevel,
} from '@greymass/eosio'

import {
    AbstractLoginPlugin,
    AbstractTransactPlugin,
    ChainDefinition,
    Fetch,
    LoginOptions,
    SessionKitOptions,
    SessionOptions,
    WalletPlugin,
    WalletPluginLoginOptions,
} from './types'

import {BaseLoginPlugin, BaseTransactPlugin} from './plugins'
import {Session} from './session'
import {TransactPluginsOptions} from './types'

/**
 * Request a session from an account.
 */
export class SessionKit {
    readonly appName: Name
    readonly chains: ChainDefinition[]
    readonly fetch?: Fetch
    readonly loginPlugins: AbstractLoginPlugin[]
    readonly transactPlugins: AbstractTransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly walletPlugins: WalletPlugin[]

    constructor(options: SessionKitOptions) {
        // Store options passed on the kit
        this.appName = Name.from(options.appName)
        this.chains = options.chains.map((chain) => ChainDefinition.from(chain))
        // Override fetch if provided
        if (options.fetch) {
            this.fetch = options.fetch
        }
        // Establish default plugins for login flow
        if (options.loginPlugins) {
            this.loginPlugins = options.loginPlugins
        } else {
            this.loginPlugins = [new BaseLoginPlugin()]
        }
        // Establish default plugins for transact flow
        if (options.transactPlugins) {
            this.transactPlugins = options.transactPlugins
        } else {
            this.transactPlugins = [new BaseTransactPlugin()]
        }
        // Establish default options for transact plugins
        if (options.transactPluginsOptions) {
            this.transactPluginsOptions = options.transactPluginsOptions
        }
        // Establish default plugins for wallet flow
        this.walletPlugins = options.walletPlugins
    }

    getChain(id: Checksum256Type): ChainDefinition {
        // Find the chain listed in the definitions array
        const chainId = Checksum256.from(id)
        const chain = this.chains.find((c) => c.id.equals(chainId))
        if (!chain) {
            throw new Error(`No ChainDefinition found for ${chainId}`)
        }
        return chain
    }

    getClient(id: Checksum256Type): APIClient {
        const chain = this.getChain(id)
        const options: FetchProviderOptions = {
            fetch: this.fetch,
        }
        const provider = new FetchProvider(chain.url, options)
        const client = new APIClient({provider})
        return client
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
        const chain = this.chains[0]
        const context: SessionOptions = {
            chain,
            client: options?.client || this.getClient(chain.id),
            permissionLevel: 'eosio@active',
            transactPlugins: options?.transactPlugins || this.transactPlugins,
            transactPluginsOptions: options?.transactPluginsOptions || this.transactPluginsOptions,
            walletPlugin: this.walletPlugins[0],
        }

        const walletOptions: WalletPluginLoginOptions = {
            appName: this.appName,
            chains: this.chains,
            context,
        }

        // Allow overriding of the default wallet plugin by specifying one in the options
        if (options?.walletPlugin) {
            context.walletPlugin = options.walletPlugin
        }

        // Allow overriding of the default chain definition by specifying one in the options
        if (options?.chain) {
            context.chain = this.getChain(options.chain)
            context.client = this.getClient(context.chain.id)
        }

        // Allow a permission level to be specified via options
        if (options?.permissionLevel) {
            context.permissionLevel = PermissionLevel.from(options.permissionLevel)
        }

        // TODO: Implement login hooks

        // // Determine which set of hooks to use, with hooks specified in the options taking priority
        // const afterLoginHooks = options?.hooks?.afterLogin || this.loginHooks.afterLogin
        // const beforeLoginHooks = options?.hooks?.beforeLogin || this.loginHooks.beforeLogin

        // // Run the beforeLogin hooks
        // beforeLoginHooks?.forEach(async (hook) => {
        //     await hook.process(context)
        // })

        // Perform login based on wallet plugin
        const response = await context.walletPlugin.login(walletOptions)
        context.chain = response.chain
        context.permissionLevel = response.permissionLevel

        // TODO: Implement login hooks

        // // Run the afterLogin hooks
        // afterLoginHooks?.forEach(async (hook) => {
        //     await hook.process(context)
        // })

        return new Session(context)
    }
}
