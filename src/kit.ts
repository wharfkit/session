import {
    Checksum256,
    Checksum256Type,
    Name,
    NameType,
    PermissionLevel,
    PermissionLevelType,
} from '@greymass/eosio'

import {Session, WalletPlugin, WalletPluginLoginOptions, WalletPluginLoginResponse} from './session'
import {AbstractLoginPlugin, BaseLoginPlugin, LoginContext, LoginPlugin} from './login'
import {
    AbstractTransactPlugin,
    BaseTransactPlugin,
    TransactContext,
    TransactPlugin,
    TransactPluginsOptions,
    TransactResult,
} from './transact'
import {UserInterfaceHeadless} from './plugins/userinterface/headless'
import {BrowserLocalStorage, SessionStorage} from './storage'
import {ChainDefinition, ChainDefinitionType, Fetch} from './types'

export interface LoginOptions {
    chain?: Checksum256Type
    chains?: Checksum256Type[]
    loginPlugins?: LoginPlugin[]
    transactPlugins?: TransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    permissionLevel?: PermissionLevelType | string
}

export interface RestoreArgs {
    chain: Checksum256Type
    actor: NameType
    permission: NameType
    walletPlugin: Record<string, any>
}

export interface LoginResult {
    context: LoginContext
    response: WalletPluginLoginResponse
    session: Session
}

export interface PromptArgs {
    title: string
    body?: string
    elements: PromptElement[]
}

export interface PromptElement {
    type: 'button' | 'countdown' | 'qr'
    label?: string
    data?: unknown
}

/**
 * Interface which a [[UserInteface]] plugins must implement.
 */
export interface UserInterface {
    /** Inform the UI that an error has occurred */
    onError: (error: Error) => Promise<void>
    /** Inform the UI that a login call has started **/
    onLogin: (options?: LoginOptions) => Promise<void>
    /** Inform the UI that a login call has completed **/
    onLoginResult: () => Promise<void>
    /** Ask the user to select a blockchain, and return the chain id **/
    onSelectChain: (context: LoginContext) => Promise<Checksum256>
    /** Ask the user to select an account, and return the PermissionLevel **/
    onSelectPermissionLevel: (context: LoginContext) => Promise<PermissionLevel>
    /** Ask the user to select a wallet, and return the index based on the metadata **/
    onSelectWallet: (context: LoginContext) => Promise<number>
    /** Inform the UI that a transact call has started **/
    onTransact: (context: TransactContext) => Promise<void>
    /** Inform the UI that a transact call has completed **/
    onTransactResult: (context: TransactResult) => Promise<void>
    /** Prompt the user with a custom UI element **/
    prompt: (args: PromptArgs) => void
    /** Update the displayed modal status from a TransactPlugin **/
    status: (message: string) => void
}

export abstract class AbstractUserInterface implements UserInterface {
    abstract onError(error: Error): Promise<void>
    abstract onLogin(options?: LoginOptions): Promise<void>
    abstract onLoginResult(): Promise<void>
    abstract onSelectChain(context: LoginContext): Promise<Checksum256>
    abstract onSelectPermissionLevel(context: LoginContext): Promise<PermissionLevel>
    abstract onSelectWallet(context: LoginContext): Promise<number>
    abstract onTransact(context: TransactContext): Promise<void>
    abstract onTransactResult(context: TransactResult): Promise<void>
    abstract prompt(args: PromptArgs): void
    abstract status(message: string): void
}

export interface SessionKitOptions {
    allowModify?: boolean
    appName: NameType
    chains: ChainDefinitionType[]
    expireSeconds?: number
    fetch?: Fetch
    loginPlugins?: LoginPlugin[]
    storage: SessionStorage
    transactPlugins?: TransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    ui?: UserInterface
    walletPlugins: WalletPlugin[]
}

/**
 * Request a session from an account.
 */
export class SessionKit {
    readonly allowModify: boolean = true
    readonly appName: Name
    readonly chains: ChainDefinition[]
    readonly expireSeconds: number = 120
    readonly fetch?: Fetch
    readonly loginPlugins: AbstractLoginPlugin[]
    readonly storage: SessionStorage
    readonly transactPlugins: AbstractTransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly ui: UserInterface
    readonly walletPlugins: WalletPlugin[]

