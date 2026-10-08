/**
 * 把一个 Blob 交给浏览器保存成文件。
 *
 * 为什么不直接 `<a href="/api/milestones/:id/file">`：那样发出的请求带不上
 * `X-Member-Id`，后端没法判断下载的人是不是项目成员（#25）。
 * 所以先用 fetch 把字节取回来，再在本地造一个临时链接触发保存——
 * 字节原样落盘，不经过任何转换，下载下来的就是上传时的那一份。
 *
 * 临时链接稍后再释放：点击之后立刻 revoke，个别浏览器会在开始写盘之前就丢掉数据。
 *
 * @param {Blob} blob
 * @param {string} fileName 保存时用的文件名
 */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
