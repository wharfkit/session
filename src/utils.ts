import {Action, AnyAction, FetchProviderOptions, Transaction} from '@greymass/eosio'
import {SigningRequest} from 'eosio-signing-request'

import {Fetch} from './types'

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
    if (cloned.data.req.value instanceof Action) {
        // Overwrite the data
        cloned.data.req.value = [cloned.data.req.value, newAction]
        // This needs to be done to indicate it's an `Action[]`
        cloned.data.req.variantIdx = 1
    } else if (cloned.data.req.value instanceof Array) {
        // Prepend the action to the existing array
        cloned.data.req.value.push(newAction)
    } else if (cloned.data.req.value instanceof Transaction) {
        // Prepend the action to the existing array of the transaction
        cloned.data.req.value.actions.push(newAction)
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
    if (cloned.data.req.value instanceof Action) {
        // Overwrite the data
        cloned.data.req.value = [newAction, cloned.data.req.value]
        // This needs to be done to indicate it's an `Action[]`
        cloned.data.req.variantIdx = 1
    } else if (cloned.data.req.value instanceof Array) {
        // Prepend the action to the existing array
        cloned.data.req.value.unshift(newAction)
    } else if (cloned.data.req.value instanceof Transaction) {
        // Prepend the action to the existing array of the transaction
        cloned.data.req.value.actions.unshift(newAction)
    }
    return cloned
}
