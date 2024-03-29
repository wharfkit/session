import fetch from 'node-fetch'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'
import {Action, AssetType, Name, NameType, PermissionLevel, Session, TransactResult} from '$lib'

import {Buyrambytes, Delegatebw, Linkauth, Newaccount, Transfer, Updateauth} from './structs'

// Mock of Fetch for debugging/testing
// import {mockFetch} from '@wharfkit/mock-data'

/**
 * THIS INFORMATION NEEDS TO BE POPULATED
 */
// Account & key used to generate the test accounts.
const permissionLevel = PermissionLevel.from('wharfkittest@active')
const privateKey = ''

// Target blockchain
const id = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d'
const url = 'https://jungle4.greymass.com'

// Owner/active key to set on all the test accounts
const controlKey = 'EOS6XXTaRpWhPwnb7CTV9zVsCBrvCpYMMPSk8E8hsJxhf6VFW9DYN'

// Test permission key to set on all the accounts
const testKey = 'EOS6RMS3nvoN9StPzZizve6WdovaDkE5KkEcCDXW7LbepyAioMiK6'

// Cosigner Key for wharfkitnoop
// const noopKey = 'EOS8WUgppBZ1NjnGASYeLwQ3PkNLvdnfnchumsSpo6ApCAzbETczm'

// Minimum RAM bytes to create an account
const requiredRamBytes = 1599

/**
 * NOTHING BELOW SHOULD NEED MODIFICATION
 */

// Accounts to create for testing
// Format: [account, token balance, CPU staked, NET staked, RAM bytes]
interface AccountDefinition {
    name: NameType
    balance?: AssetType
    cpuStake?: AssetType
    netStake?: AssetType
    ramBytes?: number
}
const accounts: AccountDefinition[] = [
    {
        name: 'wharfkit1111',
        balance: '5.0000 EOS',
        cpuStake: '1.0000 EOS',
        netStake: '1.0000 EOS',
        ramBytes: 10000,
    },
    {
        name: 'wharfkit1112',
        balance: '5.0000 EOS',
        cpuStake: undefined,
        netStake: '1.0000 EOS',
        ramBytes: 10000,
    },
    {
        name: 'wharfkit1113',
        balance: '5.0000 EOS',
        cpuStake: '1.0000 EOS',
        netStake: undefined,
        ramBytes: 10000,
    },
    {
        name: 'wharfkit1114',
        balance: '5.0000 EOS',
        cpuStake: '1.0000 EOS',
        netStake: '1.0000 EOS',
        ramBytes: undefined,
    },
    {
        name: 'wharfkit1115',
        balance: '5.0000 EOS',
        cpuStake: undefined,
        netStake: undefined,
        ramBytes: undefined,
    },
    {
        name: 'wharfkit1121',
        balance: undefined,
        cpuStake: '1.0000 EOS',
        netStake: '1.0000 EOS',
        ramBytes: 10000,
    },
    {
        name: 'wharfkit1122',
        balance: undefined,
        cpuStake: undefined,
        netStake: '1.0000 EOS',
        ramBytes: 10000,
    },
    {
        name: 'wharfkit1123',
        balance: undefined,
        cpuStake: '1.0000 EOS',
        netStake: undefined,
        ramBytes: 10000,
    },
    {
        name: 'wharfkit1124',
        balance: undefined,
        cpuStake: '1.0000 EOS',
        netStake: '1.0000 EOS',
        ramBytes: undefined,
    },
    {
        name: 'wharfkit1125',
        balance: undefined,
        cpuStake: undefined,
        netStake: undefined,
        ramBytes: undefined,
    },
    {
        name: 'wharfkit1131',
        balance: '5.0000 EOS',
        cpuStake: undefined,
        netStake: undefined,
        ramBytes: 10000,
    },
    {
        name: 'wharfkit1132',
        balance: undefined,
        cpuStake: undefined,
        netStake: undefined,
        ramBytes: 10000,
    },
    {
        name: 'wharfkit1133',
        balance: '5.0000 EOS',
        cpuStake: '1.0000 EOS',
        netStake: '1.0000 EOS',
        ramBytes: 10000,
    },
    {
        name: 'wharfkit1151',
        balance: '5.0000 EOS',
        cpuStake: undefined,
        netStake: undefined,
        ramBytes: undefined,
    },
    {
        name: 'wharfkit1152',
        balance: '5.0000 EOS',
        cpuStake: '1.0000 EOS',
        netStake: '1.0000 EOS',
        ramBytes: undefined,
    },
    {
        name: 'wharfkitnoop',
        balance: '5.0000 EOS',
        cpuStake: '1.0000 EOS',
        netStake: '1.0000 EOS',
        ramBytes: 10000,
    },
]

