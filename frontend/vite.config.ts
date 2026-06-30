import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

const staticBuild = process.env.STATIC_BUILD === 'true'
const staticIndexPath = resolve(process.cwd(), 'dist/client/index.html')

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(
      staticBuild
        ? {
            spa: {
              enabled: true,
              prerender: {
                outputPath: '/index',
              },
            },
          }
        : {
            prerender: {
              enabled: false,
            },
          },
    ),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    staticBuild && {
      name: 'exit-after-static-index',
      apply: 'build',
      buildStart() {
        rmSync(staticIndexPath, { force: true })
      },
      closeBundle() {
        const interval = setInterval(() => {
          if (existsSync(staticIndexPath)) {
            clearInterval(interval)
            process.exit(0)
          }
        }, 100)

        setTimeout(() => {
          clearInterval(interval)
          process.exit(1)
        }, 60000)
      },
    },
  ],
})

export default config
