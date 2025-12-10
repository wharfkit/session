import {
    AnyAction,
    API,
    APIClient,
    Authority,
    KeyWeight,
    Name,
    NameType,
    PermissionLevel,
    PrivateKey,
    PublicKey,
} from '@wharfkit/antelope'

import {Session, SessionArgs, SessionOptions} from '../session'
import {
    isSessionKeyWallet,
    SessionKeyConfig,
    SessionKeyConflictChoice,
    SessionKeyMismatch,
    SessionKeySetupResult,
    SessionKeyWalletInterface,
    SessionKeyWhitelistEntry,
} from './types'
import {SessionKeyWalletPlugin} from './wallet'
import {Contract as SystemContract} from './systemcontract'
import {UserInterface} from '../ui'

function createPrimaryWalletSession(session: Session, ui?: UserInterface): Session {
    if (!isSessionKeyWallet(session.walletPlugin)) {
        throw new Error('Session does not have a session key wallet')
    }

    const args: SessionArgs = {
        chain: session.chain,
        permissionLevel: session.permissionLevel,
        walletPlugin: session.walletPlugin.getPrimaryWallet(),
    }

    const options: SessionOptions = {
        fetch: session.fetch,
        ui,
    }

    return new Session(args, options)
}

/**
 * Manages session key lifecycle including setup, validation, and removal.
 */
export class SessionKeyManager {
    config: SessionKeyConfig
    whitelist: SessionKeyWhitelistEntry[]
    ui?: UserInterface

    constructor(config: SessionKeyConfig, ui?: UserInterface) {
        this.config = config
        this.ui = ui
        this.whitelist = config.whitelist.map((entry) => ({
            contract: Name.from(entry.contract),
            actions: entry.actions?.map((a) => Name.from(a)),
        }))
    }

    private getSystemContract(client: APIClient): SystemContract {
        return new SystemContract({client})
    }

    private allowsAllActions(entry: SessionKeyWhitelistEntry): boolean {
        return !entry.actions || entry.actions.length === 0
    }

    private hasSpecificActions(
        entry: SessionKeyWhitelistEntry
    ): entry is SessionKeyWhitelistEntry & {actions: Name[]} {
        return !!entry.actions && entry.actions.length > 0
    }

    /**
     * Get the permission name for the session key.
     * Uses config.permission if set, otherwise generates from app name or defaults to 'sessionkey'.
     *
     * @param appName Optional application name to generate permission from
     * @returns The permission name
     */
    getPermissionName(appName?: string): Name {
        if (this.config.permission) {
            return Name.from(this.config.permission)
        }
        if (appName) {
            const sanitized = appName
                .toLowerCase()
                .replace(/[^a-z1-5.]/g, '')
                .slice(0, 12)
            return Name.from(sanitized || 'sessionkey')
        }
        return Name.from('sessionkey')
    }

    /**
     * Check if an action is whitelisted for signing with the session key.
     *
     * @param action The action to check
     * @returns True if the action is whitelisted
     */
    isWhitelisted(action: AnyAction): boolean {
        const actionContract = Name.from(action.account)
        const actionName = Name.from(action.name)

        for (const entry of this.whitelist) {
            if (actionContract.equals(entry.contract)) {
                if (this.allowsAllActions(entry)) {
                    return true
                }
                if (this.hasSpecificActions(entry)) {
                    for (const allowedAction of entry.actions) {
                        if (actionName.equals(allowedAction)) {
                            return true
                        }
                    }
                }
            }
        }
        return false
    }

    /**
     * Type guard to check if a session has an active session key wallet.
     *
     * @param session The session to check
     * @returns True if the session has a session key wallet
     */
    hasSessionKey(
        session: Session
    ): session is Session & {walletPlugin: SessionKeyWalletInterface} {
        return isSessionKeyWallet(session.walletPlugin)
    }

    /**
     * Fetch permission data from the blockchain.
     * Uses custom fetchPermission function if provided in config, otherwise uses default implementation.
     *
     * @param client API client to use for fetching
     * @param account Account name
     * @param permission Permission name
     * @returns Permission data or undefined if not found
     */
    async fetchPermission(
        client: APIClient,
        account: Name,
        permission: Name
    ): Promise<API.v1.AccountPermission | undefined> {
        if (this.config.fetchPermission) {
            return this.config.fetchPermission(client, account, permission)
        }
        return this.defaultFetchPermission(client, account, permission)
    }

    private async defaultFetchPermission(
        client: APIClient,
        account: Name,
        permission: Name
    ): Promise<API.v1.AccountPermission | undefined> {
        try {
            const accountData = await client.v1.chain.get_account(account)
            return accountData.permissions.find((p: any) => permission.equals(p.perm_name))
        } catch {
            return undefined
        }
    }

