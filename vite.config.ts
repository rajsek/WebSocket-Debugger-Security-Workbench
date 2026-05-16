import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const entry = (path: string) => new URL(path, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: entry('popup.html'),
        sidepanel: entry('sidepanel.html'),
        panel: entry('panel.html'),
        devtools: entry('devtools.html'),
        background: entry('src/extension/background.ts'),
        content: entry('src/extension/content.ts'),
        pageEngine: entry('src/extension/pageEngine.ts'),
        pageOverlay: entry('src/extension/pageOverlay.tsx'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
