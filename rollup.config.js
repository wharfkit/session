import fs from 'fs'
import dts from 'rollup-plugin-dts'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import {terser} from 'rollup-plugin-terser'

import pkg from './package.json'

const name = pkg.name
const license = fs.readFileSync('LICENSE').toString('utf-8').trim()
const banner = `
/**
 * ${name} v${pkg.version}
 * ${pkg.homepage}
 *
 * @license
 * ${license.replace(/\n/g, '\n * ')}
 */
`.trim()

const external = Object.keys(pkg.dependencies)

const exportFix = `
(function () {
    var pkg = SessionKit;
    SessionKit = pkg.default;
    for (var key in pkg) {
        if (key === 'default') continue;
        SessionKit[key] = pkg[key];
    }
})()
`

/** @type {import('rollup').RollupOptions} */
export default [
    {
        input: 'src/index-bundle.ts',
        output: {
            banner,
            file: pkg.main,
            format: 'cjs',
            sourcemap: true,
            exports: 'default',
        },
        plugins: [typescript({target: 'es6'})],
        external: Object.keys({...pkg.dependencies, ...pkg.peerDependencies}),
    },
    {
        input: 'src/index.ts',
        output: {
            banner,
            file: pkg.module,
            format: 'esm',
            sourcemap: true,
        },
        plugins: [typescript({target: 'es2020'})],
        external,
    },
    {
        input: 'src/index.ts',
        output: {banner, file: pkg.types, format: 'esm'},

        plugins: [dts()],
    },
    {
        input: pkg.module,
        output: {
            banner,
            footer: exportFix,
            name: 'SessionKit',
            file: pkg.unpkg,
            format: 'iife',
            // sourcemap: true,
            exports: 'named',
        },
        plugins: [
            resolve({browser: true}),
            commonjs(),
            json(),
            babel({
                babelHelpers: 'bundled',
                exclude: /node_modules\/core-js.*/,
                presets: [
                    [
                        '@babel/preset-env',
                        {
                            targets: '>0.25%, not dead',
                            useBuiltIns: 'usage',
                            corejs: '3',
                        },
                    ],
                ],
            }),
            terser({
                format: {
                    comments(_, comment) {
                        return comment.type === 'comment2' && /@license/.test(comment.value)
                    },
                    max_line_len: 500,
                },
            }),
        ],
        external: Object.keys({...pkg.peerDependencies}),
    },
]
