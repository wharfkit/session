import {Action, Asset, Name, Serializer, Session, SessionKit, Struct, Transaction} from '$lib'

import {makeClient, mockSessionArgs, mockSessionOptions} from '@wharfkit/mock-data'
import {makeMockAction} from '@wharfkit/mock-data'
import {mockSessionKitArgs, mockSessionKitOptions} from '@wharfkit/mock-data'

// Generated contract
import EosioToken from '$test/utils/tokencontract'

const defaultAction = makeMockAction('caching test')
const json = Serializer.objectify(defaultAction)

suite('contractkit integration', function () {
    suite('passing in a contract instance', function () {
        test('session kit', async function () {
            const tokenContract = new EosioToken.Contract({
                client: makeClient('https://eos.greymass.com'),
            })
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                contracts: [tokenContract],
            })
            const {session} = await sessionKit.login()
            await session.transact({action: json}, {broadcast: false})
        })
        test('session', async function () {
            const tokenContract = new EosioToken.Contract({
                client: makeClient('https://eos.greymass.com'),
            })
            const session = new Session(mockSessionArgs, {
                ...mockSessionOptions,
                contracts: [tokenContract],
            })
            await session.transact({action: json}, {broadcast: false})
        })
        test('session.transact', async function () {
            const tokenContract = new EosioToken.Contract({
                client: makeClient('https://eos.greymass.com'),
            })
            const session = new Session(mockSessionArgs, mockSessionOptions)
            await session.transact({action: json}, {broadcast: false, contracts: [tokenContract]})
        })
    })
    suite('embedded ABIs', function () {
        suite('using structs', function () {
            test('action', async function () {
                const sessionKit = new SessionKit(mockSessionKitArgs, {
                    ...mockSessionKitOptions,
                })
                const {session} = await sessionKit.login()
                await session.transact({action: defaultAction}, {broadcast: false})
            })
            test('actions', async function () {
                const sessionKit = new SessionKit(mockSessionKitArgs, {
                    ...mockSessionKitOptions,
                })
                const {session} = await sessionKit.login()

                @Struct.type('open')
                class Open extends Struct {
                    @Struct.field(Name) owner!: Name
                    @Struct.field(Asset.Symbol) symbol!: Asset.Symbol
                    @Struct.field(Name) ram_payer!: Name
                }

                await session.transact(
                    {
                        actions: [
                            Action.from({
                                account: 'eosio.token',
                                name: 'open',
                                authorization: [
                                    {actor: '............1', permission: '............2'},
                                ],
                                data: Open.from({
                                    owner: session.actor,
                                    symbol: '4,EOS',
                                    ram_payer: session.actor,
                                }),
                            }),
                            defaultAction,
                        ],
                    },
                    {broadcast: false}
                )
            })
            test('transaction', async function () {
                const sessionKit = new SessionKit(mockSessionKitArgs, {
                    ...mockSessionKitOptions,
                })
                const {session} = await sessionKit.login()

                @Struct.type('open')
                class Open extends Struct {
                    @Struct.field(Name) owner!: Name
                    @Struct.field(Asset.Symbol) symbol!: Asset.Symbol
                    @Struct.field(Name) ram_payer!: Name
                }

                const info = await session.client.v1.chain.get_info()
                const header = info.getTransactionHeader()

                const transaction = Transaction.from({
                    ...header,
                    actions: [
                        Action.from({
                            account: 'eosio.token',
                            name: 'open',
                            authorization: [{actor: '............1', permission: '............2'}],
                            data: Open.from({
                                owner: session.actor,
                                symbol: '4,EOS',
                                ram_payer: session.actor,
                            }),
                        }),
                        defaultAction,
                    ],
                })

                await session.transact(
                    {
                        transaction,
                    },
                    {broadcast: false}
                )
            })
        })
        suite('using contractkit', function () {
            test('action', async function () {
                const sessionKit = new SessionKit(mockSessionKitArgs, {
                    ...mockSessionKitOptions,
                })
                const {session} = await sessionKit.login()

                const tokenContract = new EosioToken.Contract({
                    client: makeClient('https://eos.greymass.com'),
                })

                const action = tokenContract.action('transfer', {
                    from: session.actor,
                    to: 'wharfkitest',
                    quantity: '0.0001 EOS',
                    memo: 'test',
                })

                await session.transact({action}, {broadcast: false})
            })
            test('actions', async function () {
                const sessionKit = new SessionKit(mockSessionKitArgs, {
                    ...mockSessionKitOptions,
                })
                const {session} = await sessionKit.login()

                const tokenContract = new EosioToken.Contract({
                    client: makeClient('https://eos.greymass.com'),
                })

                const action1 = tokenContract.action('open', {
                    owner: session.actor,
                    symbol: '4,EOS',
                    ram_payer: session.actor,
                })

                const action2 = tokenContract.action('transfer', {
                    from: session.actor,
                    to: 'wharfkitest',
                    quantity: '0.0001 EOS',
                    memo: 'test',
                })

                await session.transact({actions: [action1, action2]}, {broadcast: false})
            })
            test('transaction', async function () {
                const sessionKit = new SessionKit(mockSessionKitArgs, {
                    ...mockSessionKitOptions,
                })
                const {session} = await sessionKit.login()

                const tokenContract = new EosioToken.Contract({
                    client: makeClient('https://eos.greymass.com'),
                })

                const action1 = tokenContract.action('open', {
                    owner: session.actor,
                    symbol: '4,EOS',
                    ram_payer: session.actor,
                })

                const action2 = tokenContract.action('transfer', {
                    from: session.actor,
                    to: 'wharfkitest',
                    quantity: '0.0001 EOS',
                    memo: 'test',
                })

                const info = await session.client.v1.chain.get_info()
                const header = info.getTransactionHeader()
                const transaction = Transaction.from({
                    ...header,
                    actions: [action1, action2],
                })

                await session.transact({transaction}, {broadcast: false})
            })
        })
    })
})
