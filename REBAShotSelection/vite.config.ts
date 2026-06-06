/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createReadStream, existsSync } from 'fs'
import path from 'path'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const framesDir = env.FRAMES_DIR || path.resolve(__dirname, 'frames_annotated');

  return {
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-local-frames',
      configureServer(server) {
        server.middlewares.use('/frames', (req, res, next) => {
          const filePath = path.join(framesDir, decodeURIComponent(req.url?.replace(/^\//, '') || ''));
          if (existsSync(filePath)) {
            res.setHeader('Content-Type', 'image/jpeg');
            createReadStream(filePath).pipe(res);
          } else {
            next();
          }
        });
      },
    },
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    exclude: ['e2e/**', 'tests/**', 'node_modules/**'],
  },
  };
})
