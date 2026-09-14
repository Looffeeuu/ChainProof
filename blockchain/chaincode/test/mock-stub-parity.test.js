'use strict'

/**
 * 测试替身与真实 fabric-shim 的一致性校验。
 *
 * 为什么需要这个测试：
 *   test/helpers/mock-stub.js 手写了 createCompositeKey / splitCompositeKey /
 *   getStateByRange / getStateByPartialCompositeKey。若其字节级语义与真实
 *   fabric-shim 2.5 不一致，合约单元测试会全部通过却在真链上失败（假阳性）。
 *
 *   实际踩过的坑：fabric-shim 的复合键在 objectType 之后同样插入分隔符
 *   （`\x00type\x00attr1\x00attr2\x00`），直觉上容易漏掉那一个分隔符。
 *
 * 做法：绕过构造函数取得真实 ChaincodeStub 的原型方法
 *   （createCompositeKey / splitCompositeKey 不依赖 handler 与 channel），
 *   与 mock 在相同输入上做十六进制逐字节对比。
 *
 * 若升级 fabric-shim 版本后本测试失败，说明 mock 需要跟进，而不是改断言。
 */

const path = require('path')

const ChaincodeStub = require(path.join(__dirname, '..', 'node_modules', 'fabric-shim', 'lib', 'stub.js'))
const { MockStub, MAX_UNICODE_RUNE_VALUE } = require('./helpers/mock-stub')

// 绕过构造函数：这两个方法不访问实例状态
const realStub = Object.create(ChaincodeStub.prototype)
const mockStub = new MockStub()

const hex = (value) => Buffer.from(String(value), 'utf8').toString('hex')

const CASES = [
  ['PROJECT_MILESTONE', ['P001', 'M001']],
  ['PROJECT_MILESTONE', ['P001', 'M002']],
  ['PROJECT_MILESTONE', ['P002', 'M001']],
  ['CERT_INDEX', ['P001', 'alice', 'CP-001']],
  ['CERT_INDEX', ['P001', 'bob', 'CP-002']],
  ['CERT_INDEX', ['P001', 'alice', 'CP-009']],
  ['SINGLE', ['only-one-attr']],
  ['EMPTY_ATTRS', []],
  ['中文与符号', ['项目-001', 'a.b_c', 'CP/001']]
]

