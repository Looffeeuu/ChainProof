/**
 * 传输层。只做四件事（spec/02 §3.1）：拼 URL、发请求、判断成败、
 * 把 { error: { code, message } } 抛成一个带 code 的 Error。
 *
 * 业务判断一律不在这里——它不知道项目、里程碑、证书是什么。
 */

const BASE = '/api'

/** 抛给上层的错误。带 code 供分支判断，message 原样显示给用户（spec/02 §2.6） */
export class ApiError extends Error {
  constructor(message, code, status) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      ...options
    })
  } catch {
    // fetch 只有在网络层失败时才 reject（断网、跨域、服务没起来）。
    // 这类错误没有 message 可显示，这里给一句人话，否则用户看到的是 "Failed to fetch"。
    throw new ApiError('连不上服务器，请确认后端已经启动。', 'NETWORK_ERROR', 0)
  }

  // 204 没有响应体，提前返回，否则 res.json() 会抛解析错误
  if (res.status === 204) return null

  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    const err = payload?.error ?? {}
    throw new ApiError(
      err.message ?? `请求失败（HTTP ${res.status}）。`,
      err.code ?? 'HTTP_ERROR',
      res.status
    )
  }
  return payload
}

export const get = (path) => request(path)
export const post = (path, body) =>
  request(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body)
  })
