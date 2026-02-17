import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, '../public'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    sourcemap: true,
  },
});
