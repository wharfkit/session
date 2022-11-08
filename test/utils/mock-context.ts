import {TransactContext} from '$lib'
import {PermissionLevel} from '@greymass/eosio'
import {makeClient} from '$test/utils/mock-provider'

const client = makeClient()

export function makeContext(): TransactContext {
    return new TransactContext({
        client,
        session: PermissionLevel.from('corecorecore@test'),
    })
}
