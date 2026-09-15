import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', screenshot: 'only-on-failure' },
  webServer: [
    { command: '..\\.venv\\Scripts\\python.exe -m uvicorn intelligence.api:create_app --factory --host 127.0.0.1 --port 8000', url: 'http://127.0.0.1:8000/api/health', reuseExistingServer: false, env: { DATA_PATH: '../.local/browser-enterprise-v2.sqlite3', APP_MODE: 'local', BOOTSTRAP_PASSWORD: 'Strong-Browser-Password-2026' } },
    { command: 'npm.cmd run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
  ],
})
