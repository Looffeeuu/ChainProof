'use strict'

/**
 * 贡献统计（API.md §4）与 Certificate（ARCHITECTURE §9 / API.md §5）测试。
 */

const ChainProofContract = require('../lib/chainproof-contract')
const { createContext } = require('./helpers/mock-stub')

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const HASH_C = 'c'.repeat(64)

/** 搭一个项目 + 三个里程碑，并完成指定的表态序列 */
async function seedFixture (contract, ctx) {
  await contract.CreateProject(
    ctx, 'P001', 'ChainProof Demo', '课程演示项目', 'alice',
    JSON.stringify(['alice', 'bob', 'charlie'])
  )
  await contract.CreateProject(ctx, 'P002', 'Other', 'd', 'bob', JSON.stringify(['bob', 'charlie']))

  // M001: alice 42 / bob 31 / charlie 27 -> 全部确认 -> VERIFIED
  ctx.stub.setTimestamp('2026-09-11T10:00:00.000Z')
  await contract.CreateMilestone(
    ctx, 'M001', 'P001', '需求与设计', 'd', 'spec.zip', HASH_A,
    JSON.stringify([
      { memberId: 'alice', percentage: 42 },
      { memberId: 'bob', percentage: 31 },
      { memberId: 'charlie', percentage: 27 }
    ])
  )
  await contract.ConfirmContribution(ctx, 'M001', 'alice', 'CONFIRMED')
  await contract.ConfirmContribution(ctx, 'M001', 'bob', 'CONFIRMED')
  await contract.ConfirmContribution(ctx, 'M001', 'charlie', 'CONFIRMED')

  // M002: alice 50 / charlie 50 -> 被拒绝 -> REJECTED（不计入统计）
  ctx.stub.setTimestamp('2026-09-12T10:00:00.000Z')
  await contract.CreateMilestone(
    ctx, 'M002', 'P001', '原型实现', 'd', 'proto.zip', HASH_B,
    JSON.stringify([
      { memberId: 'alice', percentage: 50 },
      { memberId: 'charlie', percentage: 50 }
    ])
  )
  await contract.ConfirmContribution(ctx, 'M002', 'alice', 'CONFIRMED')
  await contract.ConfirmContribution(ctx, 'M002', 'charlie', 'REJECTED')

  // M003: alice 60 / bob 40 -> 仅 alice 确认 -> PENDING（不计入统计）
  ctx.stub.setTimestamp('2026-09-13T10:00:00.000Z')
  await contract.CreateMilestone(
    ctx, 'M003', 'P001', '测试与部署', 'd', 'deploy.zip', HASH_C,
    JSON.stringify([
      { memberId: 'alice', percentage: 60 },
      { memberId: 'bob', percentage: 40 }
    ])
  )
  await contract.ConfirmContribution(ctx, 'M003', 'alice', 'CONFIRMED')
}

