import {
    Checksum256,
    Checksum256Type,
    Name,
    NameType,
    PermissionLevel,
    PermissionLevelType,
} from '@greymass/eosio'

import {
    AbstractLoginPlugin,
    BaseLoginPlugin,
    LoginContext,
    LoginPlugin,
    UserInterfaceWalletPlugin,
} from './login'
import {SerializedSession, Session} from './session'
import {BrowserLocalStorage, SessionStorage} from './storage'
import {
    AbstractTransactPlugin,
    BaseTransactPlugin,
    TransactPlugin,
    TransactPluginsOptions,
} from './transact'
import {ChainDefinition, ChainDefinitionType, Fetch} from './types'
import {WalletPlugin, WalletPluginLoginResponse} from './wallet'
import {UserInterface} from './ui'
import {getFetch} from './utils'

export interface LoginOptions {
    chain?: Checksum256Type
    chains?: Checksum256Type[]
    loginPlugins?: LoginPlugin[]
    transactPlugins?: TransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    permissionLevel?: PermissionLevelType | string
    walletPlugin?: string
}

export interface LoginResult {
    context: LoginContext
    response: WalletPluginLoginResponse
    session: Session
}

export interface RestoreArgs {
    chain: Checksum256Type
    actor: NameType
    permission: NameType
    walletPlugin: Record<string, any>
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
    readonly fetch: Fetch
    readonly loginPlugins: AbstractLoginPlugin[]
    readonly storage: SessionStorage
    readonly transactPlugins: AbstractTransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly ui?: UserInterface
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
        } else {
            this.fetch = getFetch(options)
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
        if (!this.ui) {
            throw new Error(
                'An instance of a UserInterface must be provided to utilize the login method.'
            )
        }

        // Create LoginContext for this login request.
        const context = new LoginContext({
            appName: this.appName,
            chain: undefined,
            chains:
                options && options?.chains
                    ? options.chains.map((c) => this.getChainDefinition(c))
                    : this.chains,
            fetch: this.fetch,
            ui: this.ui,
            walletPlugins: this.walletPlugins.map((plugin): UserInterfaceWalletPlugin => {
                return {
                    config: plugin.config,
                    metadata: plugin.metadata,
                }
            }),
        })

        // Tell the UI a login request is beginning.
        await context.ui.onLogin()

        // Predetermine chain (if possible) to prevent uneeded UI interactions.
        if (options && options.chain) {
            context.chain = this.getChainDefinition(options.chain, context.chains)
            context.uiRequirements.requiresChainSelect = false
        } else if (context.chains.length === 1) {
            context.chain = context.chains[0]
            context.uiRequirements.requiresChainSelect = false
        }

        // Predetermine permission (if possible) to prevent uneeded UI interactions.
        if (options?.permissionLevel) {
            context.permissionLevel = PermissionLevel.from(options.permissionLevel)
            context.uiRequirements.requiresPermissionSelect = false
        }

        // Predetermine WalletPlugin (if possible) to prevent uneeded UI interactions.
        let walletPlugin: WalletPlugin | undefined = undefined
        if (this.walletPlugins.length === 1) {
            walletPlugin = this.walletPlugins[0] // Default to first when only one.
            context.uiRequirements.requiresWalletSelect = false
        } else if (options?.walletPlugin) {
            walletPlugin = this.walletPlugins.find((p) => p.id === options.walletPlugin)
            if (walletPlugin) {
                context.uiRequirements.requiresWalletSelect = false
            }
        }

        // Determine if the login process requires any user interaction.
        if (
            context.uiRequirements.requiresChainSelect ||
            context.uiRequirements.requiresPermissionSelect ||
            context.uiRequirements.requiresPermissionEntry ||
            context.uiRequirements.requiresWalletSelect
        ) {
            // Perform UserInterface.login() flow to get determine the chain, permission, and WalletPlugin.
            const uiLoginResponse = await context.ui.login(context)

            // Attempt to set the current WalletPlugin to the index the UI requested
            if (uiLoginResponse.walletPluginIndex !== undefined) {
                walletPlugin = this.walletPlugins[uiLoginResponse.walletPluginIndex]
            }

            if (!walletPlugin) {
                throw new Error('UserInterface did not return a valid WalletPlugin index.')
            }

            // Attempt to set the current chain to match the UI response
            if (uiLoginResponse.chainId) {
                // Ensure the chain ID returned by the UI is in the list of chains
                if (!context.chains.some((c) => c.id.equals(uiLoginResponse.chainId!))) {
                    throw new Error(
                        'UserInterface did not return a chain ID matching the subset of chains.'
                    )
                }

                // Set the context.chain definition from the new chain ID
                context.chain = this.getChainDefinition(uiLoginResponse.chainId, context.chains)
            }

            // Set the PermissionLevel from the UI response to the context
            if (uiLoginResponse.permissionLevel) {
                context.permissionLevel = PermissionLevel.from(uiLoginResponse.permissionLevel)
            }
        }

        if (!walletPlugin) {
            throw new Error('No WalletPlugin available to perform the login.')
        }

        // Ensure the wallet plugin supports the chain that was selected
        const {supportedChains} = walletPlugin.config
        if (
            context.chain &&
            supportedChains &&
            supportedChains.length &&
            !supportedChains.includes(String(context.chain.id))
        ) {
            throw new Error(
                `The wallet plugin '${walletPlugin.metadata.name}' does not support the chain '${context.chain.id}'`
            )
        }

        // TODO: Implement beforeLogin hook

        // Perform the login request against the selected walletPlugin
        const response: WalletPluginLoginResponse = await walletPlugin.login(context)

        // TODO: Implement afterLogin hook

        // Create a session from the resulting login response
        const session = new Session(
            {
                chain: this.getChainDefinition(response.chain),
                permissionLevel: response.permissionLevel,
                walletPlugin,
            },
            this.getSessionOptions(options)
        )

        // Notify the UI that the login request has completed.
        await context.ui.onLoginComplete()

        // Save the session to storage if it has a storage instance.
        this.persistSession(session)

        // Return the results of the login request.
        return {
            context,
            response,
            session,
        }
    }

    async logout(session?: Session) {
        if (!this.storage) {
            throw new Error('An instance of Storage must be provided to utilize the logout method.')
        }
        await this.storage.remove('session')
        if (session) {
            const sessions = await this.getSessions()
            if (sessions) {
                const serialized = session.serialize()
                const other = sessions.filter((s: Record<string, any>) => {
                    return (
                        !Checksum256.from(s.chain).equals(Checksum256.from(serialized.chain)) ||
                        !Name.from(s.actor).equals(Name.from(serialized.actor)) ||
                        !Name.from(s.permission).equals(Name.from(serialized.permission))
                    )
                })
                await this.storage.write('sessions', JSON.stringify(other))
            }
        } else {
            await this.storage.remove('sessions')
        }
    }

    async restore(args?: RestoreArgs, options?: LoginOptions): Promise<Session> {
        // If no args were provided, attempt to default restore the session from storage.
        if (!args && this.storage) {
            const data = await this.storage.read('session')
            if (data) {
                args = JSON.parse(data)
            }
        }

        if (!args) {
            throw new Error('Either a RestoreArgs object or a Storage instance must be provided.')
        }

        // Ensure a WalletPlugin was found with the provided ID.
        const walletPlugin = this.walletPlugins.find((p) => {
            if (!args) {
                return false
            }
            return p.id === args.walletPlugin.id
        })

        if (!walletPlugin) {
            throw new Error(`No WalletPlugin found with the ID of: '${args.walletPlugin.id}'`)
        }

        // If walletPlugin data was provided, set it on the walletPlugin instance.
        if (args.walletPlugin.data) {
            walletPlugin.data = args.walletPlugin.data
        }

        // Create a new session from the provided args.
        const session = new Session(
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

        // Save the session to storage if it has a storage instance.
        this.persistSession(session)

        // Return the session
        return session
    }

    async persistSession(session: Session) {
        // TODO: Allow disabling of session persistence via kit options
        // If no storage exists, do nothing.
        if (!this.storage) {
            return
        }
        // Serialize and save the current session to storage.
        const serialized = session.serialize()
        this.storage.write('session', JSON.stringify(serialized))
        // Add the current session to the list of sessions, preventing duplication.
        const existing = await this.storage.read('sessions')
        if (existing) {
            const sessions = JSON.parse(existing)
            const other = sessions.filter((s: Record<string, any>) => {
                return (
                    !Checksum256.from(s.chain).equals(Checksum256.from(serialized.chain)) ||
                    !Name.from(s.actor).equals(Name.from(serialized.actor)) ||
                    !Name.from(s.permission).equals(Name.from(serialized.permission))
                )
            })
            const orderedSessions = [...other, serialized]
            // TODO: Sort sessions by chain, actor, and permission
            this.storage.write('sessions', JSON.stringify(orderedSessions))
        } else {
            this.storage.write('sessions', JSON.stringify([serialized]))
        }
    }

    async getSessions(): Promise<SerializedSession[]> {
        if (!this.storage) {
            throw new Error('No storage instance is available to retrieve sessions from.')
        }
        const data = await this.storage.read('sessions')
        if (!data) return []
        try {
            const parsed = JSON.parse(data)
            // Only return sessions that have a wallet plugin that is currently registered.
            const filtered = parsed.filter((s: SerializedSession) =>
                this.walletPlugins.some((p) => {
                    return p.id === s.walletPlugin.id
                })
            )
            return filtered
        } catch (e) {
            throw new Error(`Failed to parse sessions from storage (${e})`)
        }
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
