//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/

module.exports = (env, argv) => {
    const isDev = argv.mode === 'development';
    return {
        target: 'webworker', // vscode extensions run in webworker context for VS Code web 📖 -> https://webpack.js.org/configuration/target/#target

        entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
        output: {
            // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
            path: path.resolve(__dirname, 'dist'),
            filename: 'extension.js',
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },
        devtool: 'source-map',
        externals: {
            vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
            fs: 'commonjs fs',
            path: 'commonjs path'
        },
        resolve: {
            // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
            mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
            extensions: ['.ts', '.js'],
            alias: {
                // provides alternate implementation for node module and source files
            },
            fallback: {
                // Webpack 5 no longer polyfills Node.js core modules automatically.
                // see https://webpack.js.org/configuration/resolve/#resolvefallback
                // for the list of Node.js core module polyfills.
            }
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader'
                        }
                    ]
                }
            ]
        },
        plugins: [
            new CopyPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, 'node_modules/@vscode-elements/elements/dist/bundled.js'),
                        to: path.resolve(__dirname, 'dist/bundled.js')
                    },
                    {
                        from: path.resolve(__dirname, 'node_modules/@vscode/codicons/dist/codicon.css'),
                        to: path.resolve(__dirname, 'dist/codicon.css')
                    },
                    {
                        from: path.resolve(__dirname, 'node_modules/@vscode/codicons/dist/codicon.ttf'),
                        to: path.resolve(__dirname, 'dist/codicon.ttf')
                    }
                ]
            })
        ]
    };
};
