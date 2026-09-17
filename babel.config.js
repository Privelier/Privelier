module.exports = function (api) {
  const isTest = api.env('test');

  return {
    // NativeWind's preview transform recursively wraps React Native's Jest
    // mocks. App builds keep it; tests render the same component trees with
    // their explicit inline/theme styles and do not need class compilation.
    presets: isTest ? ['babel-preset-expo'] : [['babel-preset-expo'], 'nativewind/babel'],

    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],

          alias: {
            '@': './',
            'tailwind.config': './tailwind.config.js',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
