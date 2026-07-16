import { Platform } from 'react-native';

/**
 * The one correct KeyboardAvoidingView behavior for this app — use it on
 * every surface with a text input. On Android, `undefined` is a no-op
 * that leaves the input covered: edge-to-edge mode (app.json
 * `edgeToEdgeEnabled`) blunts the automatic adjustResize behavior, so we
 * opt into 'height', which resizes the KAV region to just above the
 * keyboard. On iOS, 'padding' is the standard. Field-proven on the chat
 * surfaces; never write the `'ios' ? 'padding' : undefined` variant.
 */
export const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? ('padding' as const) : ('height' as const);