describe('ChainProofContract - GetProjectContributions', () => {
  let contract
  let ctx

  beforeEach(async () => {
    contract = new ChainProofContract()
    ;({ ctx } = createContext({ txId: 'tx-seed' }))
    await seedFixture(contract, ctx)
  })

  test('只统计 VERIFIED 里程碑', async () => {
    const result = JSON.parse(await contract.GetProjectContributions(ctx, 'P001'))

    expect(result).toEqual({
      projectId: 'P001',
      members: [
        { memberId: 'alice', percentage: 42 },
        { memberId: 'bob', percentage: 31 },
        { memberId: 'charlie', percentage: 27 }
      ],
      basedOnMilestones: 1
    })
  })

  test('多个 VERIFIED 里程碑时用最大余数法取整，且整数总和严格等于 100', async () => {
    // M004 与 M001 同为 VERIFIED：
    //   alice (42+60)/2 = 51（整）
    //   bob   (31+20)/2 = 25.5
    //   charlie (27+20)/2 = 23.5
    // 浮点和恰为 100，取整后也必须严格等于 100。
    ctx.stub.setTimestamp('2026-09-14T10:00:00.000Z')
    await contract.CreateMilestone(
      ctx, 'M004', 'P001', '文档整理', 'd', 'docs.zip', HASH_C,
      JSON.stringify([
        { memberId: 'alice', percentage: 60 },
        { memberId: 'bob', percentage: 20 },
        { memberId: 'charlie', percentage: 20 }
      ])
    )
    await contract.ConfirmContribution(ctx, 'M004', 'alice', 'CONFIRMED')
    await contract.ConfirmContribution(ctx, 'M004', 'bob', 'CONFIRMED')
    await contract.ConfirmContribution(ctx, 'M004', 'charlie', 'CONFIRMED')

    const result = JSON.parse(await contract.GetProjectContributions(ctx, 'P001'))
    expect(result.basedOnMilestones).toBe(2)

    const byMember = Object.fromEntries(result.members.map((m) => [m.memberId, m.percentage]))
    expect(byMember.alice).toBe(51)
    // 向下取整和为 51+25+23 = 99，剩余 1 个名额按余数最大者分配；
    // bob 与 charlie 余数同为 0.5，按 memberId 升序取 bob（确定性要求）
    expect(byMember.bob).toBe(26)
    expect(byMember.charlie).toBe(23)

    result.members.forEach((m) => expect(Number.isInteger(m.percentage)).toBe(true))
    const sum = result.members.reduce((s, m) => s + m.percentage, 0)
    expect(sum).toBe(100)
  })

  /**
   * 回归锁：逐项 Math.round 会让总和溢出到 101。
   *
   * 曾实测到的缺陷数据：两个 VERIFIED 里程碑
   *   M001: alice 40 / bob 35 / charlie 25
   *   M002: alice 60 / bob 20 / charlie 20
   * 精确平均为 50 / 27.5 / 22.5，逐项四舍五入得 50+28+23 = 101，
   * 导致 Dashboard 贡献占比图对不上、答辩出现「贡献总和 101%」。
   * 若有人把 _roundContributions 改回逐项取整，本测试会失败。
   */
  test('两个 .5 同时出现时总和不得溢出到 101', async () => {
    await contract.CreateProject(ctx, 'P100', 'rounding', 'd', 'alice',
      JSON.stringify(['alice', 'bob', 'charlie']))

    ctx.stub.setTimestamp('2026-09-15T10:00:00.000Z')
    await contract.CreateMilestone(
      ctx, 'M100', 'P100', 'first', 'd', 'a.zip', HASH_A,
      JSON.stringify([
        { memberId: 'alice', percentage: 40 },
        { memberId: 'bob', percentage: 35 },
        { memberId: 'charlie', percentage: 25 }
      ])
    )
    await contract.ConfirmContribution(ctx, 'M100', 'alice', 'CONFIRMED')
    await contract.ConfirmContribution(ctx, 'M100', 'bob', 'CONFIRMED')
    await contract.ConfirmContribution(ctx, 'M100', 'charlie', 'CONFIRMED')

    ctx.stub.setTimestamp('2026-09-16T10:00:00.000Z')
    await contract.CreateMilestone(
      ctx, 'M101', 'P100', 'second', 'd', 'b.zip', HASH_B,
      JSON.stringify([
        { memberId: 'alice', percentage: 60 },
        { memberId: 'bob', percentage: 20 },
        { memberId: 'charlie', percentage: 20 }
      ])
    )
    await contract.ConfirmContribution(ctx, 'M101', 'alice', 'CONFIRMED')
    await contract.ConfirmContribution(ctx, 'M101', 'bob', 'CONFIRMED')
    await contract.ConfirmContribution(ctx, 'M101', 'charlie', 'CONFIRMED')

    const result = JSON.parse(await contract.GetProjectContributions(ctx, 'P100'))
    const byMember = Object.fromEntries(result.members.map((m) => [m.memberId, m.percentage]))

    // 精确平均：alice 50、bob 27.5、charlie 22.5
    expect(byMember.alice).toBe(50)
    const sum = result.members.reduce((s, m) => s + m.percentage, 0)
    expect(sum).toBe(100) // 逐项 Math.round 会得到 101
    expect(sum).not.toBe(101)
  })

  test('成员参与里程碑数量不同时，总和可能不是 100 但必须等于精确平均之和的取整', async () => {
    // bob 只参与 M001（31），alice/charlie 参与 M001 与 M004。
    // 此时精确平均之和 != 100，属正常业务结果，但取整仍须与 Math.round(精确和) 一致。
    ctx.stub.setTimestamp('2026-09-17T10:00:00.000Z')
    await contract.CreateMilestone(
      ctx, 'M005', 'P001', 'uneven', 'd', 'u.zip', HASH_C,
      JSON.stringify([
        { memberId: 'alice', percentage: 70 },
        { memberId: 'charlie', percentage: 30 }
      ])
    )
    await contract.ConfirmContribution(ctx, 'M005', 'alice', 'CONFIRMED')
    await contract.ConfirmContribution(ctx, 'M005', 'charlie', 'CONFIRMED')

    const result = JSON.parse(await contract.GetProjectContributions(ctx, 'P001'))
    const byMember = Object.fromEntries(result.members.map((m) => [m.memberId, m.percentage]))

    // alice (42+70)/2 = 56，bob 31（仅 M001），charlie (27+30)/2 = 28.5
    expect(byMember.alice).toBe(56)
    expect(byMember.bob).toBe(31)
    // 精确和 = 56 + 31 + 28.5 = 115.5 -> targetSum 116
    const sum = result.members.reduce((s, m) => s + m.percentage, 0)
    expect(sum).toBe(116)
    expect(Number.isInteger(byMember.charlie)).toBe(true)
  })

  test('没有 VERIFIED 里程碑时返回空 members 与 basedOnMilestones 0', async () => {
    const result = JSON.parse(await contract.GetProjectContributions(ctx, 'P002'))
    expect(result).toEqual({ projectId: 'P002', members: [], basedOnMilestones: 0 })
  })

  test('只统计 VERIFIED：仅有 PENDING 与 REJECTED 的项目结果为空', async () => {
    await contract.CreateProject(ctx, 'P003', 'mixed', 'd', 'alice', JSON.stringify(['alice', 'bob']))
    ctx.stub.setTimestamp('2026-09-15T10:00:00.000Z')
    await contract.CreateMilestone(
      ctx, 'M010', 'P003', 'rejected', 'd', 'x.zip', HASH_A,
      JSON.stringify([{ memberId: 'alice', percentage: 50 }, { memberId: 'bob', percentage: 50 }])
    )
    await contract.ConfirmContribution(ctx, 'M010', 'alice', 'REJECTED')
    ctx.stub.setTimestamp('2026-09-16T10:00:00.000Z')
    await contract.CreateMilestone(
      ctx, 'M011', 'P003', 'pending', 'd', 'y.zip', HASH_B,
      JSON.stringify([{ memberId: 'alice', percentage: 100 }])
    )

    const result = JSON.parse(await contract.GetProjectContributions(ctx, 'P003'))
    expect(result.basedOnMilestones).toBe(0)
    expect(result.members).toEqual([])
  })

  test('项目不存在 -> PROJECT_NOT_FOUND', async () => {
    await expect(contract.GetProjectContributions(ctx, 'P404')).rejects.toThrow(/^PROJECT_NOT_FOUND: /)
  })

  test('统计只读，不改变任何里程碑状态', async () => {
    const before = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    await contract.GetProjectContributions(ctx, 'P001')
    const after = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(after).toEqual(before)
  })
})

