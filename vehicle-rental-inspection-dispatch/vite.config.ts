import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY || '';
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/deepseek/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              if (apiKey) proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
            });
          }
        }
      }
    }
  };
});
