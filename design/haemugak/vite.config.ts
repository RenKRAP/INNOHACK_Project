import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), {
    name: 'standalone-preview',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace(/\r\n?/g, '\n').replace(/<script type="module" crossorigin/g, '<script defer'),
    },
  }],
  build: {
    outDir: '../../public/haemugak',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'main.js',
        assetFileNames: (asset) => asset.names.some((name) => name.endsWith('.css')) ? 'style.css' : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