    /**
     * Check if a session key permission exists on-chain and validate its whitelist.
     *
     * @param session The session to check
     * @returns Object with exists flag, permission name, and optional mismatch details
     */
    async checkExistingSessionKey(
        session: Session
    ): Promise<{exists: boolean; permission?: Name; mismatch?: SessionKeyMismatch}> {
        const permissionName = this.getPermissionName(session.appName)
        const permData = await this.fetchPermission(session.client, session.actor, permissionName)

        if (!permData) {
            return {exists: false}
        }

        if (!permData.linked_actions || permData.linked_actions.length === 0) {
            return {exists: false}
        }

        const added = this.findMissingLinks(this.whitelist, permData.linked_actions)
        const removed = this.findExtraLinks(this.whitelist, permData.linked_actions)

        if (added.length === 0 && removed.length === 0) {
            return {exists: true, permission: permissionName}
        }

        return {
            exists: true,
            permission: permissionName,
            mismatch: {added, removed},
        }
    }

    /**
     * Validate that the session's whitelist matches the on-chain linked actions.
     *
     * @param session The session with an active session key to validate
     * @returns Mismatch details if whitelist differs from on-chain state, undefined if they match
     */
    async validateWhitelist(session: Session): Promise<SessionKeyMismatch | undefined> {
        if (!this.hasSessionKey(session)) {
            return undefined
        }

        const permission = session.walletPlugin.getPermission()
        const permData = await this.fetchPermission(session.client, session.actor, permission)
        if (!permData || !permData.linked_actions) {
            return undefined
        }

        const added = this.findMissingLinks(this.whitelist, permData.linked_actions)
        const removed = this.findExtraLinks(this.whitelist, permData.linked_actions)

        if (added.length === 0 && removed.length === 0) {
            return undefined
        }

        return {added, removed}
    }

    private findMissingLinks(
        whitelist: SessionKeyWhitelistEntry[],
        onChainLinks: API.v1.AccountLinkedAction[]
    ): SessionKeyWhitelistEntry[] {
        const missing: SessionKeyWhitelistEntry[] = []

        for (const entry of whitelist) {
            if (this.allowsAllActions(entry)) {
                if (!this.hasLinkOnChain(entry.contract, undefined, onChainLinks)) {
                    missing.push(entry)
                }
            } else if (this.hasSpecificActions(entry)) {
                for (const action of entry.actions) {
                    if (!this.hasLinkOnChain(entry.contract, action, onChainLinks)) {
                        missing.push({contract: entry.contract, actions: [action]})
                    }
                }
            }
        }

        return missing
    }

    private findExtraLinks(
        whitelist: SessionKeyWhitelistEntry[],
        onChainLinks: API.v1.AccountLinkedAction[]
    ): SessionKeyWhitelistEntry[] {
        const extra: SessionKeyWhitelistEntry[] = []

        for (const link of onChainLinks) {
            const linkAction = link.action ? Name.from(link.action) : undefined

            if (!this.isLinkInWhitelist(link.account, linkAction, whitelist)) {
                extra.push({
                    contract: link.account,
                    actions: link.action ? [link.action] : undefined,
                })
            }
        }

        return extra
    }

    private hasLinkOnChain(
        contract: Name,
        action: Name | undefined,
        onChainLinks: API.v1.AccountLinkedAction[]
    ): boolean {
        return onChainLinks.some((link) => {
            if (!contract.equals(link.account)) {
                return false
            }
            if (!action) {
                return !link.action
            }
            return link.action && action.equals(link.action)
        })
    }

    private isLinkInWhitelist(
        contract: NameType,
        action: Name | undefined,
        whitelist: SessionKeyWhitelistEntry[]
    ): boolean {
        return whitelist.some((entry) => {
            if (!Name.from(contract).equals(entry.contract)) {
                return false
            }
            if (this.allowsAllActions(entry)) {
                return !action
            }
            if (!action) {
                return false
            }
            if (this.hasSpecificActions(entry)) {
                return entry.actions.some((a) => action.equals(a))
            }
            return false
        })
    }

