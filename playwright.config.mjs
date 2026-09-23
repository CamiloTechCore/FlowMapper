import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.mjs', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', headless: true, screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174', reuseExistingServer: false,
    env: { VITE_GAS_URL: 'https://script.google.com/macros/s/LOCAL_TEST/exec' },
  },
});
