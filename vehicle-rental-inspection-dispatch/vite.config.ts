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
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // AWS SDK 在浏览器中使用，把 Node 内置模块替换为浏览器可用的 polyfill
        'util': 'util/',
        'stream': 'stream-browserify',
        'buffer': 'buffer/',
        'events': 'events/',
        'crypto': 'crypto-browserify',
      }
    },
    define: {
      global: 'globalThis',
      'process.env': '{}',
    },
    optimizeDeps: {
      include: [
        '@aws-sdk/client-s3',
        '@aws-sdk/lib-storage',
        '@aws-sdk/s3-request-presigner',
        '@aws-sdk/credential-provider-cognito-identity',
      ],
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
    },
    build: {
      rollupOptions: {
        external: ['@/aws-exports']
      }
    }
  };
});
