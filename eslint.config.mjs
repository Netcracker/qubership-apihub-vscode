import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
    { ignores: ['out'] },
    eslint.configs.recommended,
    ...tseslint.configs.strict,
    eslintPrettierRecommended
);
