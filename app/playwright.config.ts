import { defineConfig } from '@playwright/test'

// Locally the installed Google Chrome is used (nothing is downloaded). In GitHub Actions the
// workflow sets E2E_BROWSER=chromium and installs it with `npx playwright install --with-deps chromium`.
const PORT = 4173
const channel = process.env.E2E_BROWSER === 'chromium' ? undefined : 'chrome'
const inCI = !!process.env.GITHUB_ACTIONS

export default defineConfig({
  testDir: './e2e',
  // Kept inside node_modules so nothing generated shows up in git status.
  outputDir: './node_modules/.cache/playwright/results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: inCI ? 1 : 0,
  reporter: inCI ? [['github'], ['list'], ['html', { open: 'never', outputFolder: './node_modules/.cache/playwright/report' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel,
    headless: true,
    // The map and the 3D need WebGL; software rendering works in headless runs.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Serves the production build (run `npm run build` first; `npm run test:e2e` does it).
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !inCI,
    timeout: 60_000,
  },
})
