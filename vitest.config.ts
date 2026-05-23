import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/ssr/**/*.test.ts'],
    environment: 'node',
    typecheck: {
      enabled: false,
    },
  },
});
