import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
