import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
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
      '/api': 'http://localhost:3000'
    }
  }
})
