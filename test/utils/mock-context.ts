import {PermissionLevel, TransactContext} from '$lib'
import {makeClient} from '$test/utils/mock-provider'

const client = makeClient()

export function makeContext(): TransactContext {
    return {
        client,
        session: PermissionLevel.from('corecorecore@test'),
    }
}
