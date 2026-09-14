'use strict'

/**
 * 验证 composite key 部分键查询的"前缀污染"是真实 fabric-shim 行为，而非 mock 缺陷。
 *
 * 背景：fabric-shim 用 '\x00'（MIN_UNICODE_RUNE_VALUE）作属性分隔符，
 * 而 getStateByPartialCompositeKey 实现为 range(partialKey, partialKey + '\u{10ffff}')。
 * 由于 '\x00' 小于所有可打印字符，'P001' 的部分键区间会覆盖 'P0010' 的键。
 *
 * 本脚本直接复刻 fabric-shim 源码中的算法（不经过 mock），独立验证该结论。
 */

// ---- 以下三个常量与函数逐字复制自 fabric-shim 2.5.8 lib/stub.js ----
const MIN_UNICODE_RUNE_VALUE = '\u0000'
const MAX_UNICODE_RUNE_VALUE = '\u{10ffff}'
const COMPOSITEKEY_NS = '\x00'

function validateCompositeKeyAttribute (attr) {
  if (!attr || typeof attr !== 'string' || attr.length === 0) {
    throw new Error('object type or attribute not a non-zero length string')
  }
}

// fabric-shim ChaincodeStub.createCompositeKey 原样实现
function realCreateCompositeKey (objectType, attributes) {
  validateCompositeKeyAttribute(objectType)
  if (!Array.isArray(attributes)) {
    throw new Error('attributes must be an array')
  }
  let compositeKey = COMPOSITEKEY_NS + objectType + MIN_UNICODE_RUNE_VALUE
  attributes.forEach((attribute) => {
    validateCompositeKeyAttribute(attribute)
    compositeKey = compositeKey + attribute + MIN_UNICODE_RUNE_VALUE
  })
  return compositeKey
}

// fabric-shim ChaincodeStub.splitCompositeKey 原样实现
function realSplitCompositeKey (compositeKey) {
  const result = { objectType: null, attributes: [] }
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
// ---- 复制结束 ----

/** fabric-shim getStateByPartialCompositeKey 的范围算法 */
function realPartialRange (objectType, attributes) {
  const partialKey = realCreateCompositeKey(objectType, attributes)
  return { startKey: partialKey, endKey: partialKey + MAX_UNICODE_RUNE_VALUE }
}

const cmp = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))

console.log('=== 场景：查询 PROJECT_MILESTONE [P001] ===\n')
const { startKey, endKey } = realPartialRange('PROJECT_MILESTONE', ['P001'])
console.log(`startKey hex: ${Buffer.from(startKey, 'utf8').toString('hex')}`)
console.log(`endKey   hex: ${Buffer.from(endKey, 'utf8').toString('hex')}\n`)

const candidates = [
  ['P001', 'M001'],
  ['P001', 'M002'],
  ['P0010', 'M001'], // 前缀污染的关键样本
  ['P0011', 'M007'],
  ['P002', 'M001'],
  ['P001A', 'M001']
]

let polluted = []
for (const [projectId, milestoneId] of candidates) {
  const key = realCreateCompositeKey('PROJECT_MILESTONE', [projectId, milestoneId])
  const inRange = cmp(key, startKey) >= 0 && cmp(key, endKey) < 0
  const attrs = realSplitCompositeKey(key).attributes
  const expected = projectId === 'P001'

  if (inRange && !expected) {
    polluted.push(attrs)
  }

  const flag = inRange === expected ? 'ok  ' : 'LEAK'
  console.log(`${flag} [${projectId}, ${milestoneId}] inRange=${inRange} expected=${expected}`)
}

console.log('\n=== 结论 ===')
if (polluted.length > 0) {
  console.log('确认：真实 fabric-shim 的部分复合键查询存在前缀污染。')
  console.log(`被误匹配的键：${polluted.map((a) => JSON.stringify(a)).join(', ')}`)
  console.log('因此合约必须在 splitCompositeKey 之后，对 attributes 做严格相等二次过滤。')
  console.log('\nRESULT=REAL_FABRIC_BEHAVIOR_LEAK')
} else {
  console.log('未观察到污染，无需合约侧过滤。')
  console.log('\nRESULT=NO_LEAK')
}
