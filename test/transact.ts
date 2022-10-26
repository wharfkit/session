import {assert} from 'chai'

import {makeClient} from './utils/mock-provider'
import {makeWallet} from './utils/mock-wallet'
import {makeMockAction, makeMockActions, makeMockTransaction} from './utils/mock-transfer'
import {
    Action,
    ChainDefinition,
    PermissionLevel,
    PrivateKey,
    Serializer,
    Session,
    SessionOptions,
    Signature,
    Transaction,
    WalletPluginPrivateKey,
} from '$lib'

const client = makeClient()
const wallet = makeWallet()

const mockSessionOptions: SessionOptions = {
    chain: ChainDefinition.from({
        id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
        url: 'https://jungle3.greymass.com',
    }),
    client,
    permissionLevel: 'wharfkit@session',
    walletPlugin: wallet,
}

function assetValidTransactResponse(result) {
    assert.instanceOf(result.chain, ChainDefinition)
    assert.instanceOf(result.signatures, Array)
    assert.instanceOf(result.signatures[0], Signature)
    assert.instanceOf(result.signer, PermissionLevel)
    assert.instanceOf(result.transaction, Transaction)
}

suite('transact', function () {
    let action: Action
    let actions: Action[]
    let transaction: Transaction
    let session: Session
    setup(async function () {
        // Setup mock transaction data
        const info = await client.v1.chain.get_info()
        action = await makeMockAction()
        actions = await makeMockActions()
        transaction = await makeMockTransaction(info)
        // Establish new session before each test
        session = new Session(mockSessionOptions)
    })
    test('full untyped example', async function () {
        const testSession = new Session({
            chain: {
                id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
                url: 'https://jungle3.greymass.com',
            },
            client,
            permissionLevel: 'account@permission',
            walletPlugin: new WalletPluginPrivateKey({
                privateKey: '5JnUd2V5nYmRKgK9K2fRQcs3qKoi4mbcGV8Dg8EFqjjqEp9tYP5',
            }),
        })
        const result = await testSession.transact({action})
        assetValidTransactResponse(result)
    })
    test('handles: action (typed)', async function () {
        const result = await session.transact({action})
        assetValidTransactResponse(result)
    })
    test('handles: action (untyped)', async function () {
        const result = await session.transact({action: Serializer.objectify(action)})
        assetValidTransactResponse(result)
    })
    test('handles: actions (typed)', async function () {
        const result = await session.transact({actions})
        assetValidTransactResponse(result)
    })
    test('handles: actions (untyped)', async function () {
        const result = await session.transact({actions: Serializer.objectify(actions)})
        assetValidTransactResponse(result)
    })
    test('handles: transaction (typed)', async function () {
        const result = await session.transact({transaction})
        assetValidTransactResponse(result)
    })
    test('handles: transaction (untyped)', async function () {
        const result = await session.transact({transaction: Serializer.objectify(transaction)})
        assetValidTransactResponse(result)
    })
    test('handles: transaction (as typed param)', async function () {
        const result = await session.transact(transaction)
        assetValidTransactResponse(result)
    })
    test('handles: transaction (as untyped param)', async function () {
        const result = await session.transact(Serializer.objectify(transaction))
        assetValidTransactResponse(result)
    })
    test('response - type check', async function () {
        const result = await session.transact(transaction)
        assetValidTransactResponse(result)
    })
})
