import {ChainDefinition, type ChainDefinitionType, type Fetch} from '@wharfkit/common'
import type {Contract} from '@wharfkit/contract'
import {
    Bytes,
    Checksum256,
    Checksum256Type,
    Name,
    NameType,
    PermissionLevel,
    PermissionLevelType,
    Serializer,
} from '@wharfkit/antelope'

import {
    AbstractLoginPlugin,
    BaseLoginPlugin,
    LoginContext,
    LoginPlugin,
    UserInterfaceWalletPlugin,
} from './login'
import {PartialSerializedSession, SerializedSession, Session} from './session'
import {BrowserLocalStorage, SessionStorage} from './storage'
import {
    AbstractTransactPlugin,
    BaseTransactPlugin,
    TransactABIDef,
    TransactPlugin,
    TransactPluginsOptions,
} from './transact'
import {WalletPlugin, WalletPluginLoginResponse, WalletPluginMetadata} from './wallet'
import {UserInterface} from './ui'
import {getFetch, getPluginTranslations} from './utils'
import {
    AccountCreationPlugin,
    CreateAccountContext,
    CreateAccountOptions,
    CreateAccountResponse,
} from './account-creation'
import {URLEncodedSession} from './encoded'

export interface LoginOptions {
    arbitrary?: Record<string, any> // Arbitrary data that will be passed via context to wallet plugin
    chain?: ChainDefinition | Checksum256Type
    chains?: Checksum256Type[]
    equalityFn?: SerializedSessionEqualityFn
    loginPlugins?: LoginPlugin[]
    setAsDefault?: boolean
    transactPlugins?: TransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
    permissionLevel?: PermissionLevelType | string
    walletPlugin?: string
}

export interface LogoutOptions {
    equalityFn?: SerializedSessionEqualityFn
}

export interface LoginResult {
    context: LoginContext
    response: WalletPluginLoginResponse
    session: Session
}

export interface LogoutContext {
    session: Session
    appName: string
}

export type SessionType = Session | SerializedSession

export type SerializedSessionEqualityFn = (a: SessionType, b: SessionType) => boolean

export interface PersistOptions {
    setAsDefault?: boolean
    equalityFn?: SerializedSessionEqualityFn
}

export interface SessionKitArgs {
    appName: NameType
    chains: ChainDefinitionType[]
    ui: UserInterface
    walletPlugins: WalletPlugin[]
}

export interface SessionKitOptions {
    abis?: TransactABIDef[]
    acceptUrlSession?: boolean
    acceptUrlSessionParam?: string
    accountCreationPlugins?: AccountCreationPlugin[]
    allowModify?: boolean
    contracts?: Contract[]
    equalityFn?: SerializedSessionEqualityFn
    expireSeconds?: number
    fetch?: Fetch
    loginPlugins?: LoginPlugin[]
    storage?: SessionStorage
    transactPlugins?: TransactPlugin[]
    transactPluginsOptions?: TransactPluginsOptions
}

/**
 * Request a session from an account.
 */
export class SessionKit {
    readonly abis: TransactABIDef[] = []
    readonly acceptUrlSession: boolean = false
    readonly acceptUrlSessionParam: string = 'incomingWharfSession'
    readonly accountCreationPlugins: AccountCreationPlugin[] = []
    readonly allowModify: boolean = true
    readonly appName: string
    readonly equalityFn: SerializedSessionEqualityFn = serializedSessionEquals
    readonly expireSeconds: number = 120
    readonly fetch: Fetch
    readonly loginPlugins: AbstractLoginPlugin[]
    readonly storage: SessionStorage
    readonly transactPlugins: AbstractTransactPlugin[]
    readonly transactPluginsOptions: TransactPluginsOptions = {}
    readonly ui: UserInterface
    readonly walletPlugins: WalletPlugin[]
    public chains: ChainDefinition[]

