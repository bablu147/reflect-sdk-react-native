const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');
const fs = require('fs');

// The Reflect SDK is symlinked into node_modules (npm `file:` dep) and carries its
// own dev node_modules (react-native/react). Force Metro to resolve EVERY dependency
// to the app's single copy, and watch the SDK's real path so its source is bundled.
const sdkRoot = fs.realpathSync(path.resolve(__dirname, 'node_modules/@reflect-sdk/react-native'));
const appNodeModules = path.resolve(__dirname, 'node_modules');

const config = {
  watchFolders: [sdkRoot],
  resolver: {
    extraNodeModules: new Proxy(
      {},
      {get: (_t, name) => path.join(appNodeModules, name.toString())},
    ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
