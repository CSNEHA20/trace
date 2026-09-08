const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

const emptyModule = path.resolve(__dirname, 'src/utils/emptyModule.js');

config.watchFolders = [projectRoot, workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];
config.resolver.blockList = [
  /.*[/\\]\.cxx[/\\].*/,
  /.*[/\\]CMakeFiles[/\\].*/,
  /.*[/\\]CMakeTmp[/\\].*/,
  /.*[/\\]\.cli-[^/\\]+[/\\].*/,
  /.*[/\\]node_modules[/\\]@expo[/\\]\.cli-[^/\\]+[/\\].*/,
];

const singletons = [
  'react',
  'react-dom',
  'react-native',
  'react-native-web',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'expo-router',
  'expo',
  'zustand',
];

const emptyModules = {
  https: emptyModule,
  http: emptyModule,
  fs: emptyModule,
  stream: emptyModule,
  crypto: emptyModule,
  zlib: emptyModule,
  url: emptyModule,
  net: emptyModule,
  tls: emptyModule,
};

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...emptyModules,
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 1. Shims for Node builtins
  if (emptyModules[moduleName]) {
    return {
      filePath: emptyModules[moduleName],
      type: 'sourceFile',
    };
  }

  // 2. Map react-native to react-native-web on web platform
  let targetModule = moduleName;
  if (platform === 'web' && targetModule === 'react-native') {
    targetModule = 'react-native-web';
  }

  // 3. Strict singleton deduplication: force resolution to frontend/node_modules
  for (const name of singletons) {
    if (targetModule === name || targetModule.startsWith(name + '/')) {
      try {
        const resolved = require.resolve(targetModule, {
          paths: [path.resolve(projectRoot, 'node_modules')],
        });
        return {
          filePath: resolved,
          type: 'sourceFile',
        };
      } catch (e) {
        // Fallback to default resolution if not found via paths
      }
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