    constructor(args: SessionKitArgs, options: SessionKitOptions = {}) {
        // Save the appName to the SessionKit instance
        this.appName = String(args.appName)
        // Map the chains provided to ChainDefinition instances
        this.chains = args.chains.map((chain) => ChainDefinition.from(chain))
        // Save the UserInterface instance to the SessionKit
        this.ui = args.ui
        // Establish default plugins for wallet flow
        this.walletPlugins = args.walletPlugins
        // Override fetch if provided
        if (options.fetch) {
            this.fetch = options.fetch
        } else {
            this.fetch = getFetch(options)
        }
        // Add any ABIs manually provided
        if (options.abis) {
            this.abis = [...options.abis]
        }
        // Determine if URL sessions should be accepted
        if (options.acceptUrlSession) {
            this.acceptUrlSession = options.acceptUrlSession
        }
        // Determine if URL session param name was overridden
        if (options.acceptUrlSessionParam) {
            this.acceptUrlSessionParam = options.acceptUrlSessionParam
        }
        // Extract any ABIs from the Contract instances provided
        if (options.contracts) {
            this.abis.push(...options.contracts.map((c) => ({account: c.account, abi: c.abi})))
        }
        // Override equality function if provided
        if (options.equalityFn) {
            this.equalityFn = options.equalityFn
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
            this.storage = new BrowserLocalStorage()
        }
        // Establish default plugins for transact flow
        if (options.transactPlugins) {
            this.transactPlugins = options.transactPlugins
        } else {
            this.transactPlugins = [new BaseTransactPlugin()]
        }
        // Store options passed on the kit
        if (typeof options.allowModify !== 'undefined') {
            this.allowModify = options.allowModify
        }
        // Override default expireSeconds for all sessions if specified
        if (options.expireSeconds) {
            this.expireSeconds = options.expireSeconds
        }
        // Establish default options for transact plugins
        if (options.transactPluginsOptions) {
            this.transactPluginsOptions = options.transactPluginsOptions
        }

        // Establish default plugins for account creation
        if (options.accountCreationPlugins) {
            this.accountCreationPlugins = options.accountCreationPlugins
        }
    }

    /**
     * Alters the session kit config for a specific chain to change the API endpoint in use
     */
    setEndpoint(id: Checksum256Type, url: string) {
        const modifiedChains = [...this.chains]
        const chainId = Checksum256.from(id)
        const chainIndex = this.chains.findIndex((c) => c.id.equals(chainId))
        if (chainIndex < 0) {
            throw new Error('Chain with specified ID not found.')
        }
        modifiedChains[chainIndex].url = url
        this.chains = modifiedChains
    }

    getChainDefinition(id: Checksum256Type, override?: ChainDefinition[]): ChainDefinition {
        const chains = override ? override : this.chains
        const chainId = Checksum256.from(id)
        const chain = chains.find((c) => c.id.equals(chainId))
        if (!chain) {
            throw new Error(`No chain defined with an ID of: ${chainId}`)
        }
        return chain
    }

    getWalletPlugin(id: string): WalletPlugin {
        const walletPlugin = this.walletPlugins.find((p) => p.id === id)
        if (!walletPlugin) {
            throw new Error(`No WalletPlugin found with the ID of: '${id}'`)
        }
        return walletPlugin
    }

