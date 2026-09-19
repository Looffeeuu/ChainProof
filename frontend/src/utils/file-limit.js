/**
 * 单个成果文件的大小上限。纯常量与纯函数，不 import 本项目任何模块。
 *
 * 数值由组长 2026-09-18 定：单文件 50 MiB，前端选择时预检查，后端强制限制，
 * 超限返回 HTTP 413 + `FILE_TOO_LARGE`。前端这边拦是为了不让用户等上传完才被拒，
 * 也顺带挡住另一个问题：utils/sha256.js 的原生路径会把整个文件读进内存，
 * 几 GB 的文件能让标签页直接崩掉。
 *
 * **两边必须是同一个数。** 前端拦得比后端严，会挡住后端本来会收的文件；
 * 拦得比后端松，用户等上传完才被拒。改的话两边一起改。
 */

/** 50 MiB = 52 428 800 字节。按 1024 进位，与界面上显示的「MB」同一口径 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024

/** 1234567 → 1.2 MB。只用于显示，不参与任何计算 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

/** 上限本身的显示文字，界面各处引用它，不要各写一遍「50 MB」 */
export const MAX_FILE_LABEL = `${MAX_FILE_BYTES / 1024 / 1024} MB`

/** @param {{size:number}|null|undefined} file */
export const isTooLarge = (file) => Boolean(file) && file.size > MAX_FILE_BYTES
