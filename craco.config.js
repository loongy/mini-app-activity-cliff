const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  webpack: {
    configure: (config) => {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        crypto: false,
      };
      // Add CopyWebpackPlugin to copy RDKit_minimal.wasm
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.resolve(
                __dirname,
                'node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm'
              ),
              to: 'static/js', // Output to the CRA build folder
            },
          ],
        })
      );
      return config;
    },
  },
};
