/**
 * SHA-256（FIPS 180-4）。纯函数模块，不 import 本项目任何模块。
 *
 * **为什么不只用 `crypto.subtle`**：它只在安全上下文里存在。
 * 在 `http://192.168.x.x` 这种地址下 `window.crypto` 还在，
 * 但 `crypto.subtle` 是 undefined，直接用会抛 TypeError。
 * 本项目要求 http / https / localhost 都能跑，所以有它就用，没有就用下面这份。
 *
 * 两条路径的结果必须一致，由 check-data.mjs 拿 FIPS 标准向量
 * 与 Node 内置实现逐一比对保证。写成 update/digest 的形式，
 * 大文件可以分块喂，内存不随文件大小增长。
 */

/** 前 64 个素数立方根小数部分的前 32 位，FIPS 180-4 §4.2.2 的常量表 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

/** 循环右移。JS 没有这个运算符，`>>>` 移出去的位要从左边补回来 */
const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0

/**
 * 可分块喂数据的 SHA-256。
 *
 *   const h = new Sha256()
 *   h.update(bytes1); h.update(bytes2)
 *   h.digest()   // → 64 位小写十六进制
 *
 * 内部按 64 字节一块处理。喂进来的数据凑不满一块时先存在 `block` 里等下一次，
 * 所以调用方怎么切分都不影响结果。
 */
export class Sha256 {
  constructor() {
    /** 8 个初始哈希值：前 8 个素数平方根小数部分的前 32 位（FIPS 180-4 §5.3.3） */
    this.h = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ])
    this.block = new Uint8Array(64)
    this.blockLen = 0
    /** 一共喂进来多少字节。收尾时要把它的**位数**写进最后 8 个字节 */
    this.total = 0
    /** 消息扩展用的工作数组。复用同一个，避免每块都新建 */
    this.w = new Uint32Array(64)
  }

  /** @param {Uint8Array} bytes */
  update(bytes) {
    this.total += bytes.length
    let offset = 0

    // 先把上一次剩下的半块补满
    if (this.blockLen > 0) {
      const need = Math.min(64 - this.blockLen, bytes.length)
      this.block.set(bytes.subarray(0, need), this.blockLen)
      this.blockLen += need
      offset = need
      if (this.blockLen === 64) {
        this.#compress(this.block)
        this.blockLen = 0
      }
    }

    // 整块的部分直接处理，不经过缓冲区
    while (offset + 64 <= bytes.length) {
      this.#compress(bytes.subarray(offset, offset + 64))
      offset += 64
    }

    // 尾巴留到下一次
    if (offset < bytes.length) {
      this.block.set(bytes.subarray(offset), 0)
      this.blockLen = bytes.length - offset
    }
    return this
  }

  /** @returns {string} 64 位小写十六进制 */
  digest() {
    const total = this.total

    // 收尾填充（FIPS 180-4 §5.1.1）：先补一个 0x80，再补 0，
    // 直到长度对 64 取余等于 56，最后 8 个字节放原始消息的位数（大端）。
    const tail = new Uint8Array(this.blockLen < 56 ? 64 : 128)
    tail.set(this.block.subarray(0, this.blockLen), 0)
    tail[this.blockLen] = 0x80

    const view = new DataView(tail.buffer)
    // 位数可能超过 32 位（文件大于 512MB），所以拆成高低两个 32 位写。
    // JS 的数字在 2^53 以内是精确的，除法和 >>> 0 都不会丢位。
    view.setUint32(tail.length - 8, Math.floor(total / 0x20000000), false)
    view.setUint32(tail.length - 4, (total * 8) >>> 0, false)

    for (let i = 0; i < tail.length; i += 64) this.#compress(tail.subarray(i, i + 64))

    let hex = ''
    for (let i = 0; i < 8; i++) hex += (this.h[i] >>> 0).toString(16).padStart(8, '0')
    return hex
  }

  /**
   * 压缩一个 64 字节块（FIPS 180-4 §6.2.2）。
   * @param {Uint8Array} chunk 正好 64 字节
   */
  #compress(chunk) {
    const w = this.w

    // 前 16 个字是这一块本身，按大端读成 32 位整数
    for (let i = 0; i < 16; i++) {
      const j = i * 4
      w[i] = ((chunk[j] << 24) | (chunk[j + 1] << 16) | (chunk[j + 2] << 8) | chunk[j + 3]) >>> 0
    }
    // 后 48 个字由前面的推出来（消息扩展）
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]
      const y = w[i - 2]
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = this.h

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0
      const ch = ((e & f) ^ (~e & g)) >>> 0
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0
      const t2 = (S0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }

    this.h[0] = (this.h[0] + a) >>> 0
    this.h[1] = (this.h[1] + b) >>> 0
    this.h[2] = (this.h[2] + c) >>> 0
    this.h[3] = (this.h[3] + d) >>> 0
    this.h[4] = (this.h[4] + e) >>> 0
    this.h[5] = (this.h[5] + f) >>> 0
    this.h[6] = (this.h[6] + g) >>> 0
    this.h[7] = (this.h[7] + h) >>> 0
  }
}

