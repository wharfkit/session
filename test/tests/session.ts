import {assert} from 'chai'

import {makeClient} from '../utils/mock-provider'
import {makeWallet} from '../utils/mock-wallet'
import {makeMockTransaction} from '../utils/mock-transfer'
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

const mockSessionOptions: SessionOptions = {
    chain: ChainDefinition.from({
        id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
        url: 'https://jungle3.greymass.com',
    }),
    client,
    permissionLevel: PermissionLevel.from('wharfkit@session'),
    walletPlugin: wallet,
}

suite('session', function () {
    let session: Session
    setup(function () {
        // Establish new session before each test
        session = new Session(mockSessionOptions)
    })
    test('construct', function () {
        assert.instanceOf(session, Session)
    })
})
