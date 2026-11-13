const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expoConfig,
  {
    // French punctuation inside React Native <Text> is intentional content.
    // All other Expo, TypeScript and Hooks rules remain active.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
]);
