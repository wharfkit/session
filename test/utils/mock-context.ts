import {
    ABICache,
    ChainDefinition,
    Session,
    SigningRequest,
    TransactArgs,
    TransactContext,
    TransactContextOptions,
} from '$lib'
import {APIClient, FetchProvider, PermissionLevel} from '@greymass/eosio'

import {mockChainDefinition, mockUrl} from './mock-config'
import {mockFetch} from '$test/utils/mock-fetch'
import {mockSession, mockSessionArgs, mockSessionOptions} from './mock-session'

const client = new APIClient({
    provider: new FetchProvider(mockUrl, {fetch: mockFetch}),
})

const session = new Session(mockSessionArgs, mockSessionOptions)
const abiProvider = new ABICache(client)

export const mockTransactContextOptions: TransactContextOptions = {
    abiProvider,
    chain: ChainDefinition.from(mockChainDefinition),
    client,
    createRequest: async (args: TransactArgs): Promise<SigningRequest> =>
        session.createRequest(args, abiProvider),
    fetch: mockFetch,
    permissionLevel: PermissionLevel.from('wharfkit1125@test'),
}

export function makeContext(): TransactContext {
    return new TransactContext(mockTransactContextOptions)
}
