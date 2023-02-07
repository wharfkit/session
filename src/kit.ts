import {
    Checksum256,
    Checksum256Type,
    Name,
    NameType,
    PermissionLevel,
    PermissionLevelType,
} from '@greymass/eosio'

import {
    Session,
    SessionOptions,
    WalletPlugin,
    WalletPluginLoginOptions,
    WalletPluginLoginResponse,
    WalletPluginMetadata,
} from './session'
import {
    AbstractTransactPlugin,
    BaseTransactPlugin,
    TransactContext,
    TransactPlugin,
    TransactPluginsOptions,
    TransactResult,
} from './transact'
import {UserInterfaceHeadless} from './plugins/userinterface/headless'
import {ChainDefinition, ChainDefinitionType, Fetch} from './types'

export enum LoginHookTypes {
    beforeLogin = 'beforeLogin',
    afterLogin = 'afterLogin',
}

export type LoginHook = (context: SessionOptions) => Promise<void>

export interface LoginHooks {
    afterLogin: LoginHook[]
    beforeLogin: LoginHook[]
}

/**
 * Options for creating a new context for a [[Kit.login]] call.
 */
export interface LoginContextOptions {
    // client: APIClient
    chain?: ChainDefinition
    chains?: ChainDefinition[]
    loginPlugins?: AbstractLoginPlugin[]
    walletPlugins?: WalletPluginMetadata[]
    ui: UserInterface
}

/**
 * Temporary context created for the duration of a [[Kit.login]] call.
 *
 * This context is used to store the state of the login request and
 * provide a way for plugins to add hooks into the process.
 */
export class LoginContext {
    // client: APIClient
    chain: ChainDefinition
    chains: ChainDefinition[] = []
    hooks: LoginHooks = {
        afterLogin: [],
        beforeLogin: [],
    }
    ui: UserInterface
    walletPlugins: WalletPluginMetadata[] = []
    constructor(options: LoginContextOptions) {
        // this.client = options.client
        if (options.chains) {
            this.chains = options.chains
        }
        this.chain = options.chain || this.chains[0]
        this.walletPlugins = options.walletPlugins || []
        this.ui = options.ui
        // options.loginPlugins?.forEach((plugin: AbstractLoginPlugin) => {
        //     plugin.register(this)
        // })
    }
    addHook(t: LoginHookTypes, hook: LoginHook) {
        this.hooks[t].push(hook)
    }
}

/**
 * Payload accepted by the [[Kit.login]] method.
 */
export interface LoginPlugin {
    register: (context: LoginContext) => void
}

/**
 * Abstract class for [[Kit.login]] plugins to extend.
 */
export abstract class AbstractLoginPlugin implements LoginPlugin {
    abstract register(context: LoginContext): void
}

export class BaseLoginPlugin extends AbstractLoginPlugin {
    register() {
        // console.log('Register hooks via context.addHook')
    }
}

export interface LoginOptions {
    chain?: Checksum256Type
    chains?: Checksum256Type[]
    loginPlugins?: LoginPlugin[]
    transactPlugins?: TransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    permissionLevel?: PermissionLevelType | string
}

export interface LoginResult {
    context: LoginContext
    response: WalletPluginLoginResponse
    session: Session
}

/**
 * Interface which a [[UserInteface]] plugins must implement.
 */
export interface UserInterface {
    // Inform the UI that a login call has started
    onLogin: (options?: LoginOptions) => Promise<void>
    // Inform the UI that a login call has completed
    onLoginResult: () => Promise<void>
    // Ask the user to select a blockchain, and return the chain id
    onSelectChain: (context: LoginContext) => Promise<Checksum256>
    // Ask the user to select an account, and return the PermissionLevel
    onSelectPermissionLevel: (context: LoginContext) => Promise<PermissionLevel>
    // Ask the user to select a wallet, and return the index based on the metadata
    onSelectWallet: (context: LoginContext) => Promise<number>
    // Inform the UI that a transact call has started
    onTransact: (context: TransactContext) => Promise<void>
    // Inform the UI that a transact call has completed
    onTransactResult: (context: TransactResult) => Promise<void>
    // Update the displayed modal status from a TransactPlugin
    status: (message: string) => void
}

export abstract class AbstractUserInterface implements UserInterface {
    abstract onLogin(options?: LoginOptions): Promise<void>
    abstract onLoginResult(): Promise<void>
    abstract onSelectChain(context: LoginContext): Promise<Checksum256>
    abstract onSelectPermissionLevel(context: LoginContext): Promise<PermissionLevel>
    abstract onSelectWallet(context: LoginContext): Promise<number>
    abstract onTransact(context: TransactContext): Promise<void>
    abstract onTransactResult(context: TransactResult): Promise<void>
    abstract status(message: string): void
}

