import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'assets/logo-placeholder.svg'],
        manifest: false,
        workbox: {
          navigateFallback: `${base}index.html`,
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          globIgnores: [
            '**/xlsx-*.js', '**/jspdf*.js', '**/html2canvas*.js', '**/purify*.js',
            '**/index.es-*.js', '**/TechnicalPanel-*.js', '**/MatchesPanel-*.js',
          ],
        },
      }),
    ],
    server: { port: 4173 },
    preview: { port: 4173 },
  };
});
