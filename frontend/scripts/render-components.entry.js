/**
 * 组件预览页的服务端渲染入口，被 scripts/check-components.mjs 调用。
 * 它把 ComponentsPreviewView 渲染成 HTML 字符串，用来在没有浏览器的环境里
 * 确认组件真的能渲染、且渲染出了预期的文字（徽章文案、哈希截断结果等）。
 */
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ComponentsPreviewView from '../src/views/ComponentsPreviewView.vue'

export default () => renderToString(createSSRApp(ComponentsPreviewView))