/**
 * 一次性算一段字节的 SHA-256，纯 JavaScript 路径。
 * @param {Uint8Array} bytes
 * @returns {string} 64 位小写十六进制
 */
export function sha256Bytes(bytes) {
  return new Sha256().update(bytes).digest()
}

/** 浏览器有没有给我们原生实现。http 下没有，见文件头的说明 */
export function hasNativeDigest() {
  return typeof globalThis.crypto?.subtle?.digest === 'function'
}

/** ArrayBuffer → 64 位小写十六进制 */
function toHex(buffer) {
  let hex = ''
  for (const b of new Uint8Array(buffer)) hex += b.toString(16).padStart(2, '0')
  return hex
}

/** 一次最多读进来多少字节。纯 JS 路径按这个粒度分片，好让界面有机会刷新 */
const CHUNK = 1024 * 1024

/**
 * 算一个 File / Blob 的 SHA-256。
 *
 * 算的是**文件的原始字节流**，不含文件名、大小、修改时间——
 * 这一点必须和后端一致，否则两边永远对不上（见 docs/API.md §3）。
 *
 * @param {Blob} file
 * @param {{ onProgress?: (ratio: number) => void, signal?: AbortSignal }} [options]
 *        onProgress 收到 0–1 的比例。只有纯 JS 路径会多次回调，
 *        原生路径直接从 0 跳到 1——原生实现没有中途的进度可报。
 *
 *        signal 用标准的 AbortSignal，不引依赖。已取消时抛 AbortError，
 *        调用方要按名字放过它（那不是失败，是用户自己叫停的）。
 *        **只有 signal 不足以保证正确**：原生路径中途没有检查点，
 *        取消之后它仍会跑完，只是结果被丢掉。所以调用方还必须自己拿一张票据，
 *        判断「这次回来的结果是不是最后一次发起的」，
 *        否则先发起的那次会把后发起的结果覆盖掉。
 * @returns {Promise<string>} 64 位小写十六进制
 */
export async function hashFile(file, options = {}) {
  const { onProgress, signal } = options
  signal?.throwIfAborted()
  onProgress?.(0)

  if (hasNativeDigest()) {
    // 原生路径是一次性的，中途插不进检查点。但它本来就快，
    // 代价可以接受——算完再检查一次，已取消就把结果丢掉，不让调用方写进界面
    const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    signal?.throwIfAborted()
    onProgress?.(1)
    return toHex(digest)
  }

  // 兜底路径：切片读、分块喂。
  // 每块之间让出一次事件循环，否则大文件会把界面卡住，
  // 用户看到的是一个假死的页面而不是「正在计算」。
  // 让出的那一刻正好是插入取消检查的地方，不需要为此改算法。
  const hasher = new Sha256()
  for (let offset = 0; offset < file.size; offset += CHUNK) {
    signal?.throwIfAborted()
    const slice = file.slice(offset, Math.min(offset + CHUNK, file.size))
    hasher.update(new Uint8Array(await slice.arrayBuffer()))
    onProgress?.(Math.min(1, (offset + CHUNK) / file.size))
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  signal?.throwIfAborted()
  onProgress?.(1)
  return hasher.digest()
}
