import buba from 'rollup-plugin-buba'

export default {
  entry: 'src/index.js',
  dest: 'dist/index.js',
  format: 'umd',
  moduleName: 'briancavalier_yet',
  sourceMap: true,
  plugins: [buba()]
};
