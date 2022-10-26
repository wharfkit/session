import {assert} from 'chai'
import {APIClient, Name, Transaction} from '@greymass/eosio'
import * as lib from '$lib'

import {MockProvider} from './utils/mock-provider'
import {makeMockTransaction} from './utils/mock-transfer'
import {SigningRequest} from '$lib'

const jungle = new APIClient({
    provider: new MockProvider(),
})

class MockHook implements lib.Hook {
    // process(request: SigningRequest): SigningRequest {
    //     // modify signing request
    // }
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