    /**
     * Request account creation.
     */
    async createAccount(options?: CreateAccountOptions): Promise<CreateAccountResponse> {
        try {
            if (this.accountCreationPlugins.length === 0) {
                throw new Error('No account creation plugins available.')
            }

            // Eestablish defaults based on options
            let chain = options?.chain
            let requiresChainSelect = !chain
            let requiresPluginSelect = !options?.pluginId

            let accountCreationPlugin: AccountCreationPlugin | undefined

            // Developer specified a plugin during createAccount call
            if (options?.pluginId) {
                requiresPluginSelect = false

                // Find the plugin
                accountCreationPlugin = this.accountCreationPlugins.find(
                    (p) => p.id === options.pluginId
                )

                // Ensure the plugin exists
                if (!accountCreationPlugin) {
                    throw new Error('Invalid account creation plugin selected.')
                }

                // Override the chain selection requirement based on the plugin
                if (accountCreationPlugin?.config.requiresChainSelect !== undefined) {
                    requiresChainSelect = accountCreationPlugin?.config.requiresChainSelect
                }

                // If the plugin does not require chain select and has one supported chain, set it as the default
                if (
                    !accountCreationPlugin.config.requiresChainSelect &&
                    accountCreationPlugin.config.supportedChains &&
                    accountCreationPlugin.config.supportedChains.length === 1
                ) {
                    chain = accountCreationPlugin.config.supportedChains[0]
                }
            }

            // The chains available to select from, based on the Session Kit
            let chains = this.chains

            // If a plugin is selected, filter the chains available down to only the ones supported by the plugin
            if (accountCreationPlugin && accountCreationPlugin?.config.supportedChains?.length) {
                chains = chains.filter((availableChain) => {
                    return accountCreationPlugin?.config.supportedChains?.find((c) => {
                        return c.id.equals(availableChain.id)
                    })
                })
            }

            const context = new CreateAccountContext({
                accountCreationPlugins: this.accountCreationPlugins,
                appName: this.appName,
                chain,
                chains,
                fetch: this.fetch,
                ui: this.ui,
                uiRequirements: {
                    requiresChainSelect,
                    requiresPluginSelect,
                },
            })

            // If UI interaction is required before triggering the plugin
            if (requiresPluginSelect || requiresChainSelect) {
                // Call the UI with the context
                const response = await context.ui.onAccountCreate(context)

                // Set pluginId based on options first, then response
                const pluginId = options?.pluginId || response.pluginId

                // Ensure we have a pluginId
                if (!pluginId) {
                    throw new Error('No account creation plugin selected.')
                }

                // Determine plugin selected based on response
                accountCreationPlugin = context.accountCreationPlugins.find(
                    (p) => p.id === pluginId
                )
                if (!accountCreationPlugin) {
                    throw new Error('No account creation plugin selected.')
                }

                // If the plugin does not require chain select and has one supported chain, set it as the default
                if (
                    !accountCreationPlugin.config.requiresChainSelect &&
                    accountCreationPlugin.config.supportedChains &&
                    accountCreationPlugin.config.supportedChains.length === 1
                ) {
                    context.chain = accountCreationPlugin.config.supportedChains[0]
                }

                // Set chain based on response
                if (response.chain) {
                    context.chain = this.getChainDefinition(response.chain, context.chains)
                }

                // Ensure a chain was selected and is supported by the plugin
                if (accountCreationPlugin.config.requiresChainSelect && !context.chain) {
                    throw new Error(
                        `Account creation plugin (${pluginId}) requires chain selection, and no chain was selected.`
                    )
                }
            }

            // Ensure a plugin was selected
            if (!accountCreationPlugin) {
                throw new Error('No account creation plugin selected')
            }

            // Call the account creation plugin with the context
            const accountCreationData = await accountCreationPlugin.create(context)

            // Notify the UI we're done
            await context.ui.onAccountCreateComplete()

            // Return the data
            return accountCreationData
        } catch (error: any) {
            await this.ui.onError(error)
            throw new Error(error)
        }
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
        try {
            // Create LoginContext for this login request.
            const context = new LoginContext({
                appName: this.appName,
                arbitrary: options?.arbitrary || {},
                chain: undefined,
                chains:
                    options && options?.chains
                        ? options.chains.map((c) => this.getChainDefinition(c))
                        : this.chains,
                fetch: this.fetch,
                loginPlugins: this.loginPlugins,
                ui: this.ui,
                walletPlugins: this.walletPlugins.map((plugin): UserInterfaceWalletPlugin => {
                    return {
                        config: plugin.config,
                        metadata: WalletPluginMetadata.from(plugin.metadata),
                        retrievePublicKey: plugin.retrievePublicKey?.bind(plugin),
                    }
                }),
            })

            // Tell the UI a login request is beginning.
            await context.ui.onLogin()

            // Predetermine WalletPlugin (if possible) to prevent uneeded UI interactions.
            let walletPlugin: WalletPlugin | undefined = undefined
            if (this.walletPlugins.length === 1) {
                walletPlugin = this.walletPlugins[0] // Default to first when only one.
                context.walletPluginIndex = 0
                context.uiRequirements.requiresWalletSelect = false
            } else if (options?.walletPlugin) {
                const index = this.walletPlugins.findIndex((p) => p.id === options.walletPlugin)
                if (index >= 0) {
                    walletPlugin = this.walletPlugins[index]
                    context.walletPluginIndex = index
                    context.uiRequirements.requiresWalletSelect = false
                }
            }
            // Set any uiRequirement overrides from the wallet plugin
            if (walletPlugin) {
                context.uiRequirements = {
                    ...context.uiRequirements,
                    ...walletPlugin.config,
                }
                context.ui.addTranslations(getPluginTranslations(walletPlugin))
            }

            // Predetermine chain (if possible) to prevent uneeded UI interactions.
            if (options && options.chain) {
                if (options.chain instanceof ChainDefinition) {
                    context.chain = options.chain
                } else {
                    context.chain = this.getChainDefinition(options.chain, context.chains)
                }
                context.uiRequirements.requiresChainSelect = false
            } else if (context.chains.length === 1) {
                context.chain = context.chains[0]
                context.uiRequirements.requiresChainSelect = false
            } else {
                context.uiRequirements.requiresChainSelect = true
            }

            // Predetermine permission (if possible) to prevent uneeded UI interactions.
            if (options?.permissionLevel) {
                context.permissionLevel = PermissionLevel.from(options.permissionLevel)
                context.uiRequirements.requiresPermissionSelect = false
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

            // Call the `beforeLogin` hooks that were registered by the LoginPlugins
            for (const hook of context.hooks.beforeLogin) await hook(context)

            // Perform the login request against the selected walletPlugin
            const response: WalletPluginLoginResponse = await walletPlugin.login(context)

            // Create a session from the resulting login response
            const session = new Session(
                {
                    chain: this.getChainDefinition(response.chain),
                    permissionLevel: response.permissionLevel,
                    walletPlugin,
                },
                this.getSessionOptions(options)
            )

            // Call the `afterLogin` hooks that were registered by the LoginPlugins
            for (const hook of context.hooks.afterLogin) await hook(context)

            // Save the session to storage if it has a storage instance.
            this.persistSession(session, {
                setAsDefault: options?.setAsDefault,
            })

            // Notify the UI that the login request has completed.
            await context.ui.onLoginComplete()

            // Return the results of the login request.
            return {
                context,
                response,
                session,
            }
        } catch (error: any) {
            await this.ui.onError(error)
            throw new Error(error)
        }
    }

    logoutParams(session: Session | SerializedSession, walletPlugin: WalletPlugin): LogoutContext {
        if (session instanceof Session) {
            return {
                session,
                appName: this.appName,
            }
        } else {
            return {
                session: new Session({
                    chain: this.getChainDefinition(session.chain),
                    permissionLevel: PermissionLevel.from({
                        actor: session.actor,
                        permission: session.permission,
                    }),
                    walletPlugin,
                }),
                appName: this.appName,
            }
        }
    }

    async logout(session?: Session | SerializedSession, options: LogoutOptions = {}) {
        if (!this.storage) {
            throw new Error('An instance of Storage must be provided to utilize the logout method.')
        }
        await this.storage.remove('session')
        if (session) {
            const walletPlugin = this.walletPlugins.find(
                (wPlugin) => session?.walletPlugin.id === wPlugin.id
            )

            if (walletPlugin?.logout) {
                await walletPlugin.logout(this.logoutParams(session, walletPlugin))
            }

            const sessions = await this.getSessions()
            if (sessions) {
                const equalityFn = options.equalityFn || this.equalityFn
                const other = sessions.filter((s) => !equalityFn(s, session))
                await this.storage.write('sessions', JSON.stringify(other))
            }
        } else {
            const sessions = await this.getSessions()

            await this.storage.remove('sessions')

            if (sessions) {
                Promise.all(
                    sessions.map((s) => {
                        const walletPlugin = this.walletPlugins.find(
                            (wPlugin) => s.walletPlugin.id === wPlugin.id
                        )

                        if (walletPlugin?.logout) {
                            return walletPlugin.logout(this.logoutParams(s, walletPlugin))
                        } else {
                            return Promise.resolve()
                        }
                    })
                )
            }
        }
    }

    restoreFromURL(): SerializedSession | undefined {
        // Attempt to retrieve session from current URL params
        const url = new URL(window.location.href)
        const urlSessionParam = url.searchParams.get(this.acceptUrlSessionParam)
        if (urlSessionParam) {
            try {
                const encodedSession = Serializer.decode({
                    data: Bytes.from(urlSessionParam, 'hex'),
                    type: URLEncodedSession,
                })
                // Remove the session from the URL to prevent reuse
                url.searchParams.delete(this.acceptUrlSessionParam)
                window.history.replaceState(null, '', url)
                // Return the serialized session
                return encodedSession.serialized
            } catch (e) {
                // eslint-disable-next-line no-console -- warn the developer since this may be unintentional
                console.warn('Failed to decode session from URL: ' + urlSessionParam)
            }
        }
    }

    async restoreWithoutArgs(): Promise<SerializedSession | undefined> {
        let serializedSession: SerializedSession | undefined

        // Attempt to restore from URL (if enabled and in browser)
        if (this.acceptUrlSession && typeof window !== 'undefined') {
            serializedSession = this.restoreFromURL()
        }

        // If no session from from the URL, attempt to restore the session from storage
        if (!serializedSession) {
            const data = await this.storage.read('session')
            if (data) {
                serializedSession = JSON.parse(data)
            }
        }

        return serializedSession
    }

    async restoreWithArgs(args: PartialSerializedSession): Promise<SerializedSession | undefined> {
        let serializedSession = upgradePossibleSerializedSession(args)
        if (!serializedSession) {
            const data = await this.storage.read('sessions')
            if (data) {
                const sessions = JSON.parse(data) as SerializedSession[]
                serializedSession = sessions.find(
                    (s) => Checksum256.from(args.chain).equals(s.chain) && s.default
                )
            }
        }
        return serializedSession
    }

    getWalletPluginFromSerialized(serializedSession: SerializedSession): WalletPlugin {
        const walletPlugin = this.getWalletPlugin(serializedSession.walletPlugin.id)

        // Set the WalletPlugin data if it exists on the serialized session
        if (serializedSession.walletPlugin.data) {
            walletPlugin.data = serializedSession.walletPlugin.data
        }

        return walletPlugin
    }

    serializedToSession(serializedSession: SerializedSession, options: LoginOptions = {}): Session {
        // Create a new session from the provided args.
        const session = new Session(
            {
                chain: this.getChainDefinition(serializedSession.chain),
                permissionLevel: PermissionLevel.from({
                    actor: serializedSession.actor,
                    permission: serializedSession.permission,
                }),
                walletPlugin: this.getWalletPluginFromSerialized(serializedSession),
            },
            this.getSessionOptions(options)
        )

        // Set the session data if it exists on the serialized session
        if (serializedSession.data) {
            session.data = serializedSession.data
        }

        return session
    }

    async restore(
        args?: PartialSerializedSession,
        options?: LoginOptions
    ): Promise<Session | undefined> {
        const serializedSession = args
            ? await this.restoreWithArgs(args)
            : await this.restoreWithoutArgs()

        if (serializedSession) {
            // Create a session from the serialized session data
            const session = this.serializedToSession(serializedSession, options)

            // Persist the session to storage
            this.persistSession(session, {setAsDefault: options?.setAsDefault})

            // Return the session
            return session
        }
    }

    async restoreAll(): Promise<Session[]> {
        const sessions: Session[] = []
        const serializedSessions = await this.getSessions()
        for (const serializedSession of serializedSessions) {
            const session = await this.restore(serializedSession)
            if (session) {
                sessions.push(session)
            }
        }
        return sessions
    }

    async persistSession(session: Session, options: PersistOptions = {}) {
        // Serialize session passed in
        const serialized = session.serialize()

        // Specify whether or not this is now the default for the given chain
        serialized.default = options.setAsDefault !== undefined ? options.setAsDefault : true

        // Determine equality function to use
        const equalityFn = options.equalityFn || this.equalityFn

        // If this session is the default, write it to the 'session' key for persistence
        if (serialized.default) {
            this.storage.write('session', JSON.stringify(serialized))
        }

        // Add the current session to the list of sessions, preventing duplication.
        const existing = await this.storage.read('sessions')
        if (existing) {
            const stored = JSON.parse(existing)
            const sessions: SerializedSession[] = stored
                // Filter out any matching session to ensure no duplicates
                .filter((s) => !equalityFn(s, serialized))
                // If the new session is the default, remove the default status from all other sessions for this chain
                .map((s: SerializedSession): SerializedSession => {
                    if (serialized.default && session.chain.id.equals(s.chain)) {
                        s.default = false
                    }
                    return s
                })

            // Merge arrays
            const orderedSessions = [...sessions, serialized]

            // Sort sessions by chain, actor, and permission
            orderedSessions.sort((a: SerializedSession, b: SerializedSession) => {
                const chain = String(a.chain).localeCompare(String(b.chain))
                const actor = String(a.actor).localeCompare(String(b.actor))
                const permission = String(a.permission).localeCompare(String(b.permission))
                return chain || actor || permission
            })

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
            return getSessionsMatchingWalletPlugins(parsed, this.walletPlugins)
        } catch (e) {
            throw new Error(`Failed to parse sessions from storage (${e})`)
        }
    }

    getSessionOptions(options?: LoginOptions) {
        return {
            abis: this.abis,
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

export function getSessionsMatchingWalletPlugins(
    sessions: SerializedSession[],
    walletPlugins: WalletPlugin[]
) {
    return sessions.filter((s) => walletPlugins.some((p) => p.id === s.walletPlugin.id))
}

export function upgradePossibleSerializedSession(
    possible: PartialSerializedSession | undefined
): SerializedSession | undefined {
    if (
        possible &&
        possible.actor !== undefined &&
        possible.chain !== undefined &&
        possible.permission !== undefined &&
        possible.walletPlugin !== undefined
    ) {
        return {
            actor: possible.actor,
            chain: possible.chain,
            permission: possible.permission,
            walletPlugin: possible.walletPlugin,
            data: possible.data,
        }
    }
}

export function serializedSessionEquals(a: SessionType, b: SessionType): boolean {
    const first = a instanceof Session ? a.serialize() : a
    const second = b instanceof Session ? b.serialize() : b
    return (
        Checksum256.from(first.chain).equals(second.chain) &&
        Name.from(first.actor).equals(second.actor) &&
        Name.from(first.permission).equals(second.permission)
    )
}
