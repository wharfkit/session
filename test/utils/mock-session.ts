import {PermissionLevel} from '@greymass/eosio'

import {
    Session,
    SessionArgs,
    SessionKit,
    SessionKitArgs,
    SessionKitOptions,
    SessionOptions,
} from '$lib'

import {
    mockChainDefinition,
    mockChainDefinitions,
    mockPermissionLevel,
} from '$test/utils/mock-config'
import {mockFetch} from '$test/utils/mock-fetch'
import {makeWallet} from '$test/utils/mock-wallet'
import {MockStorage} from './mock-storage'
import {MockUserInterface} from './mock-userinterface'

const wallet = makeWallet()

export const mockSessionKitArgs: SessionKitArgs = {
    appName: 'unittest',
    chains: mockChainDefinitions,
    ui: new MockUserInterface(),
    walletPlugins: [wallet],
}

export const mockSessionKitOptions: SessionKitOptions = {
    fetch: mockFetch, // Required for unit tests
    storage: new MockStorage(),
}

export const mockSessionKit = new SessionKit(mockSessionKitArgs, mockSessionKitOptions)

export const mockSessionArgs: SessionArgs = {
    chain: mockChainDefinition,
    permissionLevel: PermissionLevel.from(mockPermissionLevel),
    walletPlugin: wallet,
}

export const mockSessionOptions: SessionOptions = {
    broadcast: false, // Disable broadcasting by default for tests, enable when required.
    fetch: mockFetch, // Required for unit tests
}

export const mockSession = new Session(mockSessionArgs, mockSessionOptions)
