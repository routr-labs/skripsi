import { request } from 'node:http'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, type Plugin } from 'vite'

function palmgateApiProxy(): Plugin {
  return {
    name: 'palmgate-api-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const originalUrl = (req as typeof req & { originalUrl?: string }).originalUrl ?? req.url ?? ''
        if (!originalUrl.startsWith('/api')) {
          next()
          return
        }

        const target = new URL(originalUrl, 'http://127.0.0.1:8000')
        const proxyReq = request(target, {
          method: req.method,
          headers: { ...req.headers, host: target.host },
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
          proxyRes.pipe(res)
        })

        proxyReq.on('error', (error) => {
          if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
          res.end(`API proxy failed: ${error.message}`)
        })

        req.pipe(proxyReq)
      })
    },
  }
}

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    palmgateApiProxy(),
    tanstackStart({
      srcDirectory: 'app',
    }),
    viteReact(),
    nitro(),
  ],
})