    /**
     * Set up a new session key for the given session.
     * Generates a new K1 key, creates the permission on-chain, and wraps the session wallet.
     *
     * @param session The session to set up a session key for
     * @param onConflict Optional callback if the permission already exists with other keys
     * @returns The public key and permission name of the created session key
     * @throws If the session already has an active session key
     */
    async setup(
        session: Session,
        onConflict?: (existingKeys: KeyWeight[]) => Promise<SessionKeyConflictChoice>
    ): Promise<SessionKeySetupResult> {
        if (this.hasSessionKey(session)) {
            throw new Error(
                'Session already has a session key. Remove it first before setting up a new one.'
            )
        }

        const permissionName = this.getPermissionName(session.appName)
        const privateKey = PrivateKey.generate('K1')
        const publicKey = privateKey.toPublic()
        const keyWeight = KeyWeight.from({key: publicKey, weight: 1})

        const existingPerm = await this.fetchPermission(
            session.client,
            session.actor,
            permissionName
        )

        const keys = await this.resolveKeys(existingPerm, keyWeight, onConflict)

        const systemContract = this.getSystemContract(session.client)
        const actions = this.buildSetupActions(
            systemContract,
            session.actor,
            permissionName,
            session.permissionLevel,
            keys,
            existingPerm?.linked_actions
        )

        await session.transact({actions})

        this.wrapSessionWallet(session, privateKey, permissionName)

        return {
            publicKey,
            permission: permissionName,
        }
    }

    private async resolveKeys(
        existingPerm: API.v1.AccountPermission | undefined,
        keyWeight: KeyWeight,
        onConflict?: (existingKeys: KeyWeight[]) => Promise<SessionKeyConflictChoice>
    ): Promise<KeyWeight[]> {
        if (!existingPerm) {
            return [keyWeight]
        }

        if (!onConflict) {
            const auth = Authority.from({
                threshold: 1,
                keys: [...existingPerm.required_auth.keys, keyWeight],
                accounts: [],
                waits: [],
            })
            return auth.keys
        }

        const choice = await onConflict(existingPerm.required_auth.keys)
        if (choice === 'cancel') {
            throw new Error('Session key setup cancelled by user')
        }

        if (choice === 'add') {
            const auth = Authority.from({
                threshold: 1,
                keys: [...existingPerm.required_auth.keys, keyWeight],
                accounts: [],
                waits: [],
            })
            return auth.keys
        }

        return [keyWeight]
    }

    private buildSetupActions(
        systemContract: SystemContract,
        actor: Name,
        permissionName: Name,
        authorization: PermissionLevel,
        keys: KeyWeight[],
        existingLinks?: API.v1.AccountLinkedAction[]
    ): AnyAction[] {
        const auth = Authority.from({
            threshold: 1,
            keys,
            accounts: [],
            waits: [],
        })

        const updateAuthAction = systemContract.action(
            'updateauth',
            {
                account: actor,
                permission: permissionName,
                parent: 'active',
                auth,
            },
            {authorization: [authorization]}
        )

        const linkAuthActions = this.buildLinkAuthActions(
            systemContract,
            actor,
            permissionName,
            authorization,
            existingLinks
        )

        return [updateAuthAction, ...linkAuthActions]
    }

    private wrapSessionWallet(session: Session, privateKey: PrivateKey, permission: Name): void {
        const wrappedWallet = new SessionKeyWalletPlugin({
            primaryWallet: session.walletPlugin,
            privateKey,
            permission,
            whitelist: this.whitelist,
        })

        session['_walletPlugin'] = wrappedWallet
    }

    private buildLinkAuthActions(
        systemContract: SystemContract,
        actor: Name,
        permissionName: Name,
        authorization: PermissionLevel,
        existingLinks?: API.v1.AccountLinkedAction[]
    ): AnyAction[] {
        const actions: AnyAction[] = []
        const existingSet = new Set<string>()

        if (existingLinks) {
            for (const link of existingLinks) {
                const key = `${link.account}:${link.action || ''}`
                existingSet.add(key)
            }
        }

        for (const entry of this.whitelist) {
            const contract = Name.from(entry.contract)

            if (this.allowsAllActions(entry)) {
                const key = `${contract}:`
                if (!existingSet.has(key)) {
                    actions.push(
                        systemContract.action(
                            'linkauth',
                            {
                                account: actor,
                                code: contract,
                                type: '',
                                requirement: permissionName,
                            },
                            {authorization: [authorization]}
                        )
                    )
                }
            } else if (this.hasSpecificActions(entry)) {
                for (const action of entry.actions) {
                    const actionName = Name.from(action)
                    const key = `${contract}:${actionName}`
                    if (!existingSet.has(key)) {
                        actions.push(
                            systemContract.action(
                                'linkauth',
                                {
                                    account: actor,
                                    code: contract,
                                    type: actionName,
                                    requirement: permissionName,
                                },
                                {authorization: [authorization]}
                            )
                        )
                    }
                }
            }
        }

        return actions
    }