describe('mock-stub 与真实 fabric-shim 的复合键一致性', () => {
  test.each(CASES)('createCompositeKey(%s, %j) 逐字节一致', (objectType, attributes) => {
    const real = realStub.createCompositeKey(objectType, attributes)
    const mock = mockStub.createCompositeKey(objectType, attributes)

    expect(hex(mock)).toBe(hex(real))
    // 显式断言关键结构：objectType 之后必须带分隔符
    expect(mock.charAt(0)).toBe('\u0000')
    expect(mock.charAt(1 + objectType.length)).toBe('\u0000')
    expect(mock.endsWith('\u0000')).toBe(true)
  })

  test.each(CASES)('splitCompositeKey 往返一致 (%s, %j)', (objectType, attributes) => {
    const key = realStub.createCompositeKey(objectType, attributes)
    const real = realStub.splitCompositeKey(key)
    const mock = mockStub.splitCompositeKey(key)

    expect(mock).toEqual(real)
    if (attributes.length > 1) {
      expect(mock.attributes).toEqual(attributes)
    }
    expect(mock.objectType).toBe(objectType)
  })

  test('splitCompositeKey 对非复合键返回空结果而不抛错', () => {
    const inputs = ['', '\u0000', 'SIMPLE_KEY', null, undefined, 'PROJECT_P001']

    for (const input of inputs) {
      const real = realStub.splitCompositeKey(input)
      const mock = mockStub.splitCompositeKey(input)
      expect(mock).toEqual(real)
      expect(mock.objectType).toBeNull()
      expect(mock.attributes).toEqual([])
    }
  })

  test('非法属性（空串 / 非字符串）两侧都抛错', () => {
    const badCases = [
      ['', ['attr']],
      ['TYPE', ['']],
      ['TYPE', ['ok', '']],
      ['TYPE', [123]],
      ['TYPE', 'not-an-array']
    ]

    for (const [objectType, attributes] of badCases) {
      let realThrew = false
      let mockThrew = false
      try { realStub.createCompositeKey(objectType, attributes) } catch (e) { realThrew = true }
      try { mockStub.createCompositeKey(objectType, attributes) } catch (e) { mockThrew = true }

      expect({ objectType, attributes, mockThrew }).toEqual({ objectType, attributes, mockThrew: realThrew })
      expect(realThrew).toBe(true)
    }
  })

  test('MAX_UNICODE_RUNE_VALUE 与 fabric-shim 内部常量一致', () => {
    // fabric-shim: const MAX_UNICODE_RUNE_VALUE = '\u{10ffff}'
    expect(MAX_UNICODE_RUNE_VALUE).toBe('\u{10ffff}')
    expect(hex(MAX_UNICODE_RUNE_VALUE)).toBe(hex('\u{10ffff}'))
  })

  test('getStateByPartialCompositeKey 只返回同前缀的键', async () => {
    const stub = new MockStub()

    // projectId 恰为 P001 的里程碑都应命中，包括 M0010（M001 的"更长兄弟"）
    const wanted = [
      ['P001', 'M001'], ['P001', 'M002'], ['P001', 'M999'], ['P001', 'M0010']
    ]
    // 其它 projectId 一律不得命中。注意 P0010 / P0011 / P001A：
    // 分隔符是 '\x00'（小于所有可打印字符），因此 'P001' 之后紧跟 '\x00' 的
    // 区间上界会把它们正确排除 —— 这正是 Fabric 不用 '\uffff' 作分隔符的原因。
    const unwanted = [
      ['P002', 'M001'], ['P0010', 'M001'], ['P0011', 'M007'], ['P001A', 'M001'], ['P00', 'M001']
    ]

    for (const [projectId, milestoneId] of [...wanted, ...unwanted]) {
      const key = stub.createCompositeKey('PROJECT_MILESTONE', [projectId, milestoneId])
      await stub.putState(key, Buffer.from('\u0000'))
    }
    // 干扰项：普通键与其它 objectType
    await stub.putState('PROJECT_P001', Buffer.from('{}'))
    await stub.putState('MILESTONE_M001', Buffer.from('{}'))
    const otherType = stub.createCompositeKey('CERT_INDEX', ['P001', 'alice', 'CP-001'])
    await stub.putState(otherType, Buffer.from('\u0000'))

    const iterator = await stub.getStateByPartialCompositeKey('PROJECT_MILESTONE', ['P001'])
    const found = []
    let result = await iterator.next()
    while (!result.done) {
      found.push(stub.splitCompositeKey(result.value.key).attributes)
      result = await iterator.next()
    }
    await iterator.close()

    expect(found).toHaveLength(wanted.length)
    for (const expected of wanted) {
      expect(found).toContainEqual(expected)
    }
    for (const forbidden of unwanted) {
      expect(found).not.toContainEqual(forbidden)
    }
  })

  /**
   * 回归锁：projectId 前缀边界（P001 vs P0010）。
   *
   * 这是本项目最容易被误判的一处语义。曾错误地认为 '\x00' 分隔符会导致
   * 'P001' 的查询污染到 'P0010'；实测（含复刻真实 fabric-shim 源码算法的
   * 独立验证）证明不会。若未来有人"修正"分隔符或改用字符串 startsWith 判断，
   * 本测试会失败。
   */
  test('projectId 前缀边界：P001 的查询不得命中 P0010', async () => {
    const stub = new MockStub()
    const p1 = stub.createCompositeKey('PROJECT_MILESTONE', ['P001', 'M001'])
    const p10 = stub.createCompositeKey('PROJECT_MILESTONE', ['P0010', 'M001'])
    await stub.putState(p1, Buffer.from('\u0000'))
    await stub.putState(p10, Buffer.from('\u0000'))

    const iterator = await stub.getStateByPartialCompositeKey('PROJECT_MILESTONE', ['P001'])
    const found = []
    let result = await iterator.next()
    while (!result.done) {
      found.push(stub.splitCompositeKey(result.value.key).attributes[0])
      result = await iterator.next()
    }
    await iterator.close()

    expect(found).toEqual(['P001'])
    expect(found).not.toContain('P0010')

    // 反向亦然
    const iterator2 = await stub.getStateByPartialCompositeKey('PROJECT_MILESTONE', ['P0010'])
    const found2 = []
    let result2 = await iterator2.next()
    while (!result2.done) {
      found2.push(stub.splitCompositeKey(result2.value.key).attributes[0])
      result2 = await iterator2.next()
    }
    await iterator2.close()

    expect(found2).toEqual(['P0010'])
  })

  test('复合键不会落入简单键的前缀范围查询区间', async () => {
    const stub = new MockStub()

    await stub.putState('PROJECT_P001', Buffer.from('{"docType":"project"}'))
    await stub.putState('PROJECT_P002', Buffer.from('{"docType":"project"}'))
    await stub.putState('MILESTONE_M001', Buffer.from('{"docType":"milestone"}'))
    await stub.putState('CERT_CP-001', Buffer.from('{"docType":"certificate"}'))
    // 复合索引键（以 \x00 开头）必须被前缀扫描排除
    await stub.putState(stub.createCompositeKey('PROJECT_MILESTONE', ['P001', 'M001']), Buffer.from('\u0000'))
    await stub.putState(stub.createCompositeKey('CERT_INDEX', ['P001', 'alice', 'CP-001']), Buffer.from('\u0000'))

    const scan = async (prefix) => {
      const iterator = await stub.getStateByRange(prefix, prefix + '\uffff')
      const keys = []
      let result = await iterator.next()
      while (!result.done) {
        keys.push(result.value.key)
        result = await iterator.next()
      }
      await iterator.close()
      return keys
    }

    await expect(scan('PROJECT_')).resolves.toEqual(['PROJECT_P001', 'PROJECT_P002'])
    await expect(scan('MILESTONE_')).resolves.toEqual(['MILESTONE_M001'])
    await expect(scan('CERT_')).resolves.toEqual(['CERT_CP-001'])
  })

  test('getStateByRange 对以 \\x00 开头的键抛错（validateSimpleKeys）', async () => {
    const stub = new MockStub()
    await expect(stub.getStateByRange('\u0000BAD', '\u0000BAD\u{10ffff}'))
      .rejects.toThrow(/contains a null character/)
  })

  test('getStateByRange 为空 startKey 使用 EMPTY_KEY_SUBSTITUTE 且不抛错', async () => {
    const stub = new MockStub()
    await stub.putState('PROJECT_P001', Buffer.from('{}'))

    const iterator = await stub.getStateByRange('', '')
    const keys = []
    let result = await iterator.next()
    while (!result.done) {
      keys.push(result.value.key)
      result = await iterator.next()
    }
    await iterator.close()

    expect(keys).toEqual(['PROJECT_P001'])
  })

  test('getStateByRange 区间为含 start、不含 end', async () => {
    const stub = new MockStub()
    for (const key of ['K1', 'K2', 'K3', 'K4']) {
      await stub.putState(key, Buffer.from('{}'))
    }

    const iterator = await stub.getStateByRange('K2', 'K4')
    const keys = []
    let result = await iterator.next()
    while (!result.done) {
      keys.push(result.value.key)
      result = await iterator.next()
    }
    await iterator.close()

    expect(keys).toEqual(['K2', 'K3'])
  })
})
