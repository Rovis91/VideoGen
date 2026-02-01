import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  root: __dirname,
  publicDir: path.join(__dirname, 'public'),
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: { '@': path.join(__dirname, 'src') },
  },
});
