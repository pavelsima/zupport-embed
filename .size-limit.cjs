/* eslint-env node */
// size-limit traces transitive imports in addition to the entry file —
// the numbers are bigger than the on-disk gzipped bytes Vite reports.
// Budgets are calibrated against the traced size:
//
//   - embed.js: entry 43 KB gz on disk; with lazy wllama chunk reachable,
//     the traced graph weighs ~96 KB gz. We track that as the budget.
//   - index.js: peers are externalised so the consuming bundler dedupes,
//     but size-limit's tracer still walks the graph and reports a number
//     dominated by external deps. Looser ceiling (under 200 KB).
module.exports = [
  {
    name: 'embed.js (CDN bundle, full graph, gzip)',
    path: 'dist/embed.js',
    limit: '110 kB',
    gzip: true,
  },
  {
    name: 'index.js (npm bundle traced, gzip)',
    path: 'dist/index.js',
    limit: '180 kB',
    gzip: true,
  },
]
