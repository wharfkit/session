import {APIClient, FetchProvider} from '@greymass/eosio'

import {mockUrl} from './mock-config'
import {mockFetch} from './mock-fetch'

export function makeClient(url?: string) {
    return new APIClient({
        provider: new FetchProvider(url || mockUrl, {fetch: mockFetch}),
    })
}
