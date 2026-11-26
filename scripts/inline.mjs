import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * 把 dist 的 JS/CSS 内联进单个 HTML，产出可双击打开（file://）的独立演示文件。
 * 内联 module script 不受 file:// 的 CORS 限制，因此无需启动服务器。
 */
const dist = resolve(process.cwd(), 'dist')
let html = readFileSync(join(dist, 'index.html'), 'utf8')

const assets = readdirSync(join(dist, 'assets'))
const js = assets.find((f) => f.endsWith('.js'))
const css = assets.find((f) => f.endsWith('.css'))

if (!js) {
  console.error('未找到构建产物，请先执行 npm run build')
  process.exit(1)
}

const jsCode = readFileSync(join(dist, 'assets', js), 'utf8').replace(/<\/script>/g, '<\\/script>')
const cssCode = css ? readFileSync(join(dist, 'assets', css), 'utf8').replace(/<\/style>/g, '<\\/style>') : ''

html = html
  .replace(/<link rel="stylesheet"[^>]*>/g, '')
  .replace(/<link rel="modulepreload"[^>]*>/g, '')
  .replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/g, '')

// 注意：替换串里含 $ 等字符时，String.replace 会做特殊解释，必须用函数形式避免被吃掉
html = html
  .replace('</head>', () => `  <style>${cssCode}</style>\n  </head>`)
  .replace('</body>', () => `  <script type="module">${jsCode}</script>\n  </body>`)

const out = join(dist, 'kubepilot-standalone.html')
writeFileSync(out, html, 'utf8')
console.log(`✓ 已生成单文件演示：${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`)
