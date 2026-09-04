// Vite + Vitest configuration. GDD 5.1 (stack), 5.6 (build hash).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    // Injected by scripts/build.ts from `git rev-parse --short HEAD`. GDD 5.6.
    __BUILD_HASH__: JSON.stringify(process.env['VITE_BUILD_HASH'] ?? 'dev'),
    __PHASE__: JSON.stringify(process.env['VITE_PHASE'] ?? 'm1'),
  },
  server: { port: 5173 },
  build: { target: 'es2022', sourcemap: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