    /**
     * Remove the session key from the given session.
     * Removes the key from on-chain permission and unlinks/deletes as needed.
     *
     * @param session The session to remove the session key from
     * @throws If the session does not have an active session key
     * @throws If the permission or key is not found on-chain
     */
    async remove(session: Session): Promise<void> {
        if (!this.hasSessionKey(session)) {
            throw new Error('Session does not have a session key')
        }

        const primaryWallet = session.walletPlugin.getPrimaryWallet()
        const permission = session.walletPlugin.getPermission()
        const publicKey = PublicKey.from(session.walletPlugin.getPublicKey())

        const actor = session.actor

        const permData = await this.fetchPermission(session.client, actor, permission)
        if (!permData) {
            throw new Error('Permission not found on chain')
        }

        const ourKeyIndex = permData.required_auth.keys.findIndex((k) =>
            PublicKey.from(k.key).equals(publicKey)
        )

        if (ourKeyIndex === -1) {
            throw new Error('Session key not found in permission')
        }

        const remainingKeys = permData.required_auth.keys.filter((_, i) => i !== ourKeyIndex)

        const actions: AnyAction[] = []

        const tempSession = createPrimaryWalletSession(session, this.ui)
        const systemContract = this.getSystemContract(session.client)

        if (remainingKeys.length > 0) {
            actions.push(
                systemContract.action(
                    'updateauth',
                    {
                        account: actor,
                        permission,
                        parent: 'active',
                        auth: permData.required_auth,
                    },
                    {authorization: [session.permissionLevel]}
                )
            )
        } else {
            const linkedActions = permData.linked_actions || []
            for (const link of linkedActions) {
                actions.push(
                    systemContract.action(
                        'unlinkauth',
                        {
                            account: actor,
                            code: link.account,
                            type: link.action || '',
                        },
                        {authorization: [session.permissionLevel]}
                    )
                )
            }

            actions.push(
                systemContract.action(
                    'deleteauth',
                    {
                        account: actor,
                        permission,
                    },
                    {authorization: [session.permissionLevel]}
                )
            )
        }

        await tempSession.transact({actions})
        session['_walletPlugin'] = primaryWallet
    }

    private buildLinkAuthActionsFromEntries(
        systemContract: SystemContract,
        entries: SessionKeyWhitelistEntry[],
        actor: Name,
        permission: Name,
        authorization: PermissionLevel
    ): AnyAction[] {
        const actions: AnyAction[] = []

        for (const entry of entries) {
            const contract = Name.from(entry.contract)
            if (this.allowsAllActions(entry)) {
                actions.push(
                    systemContract.action(
                        'linkauth',
                        {
                            account: actor,
                            code: contract,
                            type: '',
                            requirement: permission,
                        },
                        {authorization: [authorization]}
                    )
                )
            } else if (this.hasSpecificActions(entry)) {
                for (const action of entry.actions) {
                    actions.push(
                        systemContract.action(
                            'linkauth',
                            {
                                account: actor,
                                code: contract,
                                type: action,
                                requirement: permission,
                            },
                            {authorization: [authorization]}
                        )
                    )
                }
            }
        }

        return actions
    }

    private buildUnlinkAuthActionsFromEntries(
        systemContract: SystemContract,
        entries: SessionKeyWhitelistEntry[],
        actor: Name,
        authorization: PermissionLevel
    ): AnyAction[] {
        const actions: AnyAction[] = []

        for (const entry of entries) {
            const contract = Name.from(entry.contract)
            if (this.allowsAllActions(entry)) {
                actions.push(
                    systemContract.action(
                        'unlinkauth',
                        {
                            account: actor,
                            code: contract,
                            type: '',
                        },
                        {authorization: [authorization]}
                    )
                )
            } else if (this.hasSpecificActions(entry)) {
                for (const action of entry.actions) {
                    actions.push(
                        systemContract.action(
                            'unlinkauth',
                            {
                                account: actor,
                                code: contract,
                                type: action,
                            },
                            {authorization: [authorization]}
                        )
                    )
                }
            }
        }

        return actions
    }

    /**
     * Update the on-chain linkauth actions to match the current whitelist.
     * Removes extra links and adds missing links to synchronize state.
     *
     * @param session The session with an active session key
     * @throws If the session does not have an active session key
     */
    async updateLinks(session: Session): Promise<void> {
        if (!this.hasSessionKey(session)) {
            throw new Error('Session does not have a session key')
        }

        const permission = session.walletPlugin.getPermission()

        const mismatch = await this.validateWhitelist(session)
        if (!mismatch) {
            return
        }

        const tempSession = createPrimaryWalletSession(session, this.ui)
        const systemContract = this.getSystemContract(session.client)

        const unlinkActions = this.buildUnlinkAuthActionsFromEntries(
            systemContract,
            mismatch.removed,
            session.actor,
            session.permissionLevel
        )

        const linkActions = this.buildLinkAuthActionsFromEntries(
            systemContract,
            mismatch.added,
            session.actor,
            permission,
            session.permissionLevel
        )

        const actions = [...unlinkActions, ...linkActions]

        if (actions.length > 0) {
            await tempSession.transact({actions})
        }
    }
}
