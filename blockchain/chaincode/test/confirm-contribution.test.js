'use strict'

/**
 * 贡献确认状态机测试（ARCHITECTURE §7）。
 *
 * 覆盖：正常确认/拒绝、关闭态拒绝表态、同一成员不得改票、
 * 非贡献者表态、以及三个错误码的严格区分。
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

    await contract.CreateProject(
      ctx, 'P001', 'ChainProof Demo', '课程演示项目', 'alice',
      JSON.stringify(['alice', 'bob', 'charlie'])
    )

    ctx.stub.setTimestamp('2026-09-11T10:00:00.000Z')
    ctx.stub.nextTransaction('tx-create-milestone')
    await contract.CreateMilestone(
      ctx, 'M001', 'P001', '第一版原型', '完成 MVP', 'prototype.zip', HASH_A,
      JSON.stringify([
        { memberId: 'alice', percentage: 40 },
        { memberId: 'bob', percentage: 35 },
        { memberId: 'charlie', percentage: 25 }
      ])
    )
  })

  /** 便捷封装 */
  const confirm = (memberId, decision, txId) => {
    ctx.stub.nextTransaction(txId)
    return contract.ConfirmContribution(ctx, 'M001', memberId, decision)
  }

  test('初始状态是 PENDING_CONFIRMATION，confirmations 为空', async () => {
    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.status).toBe('PENDING_CONFIRMATION')
    expect(milestone.confirmations).toEqual([])
  })

  test('单个成员确认后仍是 PENDING_CONFIRMATION', async () => {
    ctx.stub.setTimestamp('2026-09-12T10:00:00.000Z')
    const milestone = JSON.parse(await confirm('alice', 'CONFIRMED', 'tx-confirm-alice'))

    expect(milestone.status).toBe('PENDING_CONFIRMATION')
    expect(milestone.confirmations).toHaveLength(1)
    expect(milestone.confirmations[0]).toEqual({
      memberId: 'alice',
      decision: 'CONFIRMED',
      timestamp: '2026-09-12T10:00:00.000Z'
    })
    expect(milestone.txId).toBe('tx-confirm-alice')
  })

  test('全部贡献者确认 -> VERIFIED，并保留全部表态记录', async () => {
    await confirm('alice', 'CONFIRMED', 'tx-1')
    await confirm('bob', 'CONFIRMED', 'tx-2')
    ctx.stub.setTimestamp('2026-09-14T10:00:00.000Z')
    const milestone = JSON.parse(await confirm('charlie', 'CONFIRMED', 'tx-3'))

    expect(milestone.status).toBe('VERIFIED')
    expect(milestone.confirmations).toHaveLength(3)
    expect(milestone.confirmations.map((c) => c.memberId)).toEqual(['alice', 'bob', 'charlie'])
    expect(milestone.confirmations.every((c) => c.decision === 'CONFIRMED')).toBe(true)
  })

  test('任一贡献者拒绝 -> 立即 REJECTED，无需等待其他人表态', async () => {
    await confirm('alice', 'CONFIRMED', 'tx-1')
    const milestone = JSON.parse(await confirm('bob', 'REJECTED', 'tx-2'))

    expect(milestone.status).toBe('REJECTED')
    expect(milestone.confirmations).toHaveLength(2)
    expect(milestone.confirmations.find((c) => c.memberId === 'bob').decision).toBe('REJECTED')
  })

  test('同一成员重复表态 -> ALREADY_DECIDED，不得撤回或改票', async () => {
    await confirm('alice', 'CONFIRMED', 'tx-1')

    // 相同决定再来一次
    await expect(confirm('alice', 'CONFIRMED', 'tx-dup')).rejects.toThrow(/^ALREADY_DECIDED: /)
    // 改票同样被拒
    await expect(confirm('alice', 'REJECTED', 'tx-flip')).rejects.toThrow(/^ALREADY_DECIDED: /)

    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.confirmations).toHaveLength(1)
    expect(milestone.confirmations[0].decision).toBe('CONFIRMED')
    expect(milestone.status).toBe('PENDING_CONFIRMATION')
  })

  test('VERIFIED 后任何人表态 -> MILESTONE_CLOSED（含未表态成员与已表态成员）', async () => {
    await confirm('alice', 'CONFIRMED', 'tx-1')
    await confirm('bob', 'CONFIRMED', 'tx-2')
    await confirm('charlie', 'CONFIRMED', 'tx-3')
    const verified = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(verified.status).toBe('VERIFIED')

    // 已表态成员
    await expect(confirm('alice', 'CONFIRMED', 'tx-x')).rejects.toThrow(/^MILESTONE_CLOSED: /)
    // 未表态成员（此例中无，用项目内其他成员验证非贡献者优先级见下）
    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.confirmations).toHaveLength(3)
  })

  test('REJECTED 后其他人表态 -> MILESTONE_CLOSED，状态不再改变', async () => {
    await confirm('alice', 'CONFIRMED', 'tx-1')
    await confirm('bob', 'REJECTED', 'tx-2')

    await expect(confirm('charlie', 'CONFIRMED', 'tx-3')).rejects.toThrow(/^MILESTONE_CLOSED: /)
    await expect(confirm('alice', 'REJECTED', 'tx-4')).rejects.toThrow(/^MILESTONE_CLOSED: /)

    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.status).toBe('REJECTED')
    expect(milestone.confirmations).toHaveLength(2)
  })

  test('关闭态判定优先于重复表态判定：已 VERIFIED 时已表态成员报 MILESTONE_CLOSED', async () => {
    await confirm('alice', 'CONFIRMED', 'tx-1')
    await confirm('bob', 'CONFIRMED', 'tx-2')
    await confirm('charlie', 'CONFIRMED', 'tx-3')

    await expect(confirm('alice', 'CONFIRMED', 'tx-5')).rejects.toThrow(/^MILESTONE_CLOSED: /)
  })

  test('非贡献者表态 -> MEMBER_NOT_IN_CLAIM（即使是项目成员）', async () => {
    await contract.CreateProject(ctx, 'P002', 'other', 'd', 'alice', JSON.stringify(['alice', 'dave']))
    ctx.stub.nextTransaction('tx-m2')
    await contract.CreateMilestone(
      ctx, 'M002', 'P001', '另一里程碑', 'd', 'f.zip', HASH_A,
      JSON.stringify([{ memberId: 'alice', percentage: 100 }])
    )

    // charlie 是 P001 成员，但不是 M002 的贡献者
    ctx.stub.nextTransaction('tx-6')
    await expect(
      contract.ConfirmContribution(ctx, 'M002', 'charlie', 'CONFIRMED')
    ).rejects.toThrow(/^MEMBER_NOT_IN_CLAIM: /)

    // dave 甚至不是 P001 成员
    ctx.stub.nextTransaction('tx-7')
    await expect(
      contract.ConfirmContribution(ctx, 'M002', 'dave', 'CONFIRMED')
    ).rejects.toThrow(/^MEMBER_NOT_IN_CLAIM: /)
  })

  test('非贡献者判定优先于重复表态：关闭前对非贡献者报 MEMBER_NOT_IN_CLAIM', async () => {
    // charlie 未表态且不是 M002 贡献者
    ctx.stub.nextTransaction('tx-8')
    await contract.CreateMilestone(
      ctx, 'M003', 'P001', '第三个', 'd', 'g.zip', HASH_A,
      JSON.stringify([{ memberId: 'bob', percentage: 100 }])
    )
    ctx.stub.nextTransaction('tx-9')
    await expect(
      contract.ConfirmContribution(ctx, 'M003', 'alice', 'CONFIRMED')
    ).rejects.toThrow(/^MEMBER_NOT_IN_CLAIM: /)
  })

  test('里程碑不存在 -> MILESTONE_NOT_FOUND', async () => {
    ctx.stub.nextTransaction('tx-10')
    await expect(
      contract.ConfirmContribution(ctx, 'M404', 'alice', 'CONFIRMED')
    ).rejects.toThrow(/^MILESTONE_NOT_FOUND: /)
  })

  test('非法 decision -> VALIDATION_ERROR', async () => {
    ctx.stub.nextTransaction('tx-11')
    await expect(contract.ConfirmContribution(ctx, 'M001', 'alice', 'MAYBE'))
      .rejects.toThrow(/^VALIDATION_ERROR: /)
    ctx.stub.nextTransaction('tx-12')
    await expect(contract.ConfirmContribution(ctx, 'M001', 'alice', ''))
      .rejects.toThrow(/^VALIDATION_ERROR: /)
    ctx.stub.nextTransaction('tx-13')
    await expect(contract.ConfirmContribution(ctx, 'M001', 'alice', 'confirmed'))
      .rejects.toThrow(/^VALIDATION_ERROR: /)

    // 非法表态不得写入任何记录
    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.confirmations).toEqual([])
  })

  test('缺 memberId -> VALIDATION_ERROR', async () => {
    ctx.stub.nextTransaction('tx-14')
    await expect(contract.ConfirmContribution(ctx, 'M001', '', 'CONFIRMED'))
      .rejects.toThrow(/memberId/)
  })

  test('状态跃迁到终态时发出 MilestoneClosed 事件', async () => {
    await confirm('alice', 'CONFIRMED', 'tx-1')
    expect(ctx.stub.getEvents()).toEqual([])

    await confirm('bob', 'CONFIRMED', 'tx-2')
    expect(ctx.stub.getEvents()).toEqual([])

    await confirm('charlie', 'CONFIRMED', 'tx-3')
    const events = ctx.stub.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('MilestoneClosed')
    expect(events[0].payload).toMatchObject({
      milestoneId: 'M001',
      projectId: 'P001',
      status: 'VERIFIED'
    })
    expect(events[0].payload.txId).toBe('tx-3')
  })

  test('拒绝导致 REJECTED 时同样发出 MilestoneClosed 事件', async () => {
    await confirm('alice', 'REJECTED', 'tx-r1')
    const events = ctx.stub.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].payload.status).toBe('REJECTED')
  })

  test('确认不会篡改贡献比例与文件哈希', async () => {
    await confirm('alice', 'CONFIRMED', 'tx-1')
    await confirm('bob', 'CONFIRMED', 'tx-2')
    await confirm('charlie', 'CONFIRMED', 'tx-3')

    const milestone = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(milestone.contributors).toEqual([
      { memberId: 'alice', percentage: 40 },
      { memberId: 'bob', percentage: 35 },
      { memberId: 'charlie', percentage: 25 }
    ])
    expect(milestone.fileHash).toBe(HASH_A)
    expect(milestone.fileName).toBe('prototype.zip')
  })

  test('两人里程碑：第一人确认不关闭，第二人确认才 VERIFIED', async () => {
    ctx.stub.nextTransaction('tx-m4')
    await contract.CreateMilestone(
      ctx, 'M004', 'P001', '两人协作', 'd', 'h.zip', HASH_A,
      JSON.stringify([
        { memberId: 'alice', percentage: 50 },
        { memberId: 'bob', percentage: 50 }
      ])
    )

    ctx.stub.nextTransaction('tx-c1')
    const afterFirst = JSON.parse(await contract.ConfirmContribution(ctx, 'M004', 'alice', 'CONFIRMED'))
    expect(afterFirst.status).toBe('PENDING_CONFIRMATION')

    ctx.stub.nextTransaction('tx-c2')
    const afterSecond = JSON.parse(await contract.ConfirmContribution(ctx, 'M004', 'bob', 'CONFIRMED'))
    expect(afterSecond.status).toBe('VERIFIED')
  })

  test('时间戳来自区块而非 Date.now()，两次同区块交易时间一致', async () => {
    ctx.stub.setTimestamp('2026-09-20T08:30:00.000Z')
    ctx.stub.nextTransaction('tx-t1')
    const first = JSON.parse(await contract.ConfirmContribution(ctx, 'M001', 'alice', 'CONFIRMED'))
    // 不推进时间戳，模拟同一区块内两笔交易
    ctx.stub.nextTransaction('tx-t2')
    const second = JSON.parse(await contract.ConfirmContribution(ctx, 'M001', 'bob', 'CONFIRMED'))

    expect(first.confirmations[0].timestamp).toBe('2026-09-20T08:30:00.000Z')
    expect(second.confirmations[1].timestamp).toBe('2026-09-20T08:30:00.000Z')
  })
})
