// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Add our functions directory to the existing ignores list
    ignores: ["dist/*", "supabase/functions/**"],
  },
]);
