import {beforeSignHooks} from './plugins/hooks/beforeSign'
import {afterSignHooks} from './plugins/hooks/afterSign'
import {beforeBroadcastHooks} from './plugins/hooks/beforeBroadcast'
import {afterBroadcastHooks} from './plugins/hooks/afterBroadcast'
import {beforeLoginHooks} from './plugins/hooks/beforeLogin'
import {afterLoginHooks} from './plugins/hooks/afterLogin'
import {resourceProviderHooks} from './use-cases/hooks/resource-provider'

suite('hooks', function () {
    // Perform transact hook tests within ./tests/plugins/hooks
    suite('transactHooks', function () {
        beforeSignHooks()
        afterSignHooks()
        beforeBroadcastHooks()
        afterBroadcastHooks()
    })
    // Perform login hook tests
    suite('loginHooks', function () {
        beforeLoginHooks()
        afterLoginHooks()
    })
    suite('specific implementations', function () {
        resourceProviderHooks()
    })
})
