import {Signature} from '@greymass/eosio'
import {SigningRequest} from 'eosio-signing-request'

import {SessionOptions} from './session'
import {TransactContext} from './transact'

export enum LoginHookTypes {
    beforeLogin = 'beforeLogin',
    afterLogin = 'afterLogin',
}

export type LoginHook = (context: SessionOptions) => Promise<void>

export interface LoginHooks {
    afterLogin: LoginHook[]
    beforeLogin: LoginHook[]
}

export enum TransactHookTypes {
    beforeSign = 'beforeSign',
    afterSign = 'afterSign',
    beforeBroadcast = 'beforeBroadcast',
    afterBroadcast = 'afterBroadcast',
}

export type TransactHook = (
    request: SigningRequest,
    context: TransactContext
) => Promise<TransactHookResponse>

export interface TransactHooks {
    afterSign: TransactHook[]
    beforeSign: TransactHook[]
    afterBroadcast: TransactHook[]
    beforeBroadcast: TransactHook[]
}

export interface TransactHookResponse {
    request: SigningRequest
    signatures?: Signature[]
}
