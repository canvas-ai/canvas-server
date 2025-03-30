import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: [
          'electron',
          'electron-store',
          'fs',
          'path',
          'os',
          'crypto',
          'url',
          'util',
          'assert',
          'process',
          'node:fs',
          'node:path',
          'node:os',
          'node:crypto',
          'node:util',
          'node:assert',
          'node:process',
          /^node:/,
        ],
      }
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      '__dirname': JSON.stringify(path.resolve()),
      '__filename': JSON.stringify(path.resolve(__filename)),
    },
    optimizeDeps: {
      exclude: ['electron-store', 'conf', 'node-machine-id'],
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      }
    }
  };
});
