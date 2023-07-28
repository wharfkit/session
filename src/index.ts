// export library
export * from './index-module'

// default export is Session class for convenience
import {SessionKit} from './index-module'
export default SessionKit

// expose dependencies
export * from 'eosio-signing-request'
export * from '@wharfkit/antelope'
export * from '@wharfkit/abicache'
export * from '@wharfkit/common'
