import {
    Action,
    AnyAction,
    FetchProviderOptions,
    Name,
    PermissionLevel,
    PermissionLevelType,
    Transaction,
} from '@wharfkit/antelope'
import type {Fetch, LocaleDefinitions} from '@wharfkit/common'
import {PlaceholderAuth, SigningRequest} from '@wharfkit/signing-request'
import {TransactArgs, TransactPlugin} from './transact'
import {WalletPlugin} from './wallet'

/**
 * Return an instance of fetch.
 *
 * @param options FetchProviderOptions
 * @returns Fetch
 */
/* istanbul ignore next */
export function getFetch(options?: FetchProviderOptions): Fetch {
    if (options && options.fetch) {
        return options.fetch
    }
    if (typeof window !== 'undefined' && window.fetch) {
        return window.fetch.bind(window)
    }
    if (typeof global !== 'undefined' && global.fetch) {
        return global.fetch.bind(global)
    }
    throw new Error('Missing fetch')
}

/**
 * Append an action to the end of the array of actions in a SigningRequest.
 *
 * @param request SigningRequest
 * @param action AnyAction
 * @returns SigningRequest
 */
export function appendAction(request: SigningRequest, action: AnyAction): SigningRequest {
    const newAction = Action.from(action)
    const cloned = request.clone()
    switch (cloned.data.req.variantName) {
        case 'action': {
            cloned.data.req.value = [cloned.data.req.value as Action, newAction]
            cloned.data.req.variantIdx = 1
            break
        }
        case 'action[]': {
            const array = cloned.data.req.value as Action[]
            array.push(newAction)
            cloned.data.req.value = array
            break
        }
        case 'transaction': {
            const tx = cloned.data.req.value as Transaction
            tx.actions.push(newAction)
            cloned.data.req.value = tx
            break
        }
        default: {
            throw new Error('unknown data req type')
        }
    }
    return cloned
}

/**
 * Prepend an action to the end of the array of actions in a SigningRequest.
 *
 * @param request SigningRequest
 * @param action AnyAction
 * @returns SigningRequest
 */
export function prependAction(request: SigningRequest, action: AnyAction): SigningRequest {
    const newAction = Action.from(action)
    const cloned = request.clone()
    switch (cloned.data.req.variantName) {
        case 'action': {
            cloned.data.req.value = [newAction, cloned.data.req.value as Action]
            cloned.data.req.variantIdx = 1
            break
        }
        case 'action[]': {
            const array = cloned.data.req.value as Action[]
            array.unshift(newAction)
            cloned.data.req.value = array
            break
        }
        case 'transaction': {
            const tx = cloned.data.req.value as Transaction
            tx.actions.unshift(newAction)
            cloned.data.req.value = tx
            break
        }
        default: {
            throw new Error('unknown data req type')
        }
    }
    return cloned
}

export function getPluginTranslations(
    transactPlugin: TransactPlugin | WalletPlugin
): LocaleDefinitions {
    if (!transactPlugin.translations) {
        return {}
    }
    const prefixed = {}
    const languages = Object.keys(transactPlugin.translations)
    languages.forEach((lang) => {
        if (transactPlugin.translations) {
            prefixed[lang] = {[transactPlugin.id]: transactPlugin.translations[lang]}
        }
    })
    return prefixed
}

/**
 * Extract actions from TransactArgs.
 *
 * @param args TransactArgs
 * @returns Array of actions, or empty array if not determinable
 */
export function extractActions(args: TransactArgs): AnyAction[] {
    if (args.action) {
        return [args.action]
    }
    if (args.actions) {
        return args.actions
    }
    if (args.transaction && args.transaction.actions) {
        return args.transaction.actions
    }
    return []
}

/**
 * Check if an action has an authorization matching a given permission level.
 *
 * @param action AnyAction
 * @param permissionLevel PermissionLevel
 * @returns boolean
 */
export function actionMatchesPermission(
    action: AnyAction,
    permissionLevel: PermissionLevel
): boolean {
    return action.authorization.some(
        (auth: PermissionLevelType) => permissionLevel.equals(auth) || PlaceholderAuth.equals(auth)
    )
}

function rewriteAuthIfMatches(
    auth: PermissionLevelType,
    permissionLevel: PermissionLevel,
    newPermission: Name
): PermissionLevelType {
    if (permissionLevel.equals(auth) || PlaceholderAuth.equals(auth)) {
        return PermissionLevel.from({
            actor: permissionLevel.actor,
            permission: newPermission,
        })
    }
    return auth
}

function rewriteActionAuthorizations(
    action: AnyAction,
    permissionLevel: PermissionLevel,
    newPermission: Name
): AnyAction {
    return {
        ...action,
        authorization: action.authorization.map((auth) =>
            rewriteAuthIfMatches(auth, permissionLevel, newPermission)
        ),
    }
}

export function rewriteAuthorizations(
    args: TransactArgs,
    permissionLevel: PermissionLevel,
    newPermission: Name
): TransactArgs {
    if (args.action) {
        return {
            ...args,
            action: rewriteActionAuthorizations(args.action, permissionLevel, newPermission),
        }
    }

    if (args.actions) {
        return {
            ...args,
            actions: args.actions.map((action) =>
                rewriteActionAuthorizations(action, permissionLevel, newPermission)
            ),
        }
    }

    if (args.transaction && args.transaction.actions) {
        return {
            ...args,
            transaction: {
                ...args.transaction,
                actions: args.transaction.actions.map((action) =>
                    rewriteActionAuthorizations(action, permissionLevel, newPermission)
                ),
            },
        }
    }

    return args
}
