import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8765',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx http-server -p 8765 -c-1',
    port: 8765,
    reuseExistingServer: true,
  },
});
