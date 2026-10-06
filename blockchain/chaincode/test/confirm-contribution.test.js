'use strict'

/**
 * 贡献确认状态机测试（ARCHITECTURE §7 + PR #28 独立确认规则）。
 *
 * 覆盖：
 *   - 提交者不能确认自己的提交 -> SUBMITTER_CANNOT_CONFIRM
 *   - 非确认人（非 requiredConfirmerIds）表态 -> MEMBER_NOT_REVIEWER
 *   - requiredConfirmerIds 快照在创建时确定，与 contributors 无关
 *   - 0% 贡献的非贡献成员仍需作为 requiredConfirmer 表态
 *   - 关闭态拒绝表态 -> MILESTONE_CLOSED
 *   - 同一成员不得改票 -> ALREADY_DECIDED
 *   - 全部 requiredConfirmer 确认 -> VERIFIED，任一拒绝 -> REJECTED
 *   - 单成员项目无法创建里程碑
 *   - 确定性快照排序（UTF-8 字节序）
 */

const ChainProofContract = require('../lib/chainproof-contract')
const { createContext } = require('./helpers/mock-stub')

const HASH_A = 'a'.repeat(64)

describe('ChainProofContract - ConfirmContribution 状态机', () => {
  let contract
  let ctx

  beforeEach(async () => {
    contract = new ChainProofContract()
    ;({ ctx } = createContext({ txId: 'tx-create-project' }))

    // 项目有三名成员：alice, bob, charlie
    await contract.CreateProject(
      ctx, 'P001', 'ChainProof Demo', '课程演示项目', 'alice',
      JSON.stringify(['alice', 'bob', 'charlie'])
    )

    // alice 提交里程碑 -> requiredConfirmerIds = ['bob', 'charlie']
    ctx.stub.setTimestamp('2026-09-11T10:00:00.000Z')
    ctx.stub.nextTransaction('tx-create-milestone')
    await contract.CreateMilestone(
      ctx, 'M001', 'P001', '第一版原型', '完成 MVP', 'prototype.zip', HASH_A,
      JSON.stringify([
        { memberId: 'alice', percentage: 40 },
        { memberId: 'bob', percentage: 35 },
        { memberId: 'charlie', percentage: 25 }
      ]),
      'alice' // submitterId
    )
  })

  /** 便捷封装 */
  const confirm = (memberId, decision, txId) => {
    ctx.stub.nextTransaction(txId)
    return contract.ConfirmContribution(ctx, 'M001', memberId, decision)
  }

  // -------------------------------------------------------------------------
  // 基础状态跃迁
  // -------------------------------------------------------------------------

  test('初始状态是 PENDING_CONFIRMATION，confirmations 为空，requiredConfirmerIds 快照正确', async () => {
    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.status).toBe('PENDING_CONFIRMATION')
    expect(milestone.confirmations).toEqual([])
    expect(milestone.submitterId).toBe('alice')
    expect(milestone.requiredConfirmerIds).toEqual(['bob', 'charlie'])
  })

  test('单个确认人确认后仍是 PENDING_CONFIRMATION', async () => {
    ctx.stub.setTimestamp('2026-09-12T10:00:00.000Z')
    const milestone = JSON.parse(await confirm('bob', 'CONFIRMED', 'tx-confirm-bob'))

    expect(milestone.status).toBe('PENDING_CONFIRMATION')
    expect(milestone.confirmations).toHaveLength(1)
    expect(milestone.confirmations[0]).toEqual({
      memberId: 'bob',
      decision: 'CONFIRMED',
      timestamp: '2026-09-12T10:00:00.000Z'
    })
    expect(milestone.txId).toBe('tx-confirm-bob')
  })

  test('全部 requiredConfirmer 确认 -> VERIFIED，并保留全部表态记录', async () => {
    await confirm('bob', 'CONFIRMED', 'tx-1')
    ctx.stub.setTimestamp('2026-09-14T10:00:00.000Z')
    const milestone = JSON.parse(await confirm('charlie', 'CONFIRMED', 'tx-2'))

    expect(milestone.status).toBe('VERIFIED')
    expect(milestone.confirmations).toHaveLength(2)
    expect(milestone.confirmations.map((c) => c.memberId)).toEqual(['bob', 'charlie'])
    expect(milestone.confirmations.every((c) => c.decision === 'CONFIRMED')).toBe(true)
  })

  test('任一 requiredConfirmer 拒绝 -> 立即 REJECTED，无需等待其他人表态', async () => {
    await confirm('bob', 'CONFIRMED', 'tx-1')
    const milestone = JSON.parse(await confirm('charlie', 'REJECTED', 'tx-2'))

    expect(milestone.status).toBe('REJECTED')
    expect(milestone.confirmations).toHaveLength(2)
    expect(milestone.confirmations.find((c) => c.memberId === 'charlie').decision).toBe('REJECTED')
  })

  // -------------------------------------------------------------------------
  // 提交者限制
  // -------------------------------------------------------------------------

  test('提交者确认自己的提交 -> SUBMITTER_CANNOT_CONFIRM', async () => {
    await expect(confirm('alice', 'CONFIRMED', 'tx-submitter')).rejects.toThrow(/^SUBMITTER_CANNOT_CONFIRM: /)
  })

  test('提交者拒绝自己的提交 -> 同样是 SUBMITTER_CANNOT_CONFIRM', async () => {
    await expect(confirm('alice', 'REJECTED', 'tx-submitter-reject')).rejects.toThrow(/^SUBMITTER_CANNOT_CONFIRM: /)
  })

  test('提交者判定优先于重复表态判定：提交者重复表态仍报 SUBMITTER_CANNOT_CONFIRM', async () => {
    // alice 是提交者，即使她尝试多次，都应该得到 SUBMITTER_CANNOT_CONFIRM
    await expect(confirm('alice', 'CONFIRMED', 'tx-a1')).rejects.toThrow(/^SUBMITTER_CANNOT_CONFIRM: /)
    await expect(confirm('alice', 'CONFIRMED', 'tx-a2')).rejects.toThrow(/^SUBMITTER_CANNOT_CONFIRM: /)
  })

  // -------------------------------------------------------------------------
  // 非确认人限制
  // -------------------------------------------------------------------------

  test('非确认人（非项目成员）表态 -> MEMBER_NOT_REVIEWER', async () => {
    // dave 不是 P001 成员
    await expect(confirm('dave', 'CONFIRMED', 'tx-outsider')).rejects.toThrow(/^MEMBER_NOT_REVIEWER: /)
  })

  test('非确认人判定优先于重复表态：关闭前对非确认人报 MEMBER_NOT_REVIEWER', async () => {
    // dave 不是确认人，无论里程碑状态如何都应报 MEMBER_NOT_REVIEWER
    await expect(confirm('dave', 'CONFIRMED', 'tx-dave')).rejects.toThrow(/^MEMBER_NOT_REVIEWER: /)
  })

  // -------------------------------------------------------------------------
  // 重复表态
  // -------------------------------------------------------------------------

  test('同一确认人重复表态 -> ALREADY_DECIDED，不得撤回或改票', async () => {
    await confirm('bob', 'CONFIRMED', 'tx-1')

    // 相同决定再来一次
    await expect(confirm('bob', 'CONFIRMED', 'tx-dup')).rejects.toThrow(/^ALREADY_DECIDED: /)
    // 改票同样被拒
    await expect(confirm('bob', 'REJECTED', 'tx-flip')).rejects.toThrow(/^ALREADY_DECIDED: /)

    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.confirmations).toHaveLength(1)
    expect(milestone.confirmations[0].decision).toBe('CONFIRMED')
    expect(milestone.status).toBe('PENDING_CONFIRMATION')
  })

  // -------------------------------------------------------------------------
  // 关闭态
  // -------------------------------------------------------------------------

  test('VERIFIED 后任何人表态 -> MILESTONE_CLOSED（含提交者与已表态确认人）', async () => {
    await confirm('bob', 'CONFIRMED', 'tx-1')
    await confirm('charlie', 'CONFIRMED', 'tx-2')
    const verified = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(verified.status).toBe('VERIFIED')

    // 提交者
    await expect(confirm('alice', 'CONFIRMED', 'tx-x1')).rejects.toThrow(/^MILESTONE_CLOSED: /)
    // 已表态确认人
    await expect(confirm('bob', 'CONFIRMED', 'tx-x2')).rejects.toThrow(/^MILESTONE_CLOSED: /)
    // 未表态的外部成员
    await expect(confirm('dave', 'CONFIRMED', 'tx-x3')).rejects.toThrow(/^MILESTONE_CLOSED: /)
  })

  test('REJECTED 后其他人表态 -> MILESTONE_CLOSED，状态不再改变', async () => {
    await confirm('bob', 'REJECTED', 'tx-1')

    await expect(confirm('charlie', 'CONFIRMED', 'tx-2')).rejects.toThrow(/^MILESTONE_CLOSED: /)
    await expect(confirm('alice', 'REJECTED', 'tx-3')).rejects.toThrow(/^MILESTONE_CLOSED: /)

    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.status).toBe('REJECTED')
    expect(milestone.confirmations).toHaveLength(1)
  })

  test('关闭态判定优先于提交者判定：已 VERIFIED 时提交者报 MILESTONE_CLOSED', async () => {
    await confirm('bob', 'CONFIRMED', 'tx-1')
    await confirm('charlie', 'CONFIRMED', 'tx-2')

    // 关闭态优先于 SUBMITTER_CANNOT_CONFIRM
    await expect(confirm('alice', 'CONFIRMED', 'tx-5')).rejects.toThrow(/^MILESTONE_CLOSED: /)
  })

  // -------------------------------------------------------------------------
  // 校验错误
  // -------------------------------------------------------------------------

  test('非法 decision -> VALIDATION_ERROR', async () => {
    await expect(confirm('bob', 'MAYBE')).rejects.toThrow(/^VALIDATION_ERROR: /)
    await expect(confirm('bob', '')).rejects.toThrow(/^VALIDATION_ERROR: /)
    await expect(confirm('bob', 'confirmed')).rejects.toThrow(/^VALIDATION_ERROR: /)

    // 非法表态不得写入任何记录
    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.confirmations).toEqual([])
  })

  test('缺 memberId -> VALIDATION_ERROR', async () => {
    await expect(contract.ConfirmContribution(ctx, 'M001', '', 'CONFIRMED'))
      .rejects.toThrow(/memberId/)
  })

  test('里程碑不存在 -> MILESTONE_NOT_FOUND', async () => {
    await expect(contract.ConfirmContribution(ctx, 'M404', 'bob', 'CONFIRMED'))
      .rejects.toThrow(/^MILESTONE_NOT_FOUND: /)
  })

  // -------------------------------------------------------------------------
  // 事件
  // -------------------------------------------------------------------------

  test('状态跃迁到终态时发出 MilestoneClosed 事件', async () => {
    await confirm('bob', 'CONFIRMED', 'tx-1')
    expect(ctx.stub.getEvents()).toEqual([])

    const milestone = JSON.parse(await confirm('charlie', 'CONFIRMED', 'tx-2'))
    const events = ctx.stub.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('MilestoneClosed')
    expect(events[0].payload).toMatchObject({
      milestoneId: 'M001',
      projectId: 'P001',
      status: 'VERIFIED'
    })
    expect(events[0].payload.txId).toBe('tx-2')
  })

  test('拒绝导致 REJECTED 时同样发出 MilestoneClosed 事件', async () => {
    await confirm('bob', 'REJECTED', 'tx-r1')
    const events = ctx.stub.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].payload.status).toBe('REJECTED')
  })

  // -------------------------------------------------------------------------
  // 完整性
  // -------------------------------------------------------------------------

  test('确认不会篡改贡献比例与文件哈希', async () => {
    await confirm('bob', 'CONFIRMED', 'tx-1')
    await confirm('charlie', 'CONFIRMED', 'tx-2')

    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.contributors).toEqual([
      { memberId: 'alice', percentage: 40 },
      { memberId: 'bob', percentage: 35 },
      { memberId: 'charlie', percentage: 25 }
    ])
    expect(milestone.fileHash).toBe(HASH_A)
    expect(milestone.fileName).toBe('prototype.zip')
  })

  test('时间戳来自区块而非 Date.now()，两次同区块交易时间一致', async () => {
    ctx.stub.setTimestamp('2026-09-20T08:30:00.000Z')
    ctx.stub.nextTransaction('tx-t1')
    const first = JSON.parse(await contract.ConfirmContribution(ctx, 'M001', 'bob', 'CONFIRMED'))
    // 不推进时间戳，模拟同一区块内两笔交易
    ctx.stub.nextTransaction('tx-t2')
    const second = JSON.parse(await contract.ConfirmContribution(ctx, 'M001', 'charlie', 'CONFIRMED'))

    expect(first.confirmations[0].timestamp).toBe('2026-09-20T08:30:00.000Z')
    expect(second.confirmations[1].timestamp).toBe('2026-09-20T08:30:00.000Z')
  })
})

