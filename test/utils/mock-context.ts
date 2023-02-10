import {ABICache, ChainDefinition, TransactContext, TransactContextOptions} from '$lib'
import {APIClient, FetchProvider, PermissionLevel} from '@greymass/eosio'

import {UserInterfaceHeadless} from 'src/plugins/userinterface/headless'

import {mockChainDefinition, mockUrl} from './mock-config'
import {mockFetch} from '$test/utils/mock-fetch'

const client = new APIClient({
    provider: new FetchProvider(mockUrl, {fetch: mockFetch}),
})

export const mockTransactContextOptions: TransactContextOptions = {
    abiProvider: new ABICache(client),
    chain: ChainDefinition.from(mockChainDefinition),
    client,
    fetch: mockFetch,
    permissionLevel: PermissionLevel.from('wharfkit1125@test'),
    ui: new UserInterfaceHeadless(),
}

export function makeContext(): TransactContext {
    return new TransactContext(mockTransactContextOptions)
}
