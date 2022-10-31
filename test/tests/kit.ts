import {assert} from 'chai'
import fetch from 'node-fetch'

import {Session, SessionKit} from '$lib'

import {makeWallet} from '../utils/mock-wallet'

const defaultSessionKitOptions = {
    appName: 'demo.app',
    chains: [
        {
            id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
            url: 'https://jungle3.greymass.com',
        },
    ],
    fetch,
    walletPlugins: [makeWallet()],
}

suite('kit', function () {
    test('construct', function () {
        const sessionKit = new SessionKit(defaultSessionKitOptions)
        assert.instanceOf(sessionKit, SessionKit)
    })
    test('login', async function () {
        const sessionKit = new SessionKit(defaultSessionKitOptions)
        const session = await sessionKit.login()
        assert.instanceOf(session, Session)
    })
})
