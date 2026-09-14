'use strict'

/**
 * Fabric ChaincodeStub 的测试替身。
 *
 * 刻意与 fabric-shim 2.5.8 的真实语义对齐，避免测试通过但真链失败。
 * 一致性由仓库根的 verify-mock-parity.js 逐字节校验（对照真实 ChaincodeStub 原型方法）。
 *
 *   - 复合键格式：`\x00` + objectType + `\x00` + (attr + `\x00`)...
 *     注意 objectType 之后同样带分隔符，这是与直觉不同、也是最容易写错的一点。
 *     对应 fabric-shim 的 COMPOSITEKEY_NS / MIN_UNICODE_RUNE_VALUE（两者都是 '\x00'）。
 *   - splitCompositeKey：不以 '\x00' 开头或长度 <= 1 时返回 {objectType:null, attributes:[]}，
 *     不抛错（与真实实现一致）。
 *   - getStateByRange(startKey, endKey)：按字节序，含 start、不含 end；
 *     空 startKey 替换为 EMPTY_KEY_SUBSTITUTE('\x01')；键不得以 '\x00' 开头（validateSimpleKeys）。
 *   - getStateByPartialCompositeKey：直接走内部范围查询、跳过 validateSimpleKeys
 *     （真实实现调用 handleGetStateByRange 而非 getStateByRange），上界为 partialKey + MAX_UNICODE_RUNE。
 *   - putState 追加历史记录，供 getHistoryForKey 回放。
 *   - getTxTimestamp 返回 protobuf Long 形态 { seconds: { toString() }, nanos }。
 */

/** fabric-shim: COMPOSITEKEY_NS，也是属性分隔符 MIN_UNICODE_RUNE_VALUE */
const NULL = '\x00'
const COMPOSITEKEY_NS = '\x00'
const MIN_UNICODE_RUNE_VALUE = '\u0000'
/** fabric-shim: getStateByRange 对空 startKey 的替换值 */
const EMPTY_KEY_SUBSTITUTE = '\x01'
/** '\u{10ffff}' 与 '\udbff\udfff' 在 JS 中是同一个字符串（UTF-16 代理对） */
const MAX_UNICODE_RUNE_VALUE = '\u{10ffff}'

/**
 * 对齐 fabric-shim 的 validateSimpleKeys：
 * 简单键不得以复合键命名空间 '\x00' 开头，避免简单键与复合键冲突。
 */
function validateSimpleKeys (...keys) {
  keys.forEach((key) => {
    if (key && typeof key === 'string' && key.charAt(0) === COMPOSITEKEY_NS) {
      throw new Error(`first character of the key [${key}] contains a null character which is not allowed`)
    }
  })
}

/** 按键做字节序比较 */
function compareKeys (a, b) {
  const left = Buffer.from(String(a), 'utf8')
  const right = Buffer.from(String(b), 'utf8')
  return Buffer.compare(left, right)
}

class MockIterator {
  constructor (entries) {
    this._entries = entries
    this._index = 0
    this.closed = false
  }

  async next () {
    if (this._index >= this._entries.length) {
      return { done: true, value: null }
    }
    return { done: false, value: this._entries[this._index++] }
  }

  async close () {
    this.closed = true
    this._entries = []
  }
}

class MockStub {
  /**
   * @param {object} [options]
   * @param {string} [options.txId]
   * @param {number} [options.timestampSeconds]
   */
  constructor (options = {}) {
    this._state = new Map()
    this._history = new Map()
    this._events = []
    this._txCounter = 0
    this.txId = options.txId || 'tx-0000000000000000'
    this.timestampSeconds = options.timestampSeconds || 1_700_000_000
    this.timestampNanos = options.timestampNanos || 0
  }

  // ---------------- 交易元数据 ----------------

  getTxID () {
    return this.txId
  }

  getTxTimestamp () {
    const seconds = this.timestampSeconds
    const nanos = this.timestampNanos
    return {
      seconds: {
        // protobuf Long 形态：合约通过 toString() 取值
        toString: () => String(seconds),
        toNumber: () => seconds
      },
      nanos
    }
  }

  /**
   * 测试辅助：推进到下一笔交易（只换 txId，不动时间戳）。
   *
   * 刻意不自动推进时间：真实 Fabric 中交易时间来自所属区块，与交易序号无关。
   * 需要特定时间戳的测试必须显式调用 setTimestamp()，避免隐式偏移掩盖断言错误。
   */
  nextTransaction (txId) {
    this._txCounter += 1
    this.txId = txId || `tx-${String(this._txCounter).padStart(16, '0')}`
    return this.txId
  }

  /**
   * 测试辅助：把交易时间戳设定为指定 ISO 时间。
   * @returns {MockStub} this，便于链式调用
   */
  setTimestamp (isoString) {
    const ms = new Date(isoString).getTime()
    if (Number.isNaN(ms)) {
      throw new Error(`Invalid ISO timestamp: ${isoString}`)
    }
    this.timestampSeconds = Math.floor(ms / 1000)
    this.timestampNanos = (ms % 1000) * 1e6
    return this
  }

  /** 测试辅助：换 txId 的同时设定时间戳 */
  nextTransactionAt (txId, isoString) {
    this.nextTransaction(txId)
    return this.setTimestamp(isoString)
  }

  // ---------------- 世界状态 ----------------

