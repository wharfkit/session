import {assert} from 'chai'
import {APIClient, Name, Transaction} from '@greymass/eosio'
import * as lib from '$lib'

import {MockProvider} from './utils/mock-provider'
import {makeMockTransaction} from 'utils/mock-transfer'

const jungle = new APIClient({
    provider: new MockProvider(),
})

class MockHook implements lib.Hook {
    process(transaction: Transaction): Transaction {
        const tx = Transaction.from(transaction)
        tx.actions[0].authorization[0].actor = Name.from('foo')
        return tx
    }
}

// suite('hook', function () {
//     test('construct', function () {
//         const hook = new MockHook()
//         assert.extensible(hook)
//     })
//     test('pre-sign', async function () {})
//     test('post-sign', async function () {})
//     test('pre-broadcast', async function () {})
//     test('post-broadcast', async function () {})
//     test('pre-login', async function () {})
//     test('post-login', async function () {})
// })
