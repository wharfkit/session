import {assert} from 'chai'

import type {LocaleDefinitions} from '@wharfkit/common'
import {MockUserInterface} from '@wharfkit/mock-data'

import {
    UserInterface,
    UserInterfaceAccountCreationResponse,
    UserInterfaceTranslateOptions,
} from 'src/ui'

const mockLocaleDefinitions: LocaleDefinitions = {
    en: {
        foo: 'bar',
    },
}

const mockNamespacedLocaleDefinitions: LocaleDefinitions = {
    en: {
        unittest: {
            foo: 'bar',
        },
    },
}

class ImplementedUI extends MockUserInterface {
    addTranslations(definitions: LocaleDefinitions): void {
        this.log('addTranslations')
        this.localeDefinitions = {
            ...this.localeDefinitions,
            ...definitions,
        }
    }

    translate(key: string, options?: UserInterfaceTranslateOptions, namespace?: string): string {
        if (namespace) {
            return this.localeDefinitions.en[namespace][key]
        }
        return this.localeDefinitions.en[key] || options?.default || `[[${key} not localized]]`
    }

    onAccountCreate(): Promise<UserInterfaceAccountCreationResponse> {
        throw new Error('Not implemented in mock UI')
    }

    onAccountCreateComplete(): Promise<void> {
        throw new Error('Not implemented in mock UI')
    }
}

suite('ui', function () {
    let mockUserInterface: UserInterface
    setup(function () {
        mockUserInterface = new MockUserInterface()
    })
    suite('addTranslations', function () {
        test('should add definitions', function () {
            const ui = new ImplementedUI()
            ui.addTranslations(mockLocaleDefinitions)
            assert.deepEqual(ui.localeDefinitions, mockLocaleDefinitions)
        })
    })
    suite('getTranslate', function () {
        test('should return a function', function () {
            const t = mockUserInterface.getTranslate('unittest')
            assert.isFunction(t)
        })
        test('should return the translation', function () {
            const ui = new ImplementedUI()
            ui.addTranslations(mockNamespacedLocaleDefinitions)
            const t = ui.getTranslate('unittest')
            assert.equal(t('foo', {default: 'bar'}, 'unittest'), 'bar')
        })
    })
    suite('translate', function () {
        test('should throw if not implemented', function () {
            assert.throws(() => mockUserInterface.translate('foo'))
        })
        test('should return the translation', function () {
            const ui = new ImplementedUI()
            ui.addTranslations(mockLocaleDefinitions)
            assert.equal(ui.translate('foo'), 'bar')
        })
    })
})
