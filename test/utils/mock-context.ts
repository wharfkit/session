import {PermissionLevel, TransactContext} from '$lib'
import {makeClient} from './mock-provider'

const client = makeClient()

export function makeContext(): TransactContext {
    return {
        client,
        session: PermissionLevel.from('corecorecore@test'),
    }
}
