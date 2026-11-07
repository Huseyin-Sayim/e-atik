const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Web tarafında react-native-maps yerine @teovilla/react-native-web-maps kullanılması için alias
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-maps': path.resolve(__dirname, 'node_modules/@teovilla/react-native-web-maps'),
};

module.exports = config;
