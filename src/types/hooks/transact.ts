import {Signature} from '@greymass/eosio'
import {SigningRequest} from 'eosio-signing-request'

import {Hook} from '../../types'
import {TransactContext} from '../contexts'

export enum TransactHookTypes {
    beforeSign = 'beforeSign',
    afterSign = 'afterSign',
    beforeBroadcast = 'beforeBroadcast',
    afterBroadcast = 'afterBroadcast',
}

export interface TransactHook extends Hook {
    process(request: SigningRequest, context: TransactContext): Promise<TransactHookResponse>
}

export interface SignHook extends TransactHook {}
export interface BroadcastHook extends TransactHook {}

export interface BeforeSignHook extends SignHook {}
export interface AfterSignHook extends SignHook {}
export interface BeforeBroadcastHook extends BroadcastHook {}
export interface AfterBroadcastHook extends BroadcastHook {}

export interface TransactHooks {
    afterSign: AfterSignHook[]
    beforeSign: BeforeSignHook[]
    afterBroadcast: AfterBroadcastHook[]
    beforeBroadcast: BeforeBroadcastHook[]
}

export interface TransactHookResponse {
    request: SigningRequest
    signatures?: Signature[]
}