async function createAccount(
    session: Session,
    account: AccountDefinition
): Promise<TransactResult> {
    const actions = [
        Action.from({
            account: 'eosio',
            name: 'newaccount',
            authorization: [
                {
                    actor: permissionLevel.actor,
                    permission: permissionLevel.permission,
                },
            ],
            data: Newaccount.from({
                creator: permissionLevel.actor,
                name: account.name,
                owner: {
                    threshold: 1,
                    keys: [
                        {
                            key: controlKey,
                            weight: 1,
                        },
                    ],
                    accounts: [],
                    waits: [],
                },
                active: {
                    threshold: 1,
                    keys: [
                        {
                            // Override active key for wharfkit1133
                            // this will be used in auth tests
                            key: Name.from(account.name).equals('wharfkit1133')
                                ? testKey
                                : controlKey,
                            weight: 1,
                        },
                    ],
                    accounts: [],
                    waits: [],
                },
            }),
        }),
        Action.from({
            account: 'eosio',
            name: 'buyrambytes',
            authorization: [
                {
                    actor: permissionLevel.actor,
                    permission: permissionLevel.permission,
                },
            ],
            data: Buyrambytes.from({
                payer: permissionLevel.actor,
                receiver: account.name,
                bytes: requiredRamBytes + (account.ramBytes || 0),
            }),
        }),
    ]
    if (account.balance) {
        actions.push(
            Action.from({
                account: 'eosio.token',
                name: 'transfer',
                authorization: [
                    {
                        actor: permissionLevel.actor,
                        permission: permissionLevel.permission,
                    },
                ],
                data: Transfer.from({
                    from: permissionLevel.actor,
                    to: account.name,
                    quantity: account.balance,
                    memo: '',
                }),
            })
        )
    }
    if (account.cpuStake || account.netStake) {
        actions.push(
            Action.from({
                account: 'eosio',
                name: 'delegatebw',
                authorization: [
                    {
                        actor: permissionLevel.actor,
                        permission: permissionLevel.permission,
                    },
                ],
                data: Delegatebw.from({
                    from: 'wharfkittest',
                    receiver: account.name,
                    stake_net_quantity: account.netStake || '0.0000 EOS',
                    stake_cpu_quantity: account.cpuStake || '0.0000 EOS',
                    transfer: false,
                }),
            })
        )
    }
    const result = await session.transact({actions})
    return result
}

async function createTestPermission(account: AccountDefinition): Promise<TransactResult> {
    const session = new Session(
        {
            chain: {
                id,
                url,
            },
            // fetch: mockFetch, // To record for debug
            permissionLevel: `${account.name}@active`,
            walletPlugin: new WalletPluginPrivateKey(privateKey),
        },
        {
            fetch,
        }
    )
    const actions = [
        // Buy the RAM required to create this permission from the master account
        // Also serves as a cosigner for the transaction's CPU/NET
        Action.from({
            account: 'eosio',
            name: 'buyrambytes',
            authorization: [
                {
                    actor: permissionLevel.actor,
                    permission: permissionLevel.permission,
                },
            ],
            data: Buyrambytes.from({
                payer: permissionLevel.actor,
                receiver: account.name,
                bytes: 482,
            }),
        }),
        // Add the test permission to the account
        Action.from({
            account: 'eosio',
            name: 'updateauth',
            authorization: [
                {
                    actor: account.name,
                    permission: 'active',
                },
            ],
            data: Updateauth.from({
                account: account.name,
                permission: 'test',
                parent: 'active',
                auth: {
                    threshold: 1,
                    keys: [
                        {
                            key: testKey,
                            weight: 1,
                        },
                    ],
                    accounts: [],
                    waits: [],
                },
            }),
        }),
        // Link the test permission to the eosio.token::transfer action
        Action.from({
            account: 'eosio',
            name: 'linkauth',
            authorization: [
                {
                    actor: account.name,
                    permission: 'active',
                },
            ],
            data: Linkauth.from({
                account: account.name,
                code: 'eosio.token',
                type: 'transfer',
                requirement: 'test',
            }),
        }),
    ]
    if (account.name === 'wharfkitnoop') {
        actions.push(
            // Add the test permission to the account
            Action.from({
                account: 'eosio',
                name: 'updateauth',
                authorization: [
                    {
                        actor: account.name,
                        permission: 'active',
                    },
                ],
                data: Updateauth.from({
                    account: account.name,
                    permission: 'cosign',
                    parent: 'active',
                    auth: {
                        threshold: 1,
                        keys: [
                            {
                                key: testKey,
                                weight: 1,
                            },
                        ],
                        accounts: [],
                        waits: [],
                    },
                }),
            })
        )
        actions.push(
            // Link the test permission to the eosio.token::transfer action
            Action.from({
                account: 'eosio',
                name: 'linkauth',
                authorization: [
                    {
                        actor: account.name,
                        permission: 'active',
                    },
                ],
                data: Linkauth.from({
                    account: account.name,
                    code: 'greymassnoop',
                    type: 'noop',
                    requirement: 'cosign',
                }),
            })
        )
    }
    const result = await session.transact({actions})
    return result
}

async function run() {
    const masterSession = new Session(
        {
            chain: {
                id,
                url,
            },
            // fetch: mockFetch, // To record for debug
            permissionLevel,
            walletPlugin: new WalletPluginPrivateKey(privateKey),
        },
        {
            fetch,
        }
    )

    // Create accounts
    for (const account of accounts) {
        // Check if account exists
        try {
            await masterSession.client.v1.chain.get_account(Name.from(account.name))
            // eslint-disable-next-line no-console
            console.log(`account ${account.name} already exists`)
        } catch (e) {
            // Create account
            const result = await createAccount(masterSession, account)
            // eslint-disable-next-line no-console
            console.log(`created ${account.name} ${result.resolved?.transaction.id}`)
        }
    }

    // Create test permissions
    for (const account of accounts) {
        const existingPermission = await masterSession.client.v1.chain.get_account(
            Name.from(account.name)
        )
        const hasTestPermission = existingPermission.permissions.some((permission) => {
            return String(permission.perm_name) === 'test'
        })
        if (hasTestPermission) {
            // eslint-disable-next-line no-console
            console.log(`account ${account.name} already has test permission...`)
        } else {
            const result = await createTestPermission(account)
            // eslint-disable-next-line no-console
            console.log(
                `created test permission on ${account.name} ${result.resolved?.transaction.id}}`
            )
        }
    }
}

run()