describe('ChainProofContract - Certificate', () => {
  let contract
  let ctx

  beforeEach(async () => {
    contract = new ChainProofContract()
    ;({ ctx } = createContext({ txId: 'tx-seed' }))
    await seedFixture(contract, ctx)
  })

  test('IssueCertificate 返回完整 Certificate，字段与 API.md §6 一致', async () => {
    ctx.stub.setTimestamp('2026-09-20T10:00:00.000Z')
    ctx.stub.nextTransaction('tx-issue-alice')
    const certificate = JSON.parse(await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice'))

    expect(certificate).toEqual({
      docType: 'certificate',
      certificateId: 'CP-001',
      projectId: 'P001',
      memberId: 'alice',
      contributionPercentage: 42,
      milestoneIds: ['M001'],
      issuedAt: '2026-09-20T10:00:00.000Z',
      verificationStatus: 'VALID',
      txId: 'tx-issue-alice'
    })
  })

  test('milestoneIds 只包含该成员参与的 VERIFIED 里程碑', async () => {
    // M001 VERIFIED（bob 参与），M002 REJECTED（bob 不参与），M003 PENDING（bob 参与但不计入）
    ctx.stub.nextTransaction('tx-issue-bob')
    const certificate = JSON.parse(await contract.IssueCertificate(ctx, 'CP-002', 'P001', 'bob'))

    expect(certificate.milestoneIds).toEqual(['M001'])
    expect(certificate.contributionPercentage).toBe(31)
  })

  test('同一 projectId + memberId 重复签发返回已有证书（幂等，不产生新 ID）', async () => {
    ctx.stub.setTimestamp('2026-09-20T10:00:00.000Z')
    ctx.stub.nextTransaction('tx-issue-1')
    const first = JSON.parse(await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice'))

    ctx.stub.setTimestamp('2026-09-25T10:00:00.000Z')
    ctx.stub.nextTransaction('tx-issue-2')
    const second = JSON.parse(await contract.IssueCertificate(ctx, 'CP-999', 'P001', 'alice'))

    expect(second).toEqual(first)
    expect(second.certificateId).toBe('CP-001') // 未采用新传入的 CP-999
    expect(second.txId).toBe('tx-issue-1')
    expect(second.issuedAt).toBe('2026-09-20T10:00:00.000Z')
  })

  test('幂等重复签发不写入新状态键', async () => {
    ctx.stub.nextTransaction('tx-issue-1')
    await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice')
    const keysAfterFirst = ctx.stub.keys().length

    ctx.stub.nextTransaction('tx-issue-2')
    await contract.IssueCertificate(ctx, 'CP-002', 'P001', 'alice')
    expect(ctx.stub.keys()).toHaveLength(keysAfterFirst)
  })

  test('同一项目不同成员可各自签发', async () => {
    ctx.stub.nextTransaction('tx-issue-a')
    const alice = JSON.parse(await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice'))
    ctx.stub.nextTransaction('tx-issue-b')
    const bob = JSON.parse(await contract.IssueCertificate(ctx, 'CP-002', 'P001', 'bob'))

    expect(alice.certificateId).toBe('CP-001')
    expect(bob.certificateId).toBe('CP-002')
    expect(alice.contributionPercentage).toBe(42)
    expect(bob.contributionPercentage).toBe(31)
  })

  test('项目无 VERIFIED 里程碑 -> VALIDATION_ERROR，拒绝签发', async () => {
    ctx.stub.nextTransaction('tx-issue-none')
    await expect(contract.IssueCertificate(ctx, 'CP-010', 'P002', 'bob'))
      .rejects.toThrow(/还没有已验证/)
  })

  test('成员不属于项目 -> VALIDATION_ERROR', async () => {
    ctx.stub.nextTransaction('tx-issue-outsider')
    await expect(contract.IssueCertificate(ctx, 'CP-011', 'P001', 'mallory'))
      .rejects.toThrow(/不属于项目/)
    await expect(contract.IssueCertificate(ctx, 'CP-012', 'P002', 'alice'))
      .rejects.toThrow(/不属于项目/)
  })

  test('项目不存在 -> PROJECT_NOT_FOUND（优先于成员校验）', async () => {
    ctx.stub.nextTransaction('tx-issue-404')
    await expect(contract.IssueCertificate(ctx, 'CP-013', 'P404', 'alice'))
      .rejects.toThrow(/^PROJECT_NOT_FOUND: /)
  })

  test('成员有 VERIFIED 里程碑之外无贡献记录 -> VALIDATION_ERROR', async () => {
    // charlie 在 M001（VERIFIED）中占 27%，可签发；
    // 构造一个只在 REJECTED 里程碑中出现的成员 dave 所属项目
    await contract.CreateProject(ctx, 'P004', 'no verified contribution', 'd', 'dave',
      JSON.stringify(['dave', 'erin']))
    ctx.stub.setTimestamp('2026-09-18T10:00:00.000Z')
    await contract.CreateMilestone(
      ctx, 'M020', 'P004', 'only pending', 'd', 'z.zip', HASH_A,
      JSON.stringify([{ memberId: 'dave', percentage: 60 }, { memberId: 'erin', percentage: 40 }])
    )
    // 只有 dave 确认 -> PENDING，basedOnMilestones = 0
    await contract.ConfirmContribution(ctx, 'M020', 'dave', 'CONFIRMED')

    ctx.stub.nextTransaction('tx-issue-pending')
    await expect(contract.IssueCertificate(ctx, 'CP-020', 'P004', 'dave'))
      .rejects.toThrow(/还没有已验证/)
  })

  test('缺参数 -> VALIDATION_ERROR', async () => {
    ctx.stub.nextTransaction('tx-issue-bad1')
    await expect(contract.IssueCertificate(ctx, '', 'P001', 'alice')).rejects.toThrow(/certificateId/)
    ctx.stub.nextTransaction('tx-issue-bad2')
    await expect(contract.IssueCertificate(ctx, 'CP-1', '', 'alice')).rejects.toThrow(/projectId/)
    ctx.stub.nextTransaction('tx-issue-bad3')
    await expect(contract.IssueCertificate(ctx, 'CP-1', 'P001', '')).rejects.toThrow(/memberId/)
  })

  test('IssueCertificate 发出 CertificateIssued 事件', async () => {
    ctx.stub.nextTransaction('tx-issue-event')
    await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice')

    const events = ctx.stub.getEvents().filter((e) => e.name === 'CertificateIssued')
    expect(events).toHaveLength(1)
    expect(events[0].payload).toMatchObject({
      certificateId: 'CP-001',
      projectId: 'P001',
      memberId: 'alice',
      txId: 'tx-issue-event'
    })
  })

  test('幂等重复签发不重复发出事件', async () => {
    ctx.stub.nextTransaction('tx-issue-e1')
    await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice')
    ctx.stub.nextTransaction('tx-issue-e2')
    await contract.IssueCertificate(ctx, 'CP-002', 'P001', 'alice')

    const events = ctx.stub.getEvents().filter((e) => e.name === 'CertificateIssued')
    expect(events).toHaveLength(1)
  })

  describe('VerifyCertificate', () => {
    test('证书不存在时返回 NOT_FOUND，不是错误', async () => {
      const result = JSON.parse(await contract.VerifyCertificate(ctx, 'CP-NOPE'))
      expect(result).toEqual({ certificateId: 'CP-NOPE', verificationStatus: 'NOT_FOUND' })
      expect(result.certificate).toBeUndefined()
    })

    test('有效证书返回 VALID 且结构与 API.md §5 一致', async () => {
      ctx.stub.nextTransaction('tx-issue-v')
      await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice')

      const result = JSON.parse(await contract.VerifyCertificate(ctx, 'CP-001'))
      expect(result.certificateId).toBe('CP-001')
      expect(result.verificationStatus).toBe('VALID')
      expect(result.certificate).toMatchObject({
        certificateId: 'CP-001',
        projectId: 'P001',
        memberId: 'alice',
        contributionPercentage: 42,
        milestoneIds: ['M001'],
        verificationStatus: 'VALID',
        txId: 'tx-issue-v'
      })
      expect(result.certificate.issuedAt).toEqual(expect.any(String))
    })

    test('项目被删除后验证结果为 INVALID', async () => {
      ctx.stub.nextTransaction('tx-issue-v2')
      await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice')

      await ctx.stub.deleteState('PROJECT_P001')

      const result = JSON.parse(await contract.VerifyCertificate(ctx, 'CP-001'))
      expect(result.verificationStatus).toBe('INVALID')
      expect(result.certificate.verificationStatus).toBe('INVALID')
    })

    test('成员被移出项目后验证结果为 INVALID', async () => {
      ctx.stub.nextTransaction('tx-issue-v3')
      await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice')

      // 改写项目成员，剔除 alice
      await ctx.stub.putState('PROJECT_P001', Buffer.from(JSON.stringify({
        docType: 'project', projectId: 'P001', name: 'ChainProof Demo',
        description: '课程演示项目', ownerId: 'bob', members: ['bob', 'charlie'],
        createdAt: '2026-09-11T10:00:00.000Z', status: 'ACTIVE', txId: 'tx-rewrite'
      })))

      const result = JSON.parse(await contract.VerifyCertificate(ctx, 'CP-001'))
      expect(result.verificationStatus).toBe('INVALID')
    })

    test('缺 certificateId -> VALIDATION_ERROR', async () => {
      await expect(contract.VerifyCertificate(ctx, '')).rejects.toThrow(/certificateId/)
    })
  })

  describe('GetCertificate / GetCertificates', () => {
    beforeEach(async () => {
      ctx.stub.nextTransaction('tx-issue-l1')
      await contract.IssueCertificate(ctx, 'CP-001', 'P001', 'alice')
      ctx.stub.nextTransaction('tx-issue-l2')
      await contract.IssueCertificate(ctx, 'CP-002', 'P001', 'bob')
      ctx.stub.nextTransaction('tx-issue-l3')
      await contract.IssueCertificate(ctx, 'CP-003', 'P001', 'charlie')
    })

    test('GetCertificate 读取单张证书', async () => {
      const certificate = JSON.parse(await contract.GetCertificate(ctx, 'CP-002'))
      expect(certificate).toMatchObject({ certificateId: 'CP-002', memberId: 'bob', projectId: 'P001' })
    })

    test('GetCertificate 不存在 -> CERTIFICATE_NOT_FOUND', async () => {
      await expect(contract.GetCertificate(ctx, 'CP-404')).rejects.toThrow(/^CERTIFICATE_NOT_FOUND: /)
    })

    test('不带过滤条件返回全部证书，按 issuedAt 正序', async () => {
      const all = JSON.parse(await contract.GetCertificates(ctx, '', ''))
      expect(all.map((c) => c.certificateId)).toEqual(['CP-001', 'CP-002', 'CP-003'])
    })

    test('按 projectId 过滤', async () => {
      const list = JSON.parse(await contract.GetCertificates(ctx, 'P001', ''))
      expect(list).toHaveLength(3)
      expect(list.every((c) => c.projectId === 'P001')).toBe(true)
    })

    test('按 projectId + memberId 精确过滤', async () => {
      const list = JSON.parse(await contract.GetCertificates(ctx, 'P001', 'bob'))
      expect(list).toHaveLength(1)
      expect(list[0].certificateId).toBe('CP-002')
    })

    test('仅按 memberId 过滤', async () => {
      const list = JSON.parse(await contract.GetCertificates(ctx, '', 'charlie'))
      expect(list).toHaveLength(1)
      expect(list[0].certificateId).toBe('CP-003')
    })

    test('不存在的过滤条件返回空数组而非报错', async () => {
      await expect(contract.GetCertificates(ctx, 'P404', '')).resolves.toBe('[]')
      await expect(contract.GetCertificates(ctx, 'P001', 'mallory')).resolves.toBe('[]')
      await expect(contract.GetCertificates(ctx, '', 'mallory')).resolves.toBe('[]')
    })
  })
})
