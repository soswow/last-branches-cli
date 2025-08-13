import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['bin/last-branches.js'],
  splitting: false,
  sourcemap: true,
  clean: true,
  format: 'cjs',
  dts: true,
  outDir: 'dist',
})