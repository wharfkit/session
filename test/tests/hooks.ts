import {assert} from 'chai'
import zlib from 'pako'

import {Hook, SigningRequest} from '$lib'
import {Action, Name, Transaction} from '@greymass/eosio'

import {makeMockAction, makeMockTransaction} from '$test/utils/mock-transfer'
import {makeClient} from '$test/utils/mock-provider'
import {resourceProviderHooks} from './use-cases/hooks/resource-provider'

const client = makeClient()

class MockHook implements Hook {
    async process(request: SigningRequest): Promise<SigningRequest> {
        // Clone the request for modification
        const cloned = request.clone()
        // Couldn't work with normal objects here
        // Needed to load the ABI and work with an `Action` object
        const abi = (await client.v1.chain.get_abi('greymassnoop')).abi
        const newAction = Action.from(
            {
                account: 'greymassnoop',
                name: 'noop',
                authorization: [
                    {
                        actor: 'greymassfuel',
                        permission: 'cosign',
                    },
                ],
                data: {},
            },
            abi
        )
        // Needs to do a bunch of conditional logic - shoulnd't be required for a hook
        if (cloned.data.req.value instanceof Action) {
            // Overwrite the data
            cloned.data.req.value = [newAction, cloned.data.req.value]
            // This needs to be done to indicate it's an `Action[]`
            cloned.data.req.variantIdx = 1
        } else if (cloned.data.req.value instanceof Array) {
            // Prepend the action to the existing array
            cloned.data.req.value.unshift(newAction)
        } else if (cloned.data.req.value instanceof Transaction) {
            // Prepend the action to the existing array of the transaction
            cloned.data.req.value.actions.unshift(newAction)
        } else {
            throw new Error('Unrecognized data type in request.')
        }
        // Return the request
        return cloned
    }
}

suite('hook', function () {
    suite('pre-sign', function () {
        test('prepend action on `action`', async function () {
            const request = await SigningRequest.create(
                {
                    action: makeMockAction(),
                },
                {zlib}
            )
            const hook = new MockHook()
            const modifiedRequest = await hook.process(request)
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
            const hook = new MockHook()
            const modifiedRequest = await hook.process(request)
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
            const hook = new MockHook()
            const modifiedRequest = await hook.process(request)
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
