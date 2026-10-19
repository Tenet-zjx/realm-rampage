import { defineConfig } from 'vite';

// Dev runs on 5190; the public cpolar tunnel (wildwoodguardiansgame.cpolar.cn) serves `vite preview` on 4180.
export default defineConfig({
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
  preview: { host: '127.0.0.1', port: 4180, strictPort: true, allowedHosts: ['wildwoodguardiansgame.cpolar.cn'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 4096, assetsInlineLimit: 0 },
});
