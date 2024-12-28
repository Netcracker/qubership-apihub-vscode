import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';

export default [
    {
        input: 'src/extension.ts',
        output: [
            {
                dir: 'out',
                format: 'cjs'
            }
        ],
        plugins: [typescript()]
    },
    {
        input: 'src/view-init.ts',
        output: [
            {
                dir: 'out',
                format: 'cjs',
                inlineDynamicImports: true
            }
        ],
        plugins: [nodeResolve({ browser: true }), commonjs(), typescript()]
    }
];
