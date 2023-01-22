import {ABICache, TransactContext} from '$lib'
import {APIClient, FetchProvider, PermissionLevel} from '@greymass/eosio'

import {UserInterfaceHeadless} from 'src/plugins/userinterface/headless'

import {mockUrl} from './mock-config'
import {mockFetch} from '$test/utils/mock-fetch'

const client = new APIClient({
    provider: new FetchProvider(mockUrl, {fetch: mockFetch}),
})

export const mockTransactContextOptions = {
    abiProvider: new ABICache(client),
    client,
    fetch: mockFetch,
    permissionLevel: PermissionLevel.from('wharfkit1125@test'),
    ui: new UserInterfaceHeadless(),
}

export function makeContext(): TransactContext {
    return new TransactContext(mockTransactContextOptions)
}
