import {assert} from 'chai'
import zlib from 'pako'

import {Hook, SigningRequest} from '$lib'
import {Name, Transaction} from '@greymass/eosio'

import {MockModifyingTransactHook} from '$test/utils/mock-hook'
import {makeClient} from '$test/utils/mock-provider'
import {resourceProviderHooks} from './use-cases/hooks/resource-provider'
import {makeMockAction, makeMockTransaction} from '$test/utils/mock-transfer'

const client = makeClient()

suite('hook', function () {
    suite('pre-sign', function () {
        test('prepend action on `action`', async function () {
            const request = await SigningRequest.create(
                {
                    action: makeMockAction(),
                },
                {zlib}
            )
            const hook = new MockModifyingTransactHook()
            const response = await hook.process(request)
            const modifiedRequest = response.request
            assert.notDeepEqual(request.data.req.value, modifiedRequest.data.req.value)
            const {value} = modifiedRequest.data.req
            if (value instanceof Array) {
                const [noop, transfer] = value
                assert.equal(value.length, 2)
                assert.isTrue(Name.from('greymassnoop').equals(noop.account))
                assert.isTrue(Name.from('greymassfuel').equals(noop.authorization[0].actor))
                assert.isTrue(Name.from('eosio.token').equals(transfer.account))
                assert.isTrue(Name.from('corecorecore').equals(transfer.authorization[0].actor))
            } else {
                assert.fail('Expected modified request to be an array.')
            }
        })
        test('prepend action on `actions`', async function () {
            const request = await SigningRequest.create(
                {
                    actions: [makeMockAction(), makeMockAction()],
                    chainId: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
                },
                {zlib}
            )
            const hook = new MockModifyingTransactHook()
            const response = await hook.process(request)
            const modifiedRequest = response.request
            assert.notDeepEqual(request.data.req.value, modifiedRequest.data.req.value)
            const {value} = modifiedRequest.data.req
            if (value instanceof Array) {
                const [noop, transfer] = value
                assert.equal(value.length, 3)
                assert.isTrue(Name.from('greymassnoop').equals(noop.account))
                assert.isTrue(Name.from('greymassfuel').equals(noop.authorization[0].actor))
                assert.isTrue(Name.from('eosio.token').equals(transfer.account))
                assert.isTrue(Name.from('corecorecore').equals(transfer.authorization[0].actor))
            }
        })
        test('prepend action on `transaction`', async function () {
            const request = await SigningRequest.create(
                {
                    transaction: makeMockTransaction(await client.v1.chain.get_info()),
                    chainId: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
                },
                {zlib}
            )
            const hook = new MockModifyingTransactHook()
            const response = await hook.process(request)
            const modifiedRequest = response.request
            assert.notDeepEqual(request.data.req.value, modifiedRequest.data.req.value)
            const {value} = modifiedRequest.data.req
            if (value instanceof Transaction) {
                const {actions} = value
                const [noop, transfer] = actions
                assert.instanceOf(actions, Array)
                assert.equal(actions.length, 2)
                assert.isTrue(Name.from('greymassnoop').equals(noop.account))
                assert.isTrue(Name.from('greymassfuel').equals(noop.authorization[0].actor))
                assert.isTrue(Name.from('eosio.token').equals(transfer.account))
                assert.isTrue(Name.from('corecorecore').equals(transfer.authorization[0].actor))
            }
        })
    })
    suite('post-sign', function () {})
    suite('pre-broadcast', function () {})
    suite('post-broadcast', function () {})
    suite('pre-login', function () {})
    suite('post-login', function () {})
    suite('specific implementations', function () {
        resourceProviderHooks()
    })
})
