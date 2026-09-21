/**
 * 传输层。只做五件事（spec/02 §3.1）：拼 URL、带上身份、发请求、判断成败、
 * 把 { error: { code, message } } 抛成一个带 code 的 Error。
 *
 * 业务判断一律不在这里——它不知道项目、里程碑、证书是什么。
 *
 * 为什么身份放在这一层：C 线定的方案是请求头 `X-Member-Id`（docs/API.md §0），
 * 这是**所有请求都要带**的横切信息。放在资源函数里的话，
 * 十几个函数每个都要接一个 memberId 参数再传下来，漏一个就少一个请求带不上身份，
 * 而且这种漏掉不会报错，只会让后端以为没有登录。
 */
import { session } from '../stores/session.js'

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
  // FormData 的 Content-Type 必须由浏览器自己设——它要在里面带上分隔串（boundary），
  // 手写会让后端解析不出字段
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }

  // 当前演示身份。真正的登录态接上之后，改这一行即可（docs/API.md §0）
  if (session.currentMemberId) headers['X-Member-Id'] = session.currentMemberId

  let res
  try {
    res = await fetch(`${BASE}${path}`, { headers, ...options })
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
