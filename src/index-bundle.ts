import * as pkg from './index'
const SessionKit = pkg.default
for (const key of Object.keys(pkg)) {
    if (key === 'default') continue
    SessionKit[key] = pkg[key]
}
export default SessionKit
