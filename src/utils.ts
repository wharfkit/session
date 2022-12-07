import {FetchProviderOptions} from '@greymass/eosio'
import {Fetch} from './types'

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
