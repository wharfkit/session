import {resourceProviderPlugin} from './plugins/transact/resource-provider'
import {privateKeyWallet} from './plugins/wallet/privatekey'

suite('plugins', function () {
    suite('transact', function () {
        resourceProviderPlugin()
    })
    suite('wallet', function () {
        privateKeyWallet()
    })
})