  async getState (key) {
    const value = this._state.get(key)
    return value === undefined ? Buffer.from('') : value
  }

  async putState (key, value) {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value))
    this._state.set(key, buffer)

    if (!this._history.has(key)) {
      this._history.set(key, [])
    }
    this._history.get(key).push({
      txId: this.txId,
      timestamp: this._snapshotTimestamp(),
      value: Buffer.from(buffer),
      isDelete: false
    })
  }

  async deleteState (key) {
    this._state.delete(key)
    if (!this._history.has(key)) {
      this._history.set(key, [])
    }
    this._history.get(key).push({
      txId: this.txId,
      timestamp: this._snapshotTimestamp(),
      value: Buffer.from(''),
      isDelete: true
    })
  }

  async getStateByRange (startKey, endKey) {
    // 对齐真实实现：空 startKey 替换为 EMPTY_KEY_SUBSTITUTE，并校验简单键不以 '\x00' 开头
    const start = startKey ? startKey : EMPTY_KEY_SUBSTITUTE
    validateSimpleKeys(start, endKey)
    return this._rangeScan(start, endKey)
  }

  /**
   * 核心范围扫描，不做简单键校验。
   * 字节序：含 start，不含 end；end 为空表示开区间（到最大键）。
   */
  _rangeScan (startKey, endKey) {
    const start = startKey || ''
    const openEnded = !endKey
    const end = openEnded ? null : endKey

    const keys = [...this._state.keys()].sort(compareKeys)
    const entries = keys
      .filter((key) => {
        if (compareKeys(key, start) < 0) return false
        if (openEnded) return true
        return compareKeys(key, end) < 0
      })
      .map((key) => ({ key, value: this._state.get(key) }))

    return new MockIterator(entries)
  }

  async getHistoryForKey (key) {
    const records = this._history.get(key) || []
    return new MockIterator(records.map((record) => ({ ...record })))
  }

  // ---------------- 复合键 ----------------

  createCompositeKey (objectType, attributes) {
    this._validateAttribute(objectType, 'objectType')
    if (!Array.isArray(attributes)) {
      throw new Error('attributes must be an array')
    }

    // 真实实现：COMPOSITEKEY_NS + objectType + MIN_UNICODE_RUNE_VALUE + (attr + MIN_UNICODE_RUNE_VALUE)...
    // 注意 objectType 之后也要带一个分隔符。
    let compositeKey = COMPOSITEKEY_NS + objectType + MIN_UNICODE_RUNE_VALUE
    for (const attribute of attributes) {
      this._validateAttribute(attribute, 'attribute')
      compositeKey += attribute + MIN_UNICODE_RUNE_VALUE
    }
    return compositeKey
  }

  splitCompositeKey (compositeKey) {
    const result = { objectType: null, attributes: [] }
    // 与真实实现一致：缺前导符或过短时静默返回空结果，不抛错
    if (compositeKey && compositeKey.length > 1 && compositeKey.charAt(0) === COMPOSITEKEY_NS) {
      const splitKey = compositeKey.substring(1).split(MIN_UNICODE_RUNE_VALUE)
      result.objectType = splitKey[0]
      splitKey.pop()
      if (splitKey.length > 1) {
        splitKey.shift()
        result.attributes = splitKey
      }
    }
    return result
  }

  async getStateByPartialCompositeKey (objectType, attributes) {
    // 真实实现直接调用 handleGetStateByRange，不经过 getStateByRange 的 validateSimpleKeys，
    // 因此复合键（以 '\x00' 开头）在这里是合法的。
    const partialKey = this.createCompositeKey(objectType, attributes || [])
    return this._rangeScan(partialKey, partialKey + MAX_UNICODE_RUNE_VALUE)
  }

  _validateAttribute (attribute, label) {
    // 对齐 fabric-shim validateCompositeKeyAttribute：非空字符串
    if (!attribute || typeof attribute !== 'string' || attribute.length === 0) {
      throw new Error('object type or attribute not a non-zero length string')
    }
  }

  // ---------------- 事件 ----------------

  setEvent (name, payload) {
    if (typeof name !== 'string' || name === '') {
      throw new Error('Event name must be a non-empty string')
    }
    this._events.push({
      name,
      payload: Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload))
    })
  }

  /** 测试辅助：取回已发出的事件 */
  getEvents () {
    return this._events.map((event) => ({
      name: event.name,
      payload: JSON.parse(event.payload.toString('utf8'))
    }))
  }

  // ---------------- 测试辅助 ----------------

  /** 直接读取原始状态，绕过合约 */
  peekState (key) {
    const value = this._state.get(key)
    return value === undefined ? null : JSON.parse(value.toString('utf8'))
  }

  /** 当前世界状态中的全部键 */
  keys () {
    return [...this._state.keys()]
  }

  _snapshotTimestamp () {
    return {
      seconds: { toString: () => String(this.timestampSeconds) },
      nanos: this.timestampNanos
    }
  }
}

/** 构造合约调用上下文 */
function createContext (options = {}) {
  const stub = new MockStub(options)
  return { ctx: { stub, clientIdentity: { getID: () => options.clientId || 'x509::CN=alice' } }, stub }
}

module.exports = {
  MockStub,
  MockIterator,
  createContext,
  compareKeys,
  NULL,
  MAX_UNICODE_RUNE_VALUE
}
