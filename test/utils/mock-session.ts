import {PermissionLevel} from '@greymass/eosio'

import {ChainDefinition, SessionArgs, SessionOptions} from '$lib'

import {mockPermissionLevel} from '$test/utils/mock-config'
import {mockFetch} from '$test/utils/mock-fetch'
import {makeWallet} from '$test/utils/mock-wallet'

const wallet = makeWallet()

export const mockSessionArgs: SessionArgs = {
    chain: ChainDefinition.from({
        id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
        url: 'https://jungle4.greymass.com',
    }),
    permissionLevel: PermissionLevel.from(mockPermissionLevel),
    walletPlugin: wallet,
}

export const mockSessionOptions: SessionOptions = {
    broadcast: false, // Disable broadcasting by default for tests, enable when required.
    fetch: mockFetch, // Required for unit tests
}
