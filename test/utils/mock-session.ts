import {PermissionLevel} from '@greymass/eosio'

import {ChainDefinition, SessionOptions} from '$lib'

import {mockPermissionLevel} from '$test/utils/mock-config'
import {mockFetch} from '$test/utils/mock-fetch'
import {makeWallet} from '$test/utils/mock-wallet'

const wallet = makeWallet()

export const mockSessionOptions: SessionOptions = {
    broadcast: false, // Disable broadcasting by default for tests, enable when required.
    chain: ChainDefinition.from({
        id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
        url: 'https://jungle4.greymass.com',
    }),
    fetch: mockFetch, // Required for unit tests
    permissionLevel: PermissionLevel.from(mockPermissionLevel),
    walletPlugin: wallet,
}
