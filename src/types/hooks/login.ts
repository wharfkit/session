import {SessionOptions} from '../session'
import {Hook} from '../../types'

export enum LoginHookTypes {
    beforeSign = 'beforeSign',
    afterSign = 'afterSign',
    beforeBroadcast = 'beforeBroadcast',
    afterBroadcast = 'afterBroadcast',
}

export interface LoginHook extends Hook {
    process(context: SessionOptions): void
}

export interface BeforeLoginHook extends LoginHook {}
export interface AfterLoginHook extends LoginHook {}

export interface LoginHooks {
    afterLogin: AfterLoginHook[]
    beforeLogin: BeforeLoginHook[]
}
