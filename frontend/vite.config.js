import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 配置写成函数形式，是为了能读到 `.env.local` 里的 `VITE_API_TARGET`。
 *
 * Vite 只把 `VITE_` 开头的变量注入**页面代码**的 `import.meta.env`；
 * 配置文件跑在 Node 里，那时 `.env.local` 还没被读进 `process.env`，
 * 所以这里显式调一次 `loadEnv`。
 *
 * 后端不在本机 3000 时（联调），在 `frontend/.env.local` 里写：
 *
 *   VITE_API_TARGET=http://192.168.1.23:3000
 *
 * 前端代码里的请求路径始终是同源的 `/api/...`（`api/client.js`），
 * 由这个代理转发过去——浏览器看到的一直是同源请求，**不涉及跨域**，
 * 后端那边不必为前端配 CORS。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    build: {
      rollupOptions: {
        output: {
          /**
           * 把 Vue 运行时单独分出来。
           *
           * 不分的话它会被并进 `_plugin-vue_export-helper` 这个 chunk——
           * 那个 helper 本身只有几行，产物却是 56 kB，名字和内容对不上，
           * 将来查体积时会被它误导。分包策略本身是对的（首屏只下载当前页），
           * 这一改只是让名字说实话。
           */
          manualChunks(id) {
            // rolldown（Vite 8 的打包器）只接受函数形式，对象形式会直接报
            // 「manualChunks is not a function」。id 里的路径分隔符已经被
            // 规范化成正斜杠，Windows 上也一样
            if (
              id.includes('/node_modules/vue/') ||
              id.includes('/node_modules/vue-router/') ||
              id.includes('/node_modules/@vue/')
            ) {
              return 'vendor'
            }
          }
        }
      }
    },
    plugins: [vue()],
    server: {
      port: 5173,
      proxy: {
        '/api': env.VITE_API_TARGET || 'http://localhost:3000'
      }
    }
  }
})
