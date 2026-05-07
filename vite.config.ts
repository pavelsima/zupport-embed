import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Peers externalised in the `lib` build for npm consumers (so their
// bundler dedupes Lit, Fuse, etc.). The `embed` build is self-contained
// for use as a single CDN script tag on stranger sites — these peers are
// inlined there.
const EXTERNAL_FOR_LIB = [
  'lit',
  'lit/decorators.js',
  'lit/directives/unsafe-html.js',
  'fuse.js',
  'marked',
  'franc-min',
  '@huggingface/transformers',
  '@wllama/wllama',
]

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib'

  return {
    build: {
      outDir: 'dist',
      // Both passes write into dist/, so don't blow it away on the second
      // pass. The `clean` script in package.json handles that explicitly.
      emptyOutDir: false,
      sourcemap: true,
      target: 'es2022',
      lib: isLib
        ? {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: () => 'index.js',
          }
        : {
            entry: resolve(__dirname, 'src/embed.ts'),
            formats: ['es'],
            fileName: () => 'embed.js',
          },
      rollupOptions: {
        external: isLib
          ? (id) => EXTERNAL_FOR_LIB.some((ext) => id === ext || id.startsWith(`${ext}/`))
          : // The CDN bundle inlines everything except runtime-imported CDN
            // URLs (transformers.js loaded inside the workers).
            (id) => /^https?:\/\//.test(id),
        // Tree-shaking strips Lit's @customElement decorator side effects
        // because rollup can't see that __decorate(...) registers a custom
        // element. Disable module-level dead-code elimination on this build
        // — the side effects ARE the point.
        treeshake: isLib ? undefined : { moduleSideEffects: true },
        output: {},
      },
    },
    worker: {
      format: 'es',
    },
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
  }
})
