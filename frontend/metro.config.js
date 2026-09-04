const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Explicitly set project & watch roots to avoid looking for root node_modules
config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = config;
