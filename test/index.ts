import {assert} from 'chai'

import * as lib from '$lib'

suite('index', function () {
    test('maths', function () {
        assert.equal(lib.maths(1, 2), 3)
    })
})