    constructor(options: SessionKitOptions) {
        // Store options passed on the kit
        if (typeof options.allowModify !== 'undefined') {
            this.allowModify = options.allowModify
        }
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
        if (options.storage) {
            this.storage = options.storage
        } else {
            this.storage = new BrowserLocalStorage(this.appName.toString())
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
        // Setup a LoginContext for plugins to use
        const context = new LoginContext({
            ui: this.ui,
            walletPlugins: this.walletPlugins.map((plugin) => plugin.metadata),
        })

        // Tell the UI a login request is beginning.
        context.ui.onLogin(options)

        // Determine which WalletPlugin will fulfill the login request.
        let walletPlugin: WalletPlugin
        if (this.walletPlugins.length === 1) {
            walletPlugin = this.walletPlugins[0] // Default to first when only one.
            // } else if (options.walletPlugin) {
            // TODO: Allow the login call to specify the wallet (by index?)
        } else {
            // Prompt the user with an interface to select a walletPlugin.
            const index = await context.ui.onSelectWallet(context)
            if (this.walletPlugins[index]) {
                walletPlugin = this.walletPlugins[index]
            } else {
                throw new Error(
                    'The user interface returned an invalid option during the onWalletSelect event.'
                )
            }
        }

        // Determine which chains can be used for login request.
        let chains: ChainDefinition[] = []
        if (walletPlugin.config.supportedChains) {
            chains = walletPlugin.config.supportedChains.map((c) => this.getChainDefinition(c))
        } else if (options && options.chains) {
            chains = options.chains.map((c) => this.getChainDefinition(c))
        } else {
            chains = this.chains
        }

        // Update the context with the chains available
        context.chains = chains

        // Determine which chain will be used to perform the login request.
        let chain: ChainDefinition | undefined
        if (options && options.chain) {
            chain = this.getChainDefinition(options.chain, chains)
        } else if (chains.length === 1) {
            chain = chains[0]
        } else if (walletPlugin.config.requiresChainSelect) {
            // Prompt the user with an interface to select a chain.
            const id = await context.ui.onSelectChain(context)
            chain = this.getChainDefinition(id, chains)
        } else {
            // No chain is a valid option, since some wallets provide their own interface to select a chain.
            chain = undefined
        }

        // Update the context with the chain
        context.chain = chain

        // Determine if the WalletPlugin has chain limitations and if so, supports this chain
        if (walletPlugin.config.supportedChains) {
            if (!chain) {
                throw new Error(
                    `The wallet plugin '${walletPlugin.metadata.name}' requires a chain to be selected.`
                )
            }
            if (!walletPlugin.config.supportedChains.includes(String(chain.id))) {
                throw new Error(
                    `The wallet plugin '${walletPlugin.metadata.name}' does not support the chain '${chain.id}'`
                )
            }
        }

        // Determine which permission will be used to perform the login request.
        let permissionLevel: PermissionLevel | undefined
        if (options?.permissionLevel) {
            permissionLevel = PermissionLevel.from(options.permissionLevel)
        } else if (walletPlugin.config.requiresPermissionSelect) {
            permissionLevel = await context.ui.onSelectPermissionLevel(context)
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
                walletPlugin,
            },
            this.getSessionOptions(options)
        )

        // Notify the UI that the login request has completed.
        context.ui.onLoginResult()

        // Return the results of the login request.
        return {
            context,
            response,
            session,
        }
    }

    restore(args: RestoreArgs, options?: LoginOptions): Session {
        const walletPlugin = this.walletPlugins.find((p) => p.name === args.walletPlugin.name)
        if (!walletPlugin) {
            throw new Error(`No WalletPlugin found with the name of: '${args.walletPlugin.name}'`)
        }
        return new Session(
            {
                chain: this.getChainDefinition(args.chain),
                permissionLevel: PermissionLevel.from({
                    actor: args.actor,
                    permission: args.permission,
                }),
                walletPlugin,
            },
            this.getSessionOptions(options)
        )
    }

    getSessionOptions(options?: LoginOptions) {
        return {
            allowModify: this.allowModify,
            appName: this.appName,
            expireSeconds: this.expireSeconds,
            fetch: this.fetch,
            storage: this.storage,
            transactPlugins: options?.transactPlugins || this.transactPlugins,
            transactPluginsOptions: options?.transactPluginsOptions || this.transactPluginsOptions,
            ui: this.ui,
        }
    }
}
