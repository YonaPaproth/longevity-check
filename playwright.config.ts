import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4321',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm preview',
    port: 4321,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 375, height: 812 } } },
  ],
});
