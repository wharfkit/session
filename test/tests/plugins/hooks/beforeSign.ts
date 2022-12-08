import {assert} from 'chai'
import zlib from 'pako'

import {SigningRequest} from '$lib'
import {Name, Transaction} from '@greymass/eosio'

import {makeClient} from '$test/utils/mock-client'
import {makeContext} from '$test/utils/mock-context'
import {mockTransactResourceProviderPresignHook} from '$test/utils/mock-hook'
import {makeMockAction, makeMockTransaction} from '$test/utils/mock-transfer'
import {mockAccountName} from '$test/utils/mock-config'

const client = makeClient()
const context = makeContext()

export const beforeSignHooks = () => {
    suite('beforeSign', function () {
        test('prepend action on `action`', async function () {
            const request = await SigningRequest.create(
                {
                    action: makeMockAction(),
                },
                {zlib}
            )
            const response = await mockTransactResourceProviderPresignHook(request, context)
            assert.notDeepEqual(request.data.req.value, response.request.data.req.value)
            const {value} = response.request.data.req
            if (value instanceof Array) {
                const [noop, transfer] = value
                assert.equal(value.length, 2)
                assert.isTrue(Name.from('greymassnoop').equals(noop.account))
                assert.isTrue(Name.from('greymassfuel').equals(noop.authorization[0].actor))
                assert.isTrue(Name.from('eosio.token').equals(transfer.account))
                assert.isTrue(Name.from(mockAccountName).equals(transfer.authorization[0].actor))
            } else {
                assert.fail('Expected modified request to be an array.')
            }
        })
        test('prepend action on `actions`', async function () {
            const request = await SigningRequest.create(
                {
                    actions: [makeMockAction(), makeMockAction()],
                    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                },
                {zlib}
            )
            const response = await mockTransactResourceProviderPresignHook(request, context)
            assert.notDeepEqual(request.data.req.value, response.request.data.req.value)
            const {value} = response.request.data.req
            if (value instanceof Array) {
                const [noop, transfer] = value
                assert.equal(value.length, 3)
                assert.isTrue(Name.from('greymassnoop').equals(noop.account))
                assert.isTrue(Name.from('greymassfuel').equals(noop.authorization[0].actor))
                assert.isTrue(Name.from('eosio.token').equals(transfer.account))
                assert.isTrue(Name.from(mockAccountName).equals(transfer.authorization[0].actor))
            }
        })
        test('prepend action on `transaction`', async function () {
            const request = await SigningRequest.create(
                {
                    transaction: makeMockTransaction(await client.v1.chain.get_info()),
                    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                },
                {zlib}
            )
            const response = await mockTransactResourceProviderPresignHook(request, context)
            assert.notDeepEqual(request.data.req.value, response.request.data.req.value)
            const {value} = response.request.data.req
            if (value instanceof Transaction) {
                const {actions} = value
                const [noop, transfer] = actions
                assert.instanceOf(actions, Array)
                assert.equal(actions.length, 2)
                assert.isTrue(Name.from('greymassnoop').equals(noop.account))
                assert.isTrue(Name.from('greymassfuel').equals(noop.authorization[0].actor))
                assert.isTrue(Name.from('eosio.token').equals(transfer.account))
                assert.isTrue(Name.from(mockAccountName).equals(transfer.authorization[0].actor))
            }
        })
    })
}
