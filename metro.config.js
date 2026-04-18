const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for Windows absolute paths
config.resolver.assetExts.push('cjs');

module.exports = config;
