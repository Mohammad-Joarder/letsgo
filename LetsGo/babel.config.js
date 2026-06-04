/**
 * Use require.resolve() so Metro/Babel always load from this app's node_modules on EAS
 * (Linux) — avoids "Cannot find module 'babel-preset-expo'" when hoisting differs from local Windows.
 * Order: reanimated plugin must stay last (NativeWind stays in presets per nativewind.dev).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [require.resolve("babel-preset-expo"), { jsxImportSource: "nativewind" }],
      require.resolve("nativewind/babel"),
    ],
    plugins: [require.resolve("react-native-reanimated/plugin")],
  };
};
