module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: [],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Allow Jest to resolve and transform files outside the frontend root
  roots: ['<rootDir>', '<rootDir>/../database', '<rootDir>/../ai'],
  // Instruct Jest babel transform to cover database directory too
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  // Ensure proper module resolution in monorepo
  modulePaths: ['<rootDir>/node_modules', '<rootDir>/../node_modules'],
  // Exclude helper utilities from being treated as test suites
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/helpers/',
  ],
};
