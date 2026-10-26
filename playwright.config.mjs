// End-to-end UI checks (npm run test:ui). Uses the local Chrome and a dedicated dev server so the
// dev-only window.__realmApi hooks are available.
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/ui',
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5199',
    viewport: { width: 1400, height: 820 },
    launchOptions: { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] },
  },
  webServer: { command: 'npx vite --host 127.0.0.1 --port 5199 --strictPort', url: 'http://127.0.0.1:5199', reuseExistingServer: false, timeout: 60000 },
});
