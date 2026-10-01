import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for BharatLink end-to-end tests.
 * Videos are recorded for every test so they can be concatenated
 * into a single demo reel via  scripts/concat-videos.js.
 */
export default defineConfig({
  testDir: './scripts',
  testMatch: '**/*.e2e.ts',       // match files like  e2e-test.e2e.ts
  timeout: 60_000,                // 60 s per test
  retries: 0,

  /* Run the Next.js dev server automatically */
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },

  use: {
    baseURL: 'http://localhost:3000',
    /* Record video for every test */
    video: {
      mode: 'on',                 // always record
      size: { width: 1280, height: 720 },
    },
    screenshot: 'on',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Video & trace output directory */
  outputDir: './test-results',
});
