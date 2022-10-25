import {assert} from 'chai'

import {makeClient} from './utils/mock-provider'
import {makeWallet} from './utils/mock-wallet'
import {makeMockTransaction} from './utils/mock-transfer'
import {
    ChainDefinition,
    Checksum256,
    PermissionLevel,
    Session,
    SessionOptions,
    Signature,
    Transaction,
} from '$lib'

const client = makeClient()
const wallet = makeWallet()

const defaultChainDefinition = ChainDefinition.from({
    id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
    url: 'https://jungle3.greymass.com',
})

const mockSessionOptions: SessionOptions = {
    chain: defaultChainDefinition,
    permissionLevel: 'wharfkit@session',
    walletPlugin: wallet,
}

suite('session', function () {
    test('construct', function () {
        const session = new Session(mockSessionOptions)
        assert.instanceOf(session, Session)
    })
    test('transact', async function () {
        // Create a session
        const session = new Session(mockSessionOptions)
        // Create mock transaction
        const info = await client.v1.chain.get_info()
        const transaction: Transaction = await makeMockTransaction(info)
        // Call transact and sign the transaction
        const result = await session.transact(transaction)
        // Ensure a valid transact response
        assert.instanceOf(result.chain, ChainDefinition)
        assert.instanceOf(result.signatures, Array)
        assert.instanceOf(result.signatures[0], Signature)
        assert.instanceOf(result.signer, PermissionLevel)
        assert.instanceOf(result.transaction, Transaction)
    })
})
