import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // In development (and `vite preview`) the site reads the public website API through this proxy, so the
  // browser stays on one origin, as nginx does in production. By default it reads the local API
  // (https://localhost:7187, its "https" launch profile, whose development certificate isn't checked), so
  // nothing done here touches the live site; DEV_API_TARGET in .env points it elsewhere, such as the
  // live site's API (https://id-indetails.com).
  const target = loadEnv(mode, process.cwd(), '').DEV_API_TARGET || 'https://localhost:7187'
  const local = /^https?:\/\/localhost\b/.test(target)
  const proxy = { '/api/public/website': { target, changeOrigin: true, secure: !local } }
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
