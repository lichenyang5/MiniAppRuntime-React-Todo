import { defineConfig, mergeConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import base from '../vite.config.ts'

export default mergeConfig(
  base,
  defineConfig({
    build: {
      outDir: '.test-site',
      rolldownOptions: {
        input: {
          app: fileURLToPath(new URL('../index.html', import.meta.url)),
          lifecycle: fileURLToPath(new URL('./fixtures/lifecycle.html', import.meta.url)),
        },
      },
    },
  }),
)
