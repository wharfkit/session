import {Action, AnyAction, FetchProviderOptions, Transaction} from '@wharfkit/antelope'
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
