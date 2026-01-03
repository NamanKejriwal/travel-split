// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Ensure you have this file created as well, or remove this line if you haven't created it yet
    setupFiles: ['./vitest.setup.ts'], 
  },
})