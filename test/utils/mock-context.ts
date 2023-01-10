import {TransactContext} from '$lib'
import {APIClient, FetchProvider, PermissionLevel} from '@greymass/eosio'

import {mockUrl} from './mock-config'
import {mockFetch} from './mock-fetch'

export function makeContext(): TransactContext {
    return new TransactContext({
        client: new APIClient({
            provider: new FetchProvider(mockUrl, {fetch: mockFetch}),
        }),
        fetch: mockFetch,
        session: PermissionLevel.from('wharfkit1125@test'),
    })
}