// ===========================================================================
// requiredConfirmerIds 快照与独立确认规则
// ===========================================================================

describe('ChainProofContract - requiredConfirmerIds 快照', () => {
  let contract
  let ctx

  beforeEach(() => {
    contract = new ChainProofContract()
    ;({ ctx } = createContext({ txId: 'tx-seed' }))
  })

  test('requiredConfirmerIds 按 UTF-8 字节序排列，与 contributors 顺序无关', async () => {
    await contract.CreateProject(ctx, 'P_SORT', 'sort', 'd', 'alice',
      JSON.stringify(['charlie', 'alice', 'bob']))

    ctx.stub.nextTransaction('tx-ms')
    await contract.CreateMilestone(
      ctx, 'M_SORT', 'P_SORT', 'test', 'd', 'f.zip', 'a'.repeat(64),
      JSON.stringify([
        { memberId: 'charlie', percentage: 50 },
        { memberId: 'bob', percentage: 50 }
      ]),
      'alice' // submitterId
    )

    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M_SORT'))
    // requiredConfirmerIds = ['bob', 'charlie']（排除 alice，按 UTF-8 字节序排列）
    expect(milestone.requiredConfirmerIds).toEqual(['bob', 'charlie'])
  })

  test('0% 贡献的成员仍需作为 requiredConfirmer 表态', async () => {
    // bob 在 contributors 中占 0%，但他是 requiredConfirmer
    await contract.CreateProject(ctx, 'P_ZERO', 'zero', 'd', 'alice',
      JSON.stringify(['alice', 'bob', 'charlie']))

    ctx.stub.nextTransaction('tx-mz')
    await contract.CreateMilestone(
      ctx, 'M_ZERO', 'P_ZERO', 'test', 'd', 'f.zip', 'a'.repeat(64),
      JSON.stringify([
        { memberId: 'alice', percentage: 100 },
        { memberId: 'bob', percentage: 0 },
        { memberId: 'charlie', percentage: 0 }
      ]),
      'alice' // submitterId -> requiredConfirmerIds = ['bob', 'charlie']
    )

    // bob 虽然 0% 贡献，仍需确认
    ctx.stub.nextTransaction('tx-c1')
    const afterBob = JSON.parse(await contract.ConfirmContribution(ctx, 'M_ZERO', 'bob', 'CONFIRMED'))
    expect(afterBob.status).toBe('PENDING_CONFIRMATION')

    // charlie 也是 requiredConfirmer，确认后 VERIFIED
    ctx.stub.nextTransaction('tx-c2')
    const afterCharlie = JSON.parse(await contract.ConfirmContribution(ctx, 'M_ZERO', 'charlie', 'CONFIRMED'))
    expect(afterCharlie.status).toBe('VERIFIED')
  })

  test('提交者不是 requiredConfirmer，即使提交者有贡献比例', async () => {
    await contract.CreateProject(ctx, 'P_SUB', 'sub', 'd', 'alice',
      JSON.stringify(['alice', 'bob']))

    ctx.stub.nextTransaction('tx-ms2')
    await contract.CreateMilestone(
      ctx, 'M_SUB', 'P_SUB', 'test', 'd', 'f.zip', 'a'.repeat(64),
      JSON.stringify([
        { memberId: 'alice', percentage: 50 },
        { memberId: 'bob', percentage: 50 }
      ]),
      'alice' // submitterId -> requiredConfirmerIds = ['bob']
    )

    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M_SUB'))
    expect(milestone.requiredConfirmerIds).toEqual(['bob'])
    expect(milestone.submitterId).toBe('alice')

    // 只有 bob 确认即可 VERIFIED
    ctx.stub.nextTransaction('tx-c1')
    const result = JSON.parse(await contract.ConfirmContribution(ctx, 'M_SUB', 'bob', 'CONFIRMED'))
    expect(result.status).toBe('VERIFIED')
  })

  test('单成员项目无法创建里程碑 -> VALIDATION_ERROR', async () => {
    await contract.CreateProject(ctx, 'P_SOLO', 'solo', 'd', 'alice',
      JSON.stringify(['alice']))

    await expect(contract.CreateMilestone(
      ctx, 'M_SOLO', 'P_SOLO', 'test', 'd', 'f.zip', 'a'.repeat(64),
      JSON.stringify([{ memberId: 'alice', percentage: 100 }]),
      'alice'
    )).rejects.toThrow(/至少需要两名成员/)
  })

  test('提交者不属于项目成员 -> VALIDATION_ERROR', async () => {
    await contract.CreateProject(ctx, 'P_EXT', 'ext', 'd', 'alice',
      JSON.stringify(['alice', 'bob']))

    await expect(contract.CreateMilestone(
      ctx, 'M_EXT', 'P_EXT', 'test', 'd', 'f.zip', 'a'.repeat(64),
      JSON.stringify([{ memberId: 'alice', percentage: 100 }]),
      'mallory' // 不是项目成员
    )).rejects.toThrow(/^VALIDATION_ERROR: /)
  })

  test('不同提交者产生不同的 requiredConfirmerIds 快照', async () => {
    await contract.CreateProject(ctx, 'P_DIFF', 'diff', 'd', 'alice',
      JSON.stringify(['alice', 'bob', 'charlie']))

    // alice 提交 -> requiredConfirmerIds = ['bob', 'charlie']
    ctx.stub.nextTransaction('tx-m1')
    await contract.CreateMilestone(
      ctx, 'M_DIFF1', 'P_DIFF', 'first', 'd', 'f.zip', 'a'.repeat(64),
      JSON.stringify([{ memberId: 'alice', percentage: 100 }]),
      'alice'
    )

    // bob 提交 -> requiredConfirmerIds = ['alice', 'charlie']
    ctx.stub.nextTransaction('tx-m2')
    await contract.CreateMilestone(
      ctx, 'M_DIFF2', 'P_DIFF', 'second', 'd', 'g.zip', 'b'.repeat(64),
      JSON.stringify([{ memberId: 'bob', percentage: 100 }]),
      'bob'
    )

    const m1 = JSON.parse(await contract.GetMilestone(ctx, 'M_DIFF1'))
    expect(m1.requiredConfirmerIds).toEqual(['bob', 'charlie'])

    const m2 = JSON.parse(await contract.GetMilestone(ctx, 'M_DIFF2'))
    expect(m2.requiredConfirmerIds).toEqual(['alice', 'charlie'])
  })

  test('四人项目，提交者排除后剩余三人按 UTF-8 字节序排列', async () => {
    await contract.CreateProject(ctx, 'P_FOUR', 'four', 'd', 'alice',
      JSON.stringify(['dave', 'alice', 'bob', 'charlie']))

    ctx.stub.nextTransaction('tx-mf')
    await contract.CreateMilestone(
      ctx, 'M_FOUR', 'P_FOUR', 'test', 'd', 'f.zip', 'a'.repeat(64),
      JSON.stringify([
        { memberId: 'alice', percentage: 25 },
        { memberId: 'bob', percentage: 25 },
        { memberId: 'charlie', percentage: 25 },
        { memberId: 'dave', percentage: 25 }
      ]),
      'alice' // submitterId -> requiredConfirmerIds = ['bob', 'charlie', 'dave']
    )

    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M_FOUR'))
    expect(milestone.requiredConfirmerIds).toEqual(['bob', 'charlie', 'dave'])

    // 三人全部确认才 VERIFIED
    ctx.stub.nextTransaction('tx-c1')
    await contract.ConfirmContribution(ctx, 'M_FOUR', 'bob', 'CONFIRMED')
    ctx.stub.nextTransaction('tx-c2')
    await contract.ConfirmContribution(ctx, 'M_FOUR', 'charlie', 'CONFIRMED')
    let ms = JSON.parse(await contract.GetMilestone(ctx, 'M_FOUR'))
    expect(ms.status).toBe('PENDING_CONFIRMATION')

    ctx.stub.nextTransaction('tx-c3')
    ms = JSON.parse(await contract.ConfirmContribution(ctx, 'M_FOUR', 'dave', 'CONFIRMED'))
    expect(ms.status).toBe('VERIFIED')
  })

  test('提交者判定优先于确认人判定：提交者尝试确认时报 SUBMITTER_CANNOT_CONFIRM 而非 MEMBER_NOT_REVIEWER', async () => {
    // bob 提交 -> requiredConfirmerIds = ['alice', 'charlie']
    // bob 既不是 requiredConfirmer，又是提交者。
    // 按验证顺序：关闭态 -> 提交者 -> 确认人资格
    // bob 是提交者，应报 SUBMITTER_CANNOT_CONFIRM（不是 MEMBER_NOT_REVIEWER）
    await contract.CreateProject(ctx, 'P_PRI', 'priority', 'd', 'bob',
      JSON.stringify(['alice', 'bob', 'charlie']))

    ctx.stub.nextTransaction('tx-mp')
    await contract.CreateMilestone(
      ctx, 'M_PRI', 'P_PRI', 'test', 'd', 'f.zip', 'a'.repeat(64),
      JSON.stringify([{ memberId: 'bob', percentage: 100 }]),
      'bob' // submitterId -> requiredConfirmerIds = ['alice', 'charlie']
    )

    await expect(
      contract.ConfirmContribution(ctx, 'M_PRI', 'bob', 'CONFIRMED')
    ).rejects.toThrow(/^SUBMITTER_CANNOT_CONFIRM: /)
  })
})
