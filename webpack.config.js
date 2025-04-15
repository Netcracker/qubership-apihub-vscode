'use strict';

const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/

module.exports = () => {
    return {
        target: 'webworker',

        entry: './src/extension.ts',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'extension.js',
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },
        devtool: 'source-map',
        externals: {
            vscode: 'commonjs vscode',
            fs: 'commonjs fs',
            path: 'commonjs path'
        },
        resolve: {
            mainFields: ['browser', 'module', 'main'],
            extensions: ['.ts', '.js'],
            alias: {},
            fallback: {}
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
