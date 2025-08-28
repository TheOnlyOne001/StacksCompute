import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'clarinet',
    globals: true,
    environmentOptions: {
      clarinet: {
        manifestPath: './Clarinet.toml',
        coverage: false,
        costs: false,
        coverageFilename: 'lcov.info',
        costsFilename: 'costs-reports.json',
      },
    },
    exclude: [
      'tests/unit/**', // Deno-based Clarinet tests (not for Vitest)
    ],
  },
});