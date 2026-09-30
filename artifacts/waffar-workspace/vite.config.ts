import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const isReplit = process.env.REPL_ID !== undefined;
const rawPort = process.env.PORT || '5173';
const port = Number(rawPort);

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()];

  // Only load Replit-specific plugins in Replit dev environment
  if (process.env.NODE_ENV !== 'production' && isReplit) {
    try {
      const { default: runtimeErrorOverlay } = await import('@replit/vite-plugin-runtime-error-modal');
      plugins.push(runtimeErrorOverlay());
    } catch { /* not available outside Replit */ }
  }

  return {
    base: '/',
    envDir: path.resolve(import.meta.dirname, '../..'),
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port: isNaN(port) ? 5173 : port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    preview: {
      port: isNaN(port) ? 4173 : port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
