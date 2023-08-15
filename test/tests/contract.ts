import {Session, SessionKit} from '$lib'

import {makeClient, mockSessionArgs, mockSessionOptions} from '@wharfkit/mock-data'
import {makeMockAction} from '@wharfkit/mock-data'
import {mockSessionKitArgs, mockSessionKitOptions} from '@wharfkit/mock-data'
import ContractKit from '@wharfkit/contract'

suite('contractkit integration', function () {
    suite('session kit', function () {
        test('accepts contract instances', async function () {
            const contractKit = new ContractKit({client: makeClient('https://eos.greymass.com')})
            const systemContract = await contractKit.load('eosio.token')
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                contracts: [systemContract],
            })
            const {session} = await sessionKit.login()
            await session.transact({action: makeMockAction('caching test')}, {broadcast: false})
        })
    })
    suite('session', function () {
        test('accepts contract instances', async function () {
            const contractKit = new ContractKit({client: makeClient('https://eos.greymass.com')})
            const systemContract = await contractKit.load('eosio.token')
            const session = new Session(mockSessionArgs, {
                ...mockSessionOptions,
                contracts: [systemContract],
            })
            await session.transact({action: makeMockAction('caching test')}, {broadcast: false})
        })
    })
    suite('transact', function () {
        test('accepts contract instances', async function () {
            const contractKit = new ContractKit({client: makeClient('https://eos.greymass.com')})
            const systemContract = await contractKit.load('eosio.token')
            const session = new Session(mockSessionArgs, mockSessionOptions)
            await session.transact(
                {action: makeMockAction('caching test')},
                {broadcast: false, contracts: [systemContract]}
            )
        })
    })
})
