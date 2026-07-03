// Metro config — Expo SDK 54 defaults plus one resolution tweak.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prefer CommonJS builds when packages dual-publish. zustand v5's ESM build
// uses `import.meta`, which Metro's classic-script web output can't parse.
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = config;
