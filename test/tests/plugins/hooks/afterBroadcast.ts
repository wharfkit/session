import {assert} from 'chai'

import {makeClient} from '$test/utils/mock-provider'
import {makeContext} from '$test/utils/mock-context'

const client = makeClient()
const context = makeContext()

export const afterBroadcastHooks = () => {
    suite('afterBroadcast', function () {
        test('TODO', async function () {})
    })
}
