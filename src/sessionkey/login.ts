import {AbstractLoginPlugin, LoginContext, LoginHookTypes} from '../login'
import {SessionKeyConfig} from './types'
import {SessionKeyManager} from './manager'

/**
 * Configuration options for the [[SessionKeyLoginPlugin]].
 */
export interface SessionKeyLoginPluginOptions extends SessionKeyConfig {}

/**
 * Login plugin that automatically handles session key setup and validation during login flow.
 * Prompts for consent, handles conflicts, and validates whitelist mismatches.
 */
export class SessionKeyLoginPlugin extends AbstractLoginPlugin {
    private config?: SessionKeyLoginPluginOptions
    private manager?: SessionKeyManager

    constructor(options?: SessionKeyLoginPluginOptions) {
        super()
        this.config = options
        if (options) {
            this.manager = new SessionKeyManager(options)
        }
    }

    register(context: LoginContext): void {
        context.addHook(LoginHookTypes.afterLogin, async () => {
            if (!context.session) {
                return
            }

            const manager = this.manager || context.sessionKeyManager
            if (!manager) {
                return
            }

            const session = context.session
            const result = await manager.checkExistingSessionKey(session)

            if (result.exists && result.mismatch) {
                if (context.ui?.onSessionKeyMismatch) {
                    const choice = await context.ui.onSessionKeyMismatch({
                        appName: String(session.appName || 'this app'),
                        added: result.mismatch.added.map((e) => ({
                            contract: String(e.contract),
                            actions: e.actions?.map((a) => String(a)),
                        })),
                        removed: result.mismatch.removed.map((e) => ({
                            contract: String(e.contract),
                            actions: e.actions?.map((a) => String(a)),
                        })),
                    })

                    if (choice !== 'update') {
                        return
                    }
                } else {
                    return
                }
            } else {
                if (!manager.config.skipConsent && context.ui?.onSessionKeyConsent) {
                    const consent = await context.ui.onSessionKeyConsent({
                        appName: String(session.appName || 'this app'),
                        whitelist: manager.whitelist.map((e) => ({
                            contract: String(e.contract),
                            actions: e.actions?.map((a) => String(a)),
                        })),
                    })

                    if (!consent) {
                        return
                    }
                }
            }

            const onConflict = context.ui?.onSessionKeyConflict
                ? async (existingKeys: any[]) => {
                      const choice = await context.ui!.onSessionKeyConflict!({
                          appName: String(session.appName || 'this app'),
                          existingKeyCount: existingKeys.length,
                      })
                      return choice
                  }
                : undefined

            await manager.setup(session, onConflict)
        })
    }

    getConfig(): SessionKeyLoginPluginOptions | undefined {
        return this.config
    }

    getManager(): SessionKeyManager | undefined {
        return this.manager
    }
}