export interface SessionKitOptions {
    appName: NameType
    chains: ChainDefinitionType[]
    expireSeconds?: number
    fetch?: Fetch
    loginPlugins?: LoginPlugin[]
    transactPlugins?: TransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    ui?: UserInterface
    walletPlugins: WalletPlugin[]
}

/**
 * Request a session from an account.
 */
export class SessionKit {
    readonly appName: Name
    readonly chains: ChainDefinition[]
    readonly expireSeconds: number = 120
    readonly fetch?: Fetch
    readonly loginPlugins: AbstractLoginPlugin[]
    readonly transactPlugins: AbstractTransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly ui: UserInterface
    readonly walletPlugins: WalletPlugin[]

    constructor(options: SessionKitOptions) {
        // Store options passed on the kit
        this.appName = Name.from(options.appName)
        this.chains = options.chains.map((chain) => ChainDefinition.from(chain))
        // Override default expireSeconds for all sessions if specified
        if (options.expireSeconds) {
            this.expireSeconds = options.expireSeconds
        }
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
        if (options.ui) {
            this.ui = options.ui
        } else {
            this.ui = new UserInterfaceHeadless()
        }
        // Establish default plugins for wallet flow
        this.walletPlugins = options.walletPlugins
    }

    getChainDefinition(id: Checksum256Type, override?: ChainDefinition[]): ChainDefinition {
        const chains = override ? override : this.chains
        const chainId = Checksum256.from(id)
        const chain = chains.find((c) => c.id.equals(chainId))
        if (!chain) {
            throw new Error(`No chain defined with the ID of: ${chainId}`)
        }
        return chain
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
    async login(options?: LoginOptions): Promise<LoginResult> {
        // Tell the UI a login request is beginning.
        this.ui.onLogin(options)

        // Determine which chains can be used for login request.
        const chains =
            options && options.chains
                ? options.chains.map((c) => this.getChainDefinition(c))
                : this.chains

        // Setup a LoginContext for plugins to use
        const context = new LoginContext({
            chains,
            ui: this.ui,
            walletPlugins: this.walletPlugins.map((plugin) => plugin.metadata),
        })

        // Determine which WalletPlugin will fulfill the login request.
        let walletPlugin: WalletPlugin
        if (this.walletPlugins.length === 1) {
            walletPlugin = this.walletPlugins[0] // Default to first when only one.
            // } else if (options.walletPlugin) {
            // TODO: Allow the login call to specify the wallet (by index?)
        } else {
            // Prompt the user with an interface to select a walletPlugin.
            const index = await this.ui.onSelectWallet(context)
            if (this.walletPlugins[index]) {
                walletPlugin = this.walletPlugins[index]
            } else {
                throw new Error(
                    'The user interface returned an invalid option during the onWalletSelect event.'
                )
            }
        }

        // Determine which chain will be used to perform the login request.
        let chain: ChainDefinition | undefined
        if (options && options.chain) {
            chain = this.getChainDefinition(options.chain, chains)
        } else if (chains.length === 1) {
            chain = chains[0]
        } else if (walletPlugin.config.requiresChainSelect) {
            // Prompt the user with an interface to select a chain.
            const id = await this.ui.onSelectChain(context)
            chain = this.getChainDefinition(id, chains)
        } else {
            // No chain is a valid option, since some wallets provide their own interface to select a chain.
            chain = undefined
        }

        // Determine which permission will be used to perform the login request.
        let permissionLevel: PermissionLevel | undefined
        if (options?.permissionLevel) {
            permissionLevel = PermissionLevel.from(options.permissionLevel)
        } else if (walletPlugin.config.requiresPermissionSelect) {
            permissionLevel = await this.ui.onSelectPermissionLevel(context)
        } else {
            permissionLevel = undefined
        }

        // TODO: Implement beforeLogin hook

        // Perform the login request against the walletPlugin
        // TODO: The LoginContext should be passed to the wallet plugin, passing it as options is weird.
        const loginOptions: WalletPluginLoginOptions = {
            appName: this.appName,
            chain,
            chains,
            permissionLevel,
        }
        const response: WalletPluginLoginResponse = await walletPlugin.login(context, loginOptions)

        // TODO: Implement afterLogin hook

        // Create a session combining all this information
        const session = new Session(
            {
                chain: this.getChainDefinition(response.chain),
                permissionLevel: response.permissionLevel,
                walletPlugin: this.walletPlugins[0],
            },
            {
                appName: this.appName,
                expireSeconds: this.expireSeconds,
                fetch: this.fetch,
                transactPlugins: options?.transactPlugins || this.transactPlugins,
                transactPluginsOptions:
                    options?.transactPluginsOptions || this.transactPluginsOptions,
                ui: this.ui,
            }
        )

        // Notify the UI that the login request has completed.
        this.ui.onLoginResult()

        // Return the results of the login request.
        return {
            context,
            response,
            session,
        }
    }
}
