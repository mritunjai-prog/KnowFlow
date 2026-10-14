import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app'],
      proxy: env.API_PROXY_TARGET
        ? { '/api': { target: env.API_PROXY_TARGET, changeOrigin: true, secure: true } }
        : undefined,
    },
    build: {
      rolldownOptions: {
        output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules\/three\// }] } },
      },
    },
  };
});
