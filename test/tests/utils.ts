import {assert} from 'chai'

import zlib from 'pako'

import {ChainDefinition, Logo, SigningRequest, Transaction} from '$lib'
import {makeMockAction} from '$test/utils/mock-transfer'

import {appendAction, prependAction} from 'src/utils'
import {mockData} from '$test/utils/mock-data'
import {mockChainId} from '$test/utils/mock-config'

const newAction = makeMockAction('new action')

function commonAsserts(
    original: Transaction,
    modified: Transaction,
    oldActions = 1,
    newActions = 2
) {
    // Ensure no data besides the actions has changed
    original.context_free_actions.forEach((action, index) => {
        assert.isTrue(action.equals(modified.context_free_actions[index]))
    })
    modified.context_free_actions.forEach((action, index) => {
        assert.isTrue(action.equals(original.context_free_actions[index]))
    })
    assert.isTrue(original.delay_sec.equals(modified.delay_sec))
    assert.isTrue(original.expiration.equals(modified.expiration))
    assert.isTrue(!original.id.equals(modified.id))
    assert.isTrue(original.max_cpu_usage_ms.equals(modified.max_cpu_usage_ms))
    assert.isTrue(original.max_net_usage_words.equals(modified.max_net_usage_words))
    assert.isTrue(original.ref_block_num.equals(modified.ref_block_num))
    assert.isTrue(original.ref_block_prefix.equals(modified.ref_block_prefix))
    original.transaction_extensions.forEach((extension, index) => {
        assert.isTrue(extension.equals(modified.transaction_extensions[index]))
    })
    modified.transaction_extensions.forEach((extension, index) => {
        assert.isTrue(extension.equals(original.transaction_extensions[index]))
    })

    // Ensure the original transaction remains
    assert.equal(original.actions.length, oldActions)

    // Ensure the modified transaction updated correctly
    assert.equal(modified.actions.length, newActions)
}

suite('utils', function () {
    suite('chainDefinition', function () {
        test('returns name', function () {
            const definition = new ChainDefinition({
                id: mockChainId,
                url: 'https://jungle4.greymass.com',
            })
            assert.equal(definition.name, 'Jungle 4 (Testnet)')
        })
        test('returns unknown', function () {
            const definition = new ChainDefinition({
                id: '3d2e128872f1e1f7dacbb3b624d21fe5875193619376c2e5e4843bbdd5deeae3',
                url: 'https://randochain.greymass.com',
            })
            assert.equal(definition.name, 'Unknown blockchain')
        })
    })
    suite('appendAction', function () {
        test('payload w/ action', async function () {
            const {action} = await mockData('old action')
            const request = await SigningRequest.create(
                {
                    action,
                    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                },
                {zlib}
            )
            const originalTransaction = request.getRawTransaction()
            const modifiedRequest = appendAction(request, newAction)
            const modifiedTransaction = modifiedRequest.getRawTransaction()
            commonAsserts(originalTransaction, modifiedTransaction)
            assert.isTrue(originalTransaction.actions[0].equals(modifiedTransaction.actions[0]))
            assert.isTrue(newAction.equals(modifiedTransaction.actions[1]))
        })
        test('payload w/ actions', async function () {
            const {action} = await mockData('old action')
            const request = await SigningRequest.create(
                {
                    actions: [action, action],
                    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                },
                {zlib}
            )
            const originalTransaction = request.getRawTransaction()
            const modifiedRequest = appendAction(request, newAction)
            const modifiedTransaction = modifiedRequest.getRawTransaction()
            commonAsserts(originalTransaction, modifiedTransaction, 2, 3)
            assert.isTrue(originalTransaction.actions[0].equals(modifiedTransaction.actions[0]))
            assert.isTrue(originalTransaction.actions[1].equals(modifiedTransaction.actions[1]))
            assert.isTrue(newAction.equals(modifiedTransaction.actions[2]))
        })
        test('payload w/ transaction', async function () {
            const {transaction} = await mockData('old action')
            const request = await SigningRequest.create(
                {
                    transaction,
                    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                },
                {zlib}
            )
            const originalTransaction = request.getRawTransaction()
            const modifiedRequest = appendAction(request, newAction)
            const modifiedTransaction = modifiedRequest.getRawTransaction()
            commonAsserts(originalTransaction, modifiedTransaction)
            assert.isTrue(originalTransaction.actions[0].equals(modifiedTransaction.actions[0]))
            assert.isTrue(newAction.equals(modifiedTransaction.actions[1]))
        })
    })
    suite('prependAction', function () {
        test('payload w/ action', async function () {
            const {action} = await mockData('old action')
            const request = await SigningRequest.create(
                {
                    action,
                    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                },
                {zlib}
            )
            const originalTransaction = request.getRawTransaction()
            const modifiedRequest = prependAction(request, newAction)
            const modifiedTransaction = modifiedRequest.getRawTransaction()
            commonAsserts(originalTransaction, modifiedTransaction)
            assert.isTrue(newAction.equals(modifiedTransaction.actions[0]))
            assert.isTrue(originalTransaction.actions[0].equals(modifiedTransaction.actions[1]))
        })
        test('payload w/ actions', async function () {
            const {action} = await mockData('old action')
            const request = await SigningRequest.create(
                {
                    actions: [action, action],
                    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                },
                {zlib}
            )
            const originalTransaction = request.getRawTransaction()
            const modifiedRequest = prependAction(request, newAction)
            const modifiedTransaction = modifiedRequest.getRawTransaction()
            commonAsserts(originalTransaction, modifiedTransaction, 2, 3)
            assert.isTrue(newAction.equals(modifiedTransaction.actions[0]))
            assert.isTrue(originalTransaction.actions[0].equals(modifiedTransaction.actions[1]))
            assert.isTrue(originalTransaction.actions[1].equals(modifiedTransaction.actions[2]))
        })
        test('payload w/ transaction', async function () {
            const {transaction} = await mockData('old action')
            const request = await SigningRequest.create(
                {
                    transaction,
                    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                },
                {zlib}
            )
            const originalTransaction = request.getRawTransaction()
            const modifiedRequest = prependAction(request, newAction)
            const modifiedTransaction = modifiedRequest.getRawTransaction()
            commonAsserts(originalTransaction, modifiedTransaction)
            assert.isTrue(newAction.equals(modifiedTransaction.actions[0]))
            assert.isTrue(originalTransaction.actions[0].equals(modifiedTransaction.actions[1]))
        })
    })
    suite('logo', function () {
        test('returns light when stringified', function () {
            const logo = Logo.from('foo')
            assert.equal(String(logo), 'foo')
        })
        test('variants always available', function () {
            const logo = Logo.from('foo')
            assert.equal(logo.getVariant('dark'), 'foo')
            assert.equal(logo.getVariant('light'), 'foo')
        })
        test('variants are correctly returned', function () {
            const logo = Logo.from({
                dark: 'foo',
                light: 'bar',
            })
            assert.equal(String(logo), 'bar')
            assert.equal(logo.getVariant('dark'), 'foo')
            assert.equal(logo.getVariant('light'), 'bar')
        })
    })
})
