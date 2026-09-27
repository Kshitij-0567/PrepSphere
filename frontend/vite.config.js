import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The whiteboard (Excalidraw) loads its hand-drawn fonts at runtime. Serve them from this site
// (window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/') instead of Excalidraw's default CDN.
const EXCALIDRAW_FONTS = path.resolve('node_modules/@excalidraw/excalidraw/dist/prod/fonts')
const FONT_ROUTE = '/excalidraw-assets/fonts'

function excalidrawFonts() {
  return {
    name: 'excalidraw-fonts',
    configureServer(server) {
      server.middlewares.use(FONT_ROUTE, (req, res, next) => {
        const file = path.join(EXCALIDRAW_FONTS, decodeURIComponent((req.url || '').split('?')[0]))
        if (!file.startsWith(EXCALIDRAW_FONTS + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
        res.setHeader('Content-Type', 'font/woff2')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        fs.createReadStream(file).pipe(res)
      })
    },
    writeBundle(options) {
      fs.cpSync(EXCALIDRAW_FONTS, path.join(options.dir || 'dist', FONT_ROUTE), { recursive: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), excalidrawFonts()],
  // Pre-bundle the interview room's editor, whiteboard and face tracking so the dev server
  // doesn't re-optimize (and reload) the first time a candidate reaches those steps.
  optimizeDeps: {
    include: [
      '@uiw/react-codemirror', '@codemirror/view', '@codemirror/language', '@lezer/highlight',
      '@codemirror/lang-python', '@codemirror/lang-javascript', '@codemirror/lang-java', '@codemirror/lang-cpp',
      '@codemirror/legacy-modes/mode/go', '@codemirror/legacy-modes/mode/verilog', '@codemirror/legacy-modes/mode/sql',
      '@excalidraw/excalidraw', '@mediapipe/tasks-vision',
    ],
  },
})
