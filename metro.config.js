const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix: @react-native-ml-kit/text-recognition ships TypeScript source files
// which need to be transformed by Babel rather than stripped directly.
config.transformer.transformIgnorePatterns = [
  'node_modules/(?!(' +
    '@react-native-ml-kit|' +
    'react-native|' +
    '@react-native|' +
    'expo|' +
    '@expo|' +
    '@unimodules' +
  ')/)',
];

module.exports = config;
