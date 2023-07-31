import {beforeSignHooks} from './plugins/hooks/beforeSign'

suite('hooks', function () {
    // Perform transact hook tests within ./tests/plugins/hooks
    suite('transactHooks', function () {
        beforeSignHooks()
        // afterSignHooks()
        // afterBroadcastHooks()
    })
    // Perform login hook tests
    suite('loginHooks', function () {
        // beforeLoginHooks()
        // afterLoginHooks()
    })
})
