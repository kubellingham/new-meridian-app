// Metro config — Expo SDK 54 defaults plus two resolution tweaks.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// (1) Prefer CommonJS builds when packages dual-publish. zustand v5's ESM
// build uses `import.meta`, which Metro's classic-script web output can't
// parse. Listing 'browser' first also nudges packages toward browser-safe
// entry points where they publish them.
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

// (2) The Anthropic SDK's credentials submodule (Workload Identity
// Federation support) imports Node's built-in `node:fs` etc. Meridian
// only uses the client-side API key path (brief §12), so those Node
// modules are never actually called at runtime — but Metro still walks
// the import graph while bundling for Android/iOS and refuses to
// resolve `node:*`. Stub them to empty so the bundle completes.
const NODE_BUILTIN = /^node:/;
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (NODE_BUILTIN.test(moduleName)) {
    // Metro treats { type: 'empty' } as a module that exports nothing.
    return { type: 'empty' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
