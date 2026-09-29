import { defineConfig } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT || 5174);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.mjs', fullyParallel: false,
  use: { baseURL, browserName: 'chromium', headless: true, screenshot: 'off', trace: 'off', video: 'off' },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL, reuseExistingServer: false,
    env: { VITE_GAS_URL: 'https://script.google.com/macros/s/LOCAL_TEST/exec' },
  },
});
