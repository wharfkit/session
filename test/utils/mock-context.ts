import {TransactContext} from '$lib'
import {PermissionLevel} from '@greymass/eosio'

import {mockUrl} from './mock-config'
import {MockFetchProvider} from './mock-provider'

const fetchProvider = new MockFetchProvider(mockUrl)

export function makeContext(): TransactContext {
    return new TransactContext({
        fetchProvider: fetchProvider,
        session: PermissionLevel.from('corecorecore@test'),
    })
}
