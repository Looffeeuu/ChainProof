'use strict'

/**
 * Project / Milestone 读写与校验测试。
 */

const ChainProofContract = require('../lib/chainproof-contract')
const { createContext } = require('./helpers/mock-stub')

const SHA = (seed) => `${String(seed).padStart(64, '0').replace(/[^0-9a-f]/g, '0')}`.slice(0, 64)
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

describe('ChainProofContract - Project', () => {
  let contract
  let ctx

  beforeEach(() => {
    contract = new ChainProofContract()
    ;({ ctx } = createContext({ txId: 'tx-create-project' }))
  })

  test('CreateProject 返回完整 Project，字段与 API.md §6 一致', async () => {
    const raw = await contract.CreateProject(
      ctx, 'P001', 'ChainProof Demo', '课程演示项目', 'alice',
      JSON.stringify(['alice', 'bob', 'charlie'])
    )
    const project = JSON.parse(raw)

    expect(project).toEqual({
      docType: 'project',
      projectId: 'P001',
      name: 'ChainProof Demo',
      description: '课程演示项目',
      ownerId: 'alice',
      members: ['alice', 'bob', 'charlie'],
      createdAt: expect.any(String),
      status: 'ACTIVE',
      txId: 'tx-create-project'
    })
    // ISO 8601
    expect(new Date(project.createdAt).toISOString()).toBe(project.createdAt)
  })

  test('GetProject 回读创建结果', async () => {
    const created = JSON.parse(await contract.CreateProject(
      ctx, 'P001', 'ChainProof Demo', '课程演示项目', 'alice', JSON.stringify(['alice', 'bob'])
    ))
    const read = JSON.parse(await contract.GetProject(ctx, 'P001'))
    expect(read).toEqual(created)
  })

  test('ProjectExists 对不存在项目返回 false', async () => {
    await expect(contract.ProjectExists(ctx, 'NOPE')).resolves.toBe(false)
    await contract.CreateProject(ctx, 'P001', 'n', 'd', 'alice', JSON.stringify(['alice']))
    await expect(contract.ProjectExists(ctx, 'P001')).resolves.toBe(true)
  })

  test('重复创建同一项目 -> VALIDATION_ERROR', async () => {
    await contract.CreateProject(ctx, 'P001', 'n', 'd', 'alice', JSON.stringify(['alice']))
    await expect(
      contract.CreateProject(ctx, 'P001', 'n2', 'd2', 'bob', JSON.stringify(['bob']))
    ).rejects.toThrow(/^VALIDATION_ERROR: /)
  })

  test('读取不存在的项目 -> PROJECT_NOT_FOUND', async () => {
    await expect(contract.GetProject(ctx, 'P404')).rejects.toThrow(/^PROJECT_NOT_FOUND: /)
  })

  test('空成员列表 -> VALIDATION_ERROR', async () => {
    await expect(
      contract.CreateProject(ctx, 'P001', 'n', 'd', 'alice', JSON.stringify([]))
    ).rejects.toThrow(/至少要有一名成员/)
  })

  test('members 不是 JSON 数组 -> VALIDATION_ERROR', async () => {
    await expect(
      contract.CreateProject(ctx, 'P001', 'n', 'd', 'alice', '{"a":1}')
    ).rejects.toThrow(/^VALIDATION_ERROR: /)
    await expect(
      contract.CreateProject(ctx, 'P002', 'n', 'd', 'alice', 'not-json')
    ).rejects.toThrow(/^VALIDATION_ERROR: /)
  })

  test('重复成员 -> VALIDATION_ERROR', async () => {
    await expect(
      contract.CreateProject(ctx, 'P001', 'n', 'd', 'alice', JSON.stringify(['alice', 'alice']))
    ).rejects.toThrow(/重复成员/)
  })

  test('members 含空串 / 纯空白 / 非字符串元素 -> VALIDATION_ERROR', async () => {
    // 空字符串
    await expect(
      contract.CreateProject(ctx, 'P001', 'n', 'd', 'alice', JSON.stringify(['alice', '']))
    ).rejects.toThrow(/members\[1\] 必须是非空字符串/)

    // 纯空白（trim 后为空）
    await expect(
      contract.CreateProject(ctx, 'P002', 'n', 'd', 'alice', JSON.stringify(['   ']))
    ).rejects.toThrow(/必须是非空字符串/)

    // 非字符串元素
    await expect(
      contract.CreateProject(ctx, 'P003', 'n', 'd', 'alice', JSON.stringify([123, 'alice']))
    ).rejects.toThrow(/members\[0\] 必须是非空字符串/)
    await expect(
      contract.CreateProject(ctx, 'P004', 'n', 'd', 'alice', JSON.stringify([null]))
    ).rejects.toThrow(/必须是非空字符串/)

    // 校验失败不得留下任何脏状态
    await expect(contract.ProjectExists(ctx, 'P001')).resolves.toBe(false)
    await expect(contract.ProjectExists(ctx, 'P002')).resolves.toBe(false)
    await expect(contract.ProjectExists(ctx, 'P003')).resolves.toBe(false)
    await expect(contract.ProjectExists(ctx, 'P004')).resolves.toBe(false)
  })

  test('members 两端空白被规整后再入库', async () => {
    const project = JSON.parse(await contract.CreateProject(
      ctx, 'P001', 'n', 'd', 'alice', JSON.stringify(['  alice  ', 'bob'])
    ))
    expect(project.members).toEqual(['alice', 'bob'])
  })

  test('缺 projectId / name / ownerId -> VALIDATION_ERROR', async () => {
    await expect(contract.CreateProject(ctx, '', 'n', 'd', 'alice', '["alice"]')).rejects.toThrow(/projectId/)
    await expect(contract.CreateProject(ctx, 'P1', '', 'd', 'alice', '["alice"]')).rejects.toThrow(/name/)
    await expect(contract.CreateProject(ctx, 'P1', 'n', 'd', '', '["alice"]')).rejects.toThrow(/ownerId/)
  })

  test('description 可省略，落库为空字符串', async () => {
    const project = JSON.parse(await contract.CreateProject(
      ctx, 'P001', 'n', undefined, 'alice', JSON.stringify(['alice'])
    ))
    expect(project.description).toBe('')
  })

  test('GetAllProjects 按 createdAt 正序返回全部项目', async () => {
    ctx.stub.setTimestamp('2026-09-11T10:00:00.000Z')
    await contract.CreateProject(ctx, 'P002', 'second', 'd', 'alice', JSON.stringify(['alice']))
    ctx.stub.setTimestamp('2026-09-10T10:00:00.000Z')
    await contract.CreateProject(ctx, 'P001', 'first', 'd', 'bob', JSON.stringify(['bob']))

    const projects = JSON.parse(await contract.GetAllProjects(ctx))
    expect(projects.map((p) => p.projectId)).toEqual(['P001', 'P002'])
    // 索引键等非 project 记录不得混入
    expect(projects.every((p) => p.docType === 'project')).toBe(true)
  })

  test('GetProjectHistory 回放全部写入记录并带 txId', async () => {
    ctx.stub.setTimestamp('2026-09-11T10:00:00.000Z')
    await contract.CreateProject(ctx, 'P001', 'v1', 'd', 'alice', JSON.stringify(['alice']))
    ctx.stub.nextTransactionAt('tx-update-1', '2026-09-12T10:00:00.000Z')
    // 直接改写世界状态以模拟一次项目更新
    await ctx.stub.putState('PROJECT_P001', Buffer.from(JSON.stringify({
      docType: 'project', projectId: 'P001', name: 'v2', description: 'd',
      ownerId: 'alice', members: ['alice'], createdAt: '2026-09-11T10:00:00.000Z',
      status: 'ACTIVE', txId: 'tx-update-1'
    })))

    const history = JSON.parse(await contract.GetProjectHistory(ctx, 'P001'))
    expect(history).toHaveLength(2)
    expect(history[0].txId).toBe('tx-create-project')
    expect(history[1].txId).toBe('tx-update-1')
    expect(history[0].isDelete).toBe(false)
    expect(history[1].value.name).toBe('v2')
    expect(new Date(history[0].timestamp).toISOString()).toBe(history[0].timestamp)
  })

  test('GetProjectHistory 对不存在项目 -> PROJECT_NOT_FOUND', async () => {
    await expect(contract.GetProjectHistory(ctx, 'P404')).rejects.toThrow(/^PROJECT_NOT_FOUND: /)
  })
})

describe('ChainProofContract - Milestone', () => {
  let contract
  let ctx

  beforeEach(async () => {
    contract = new ChainProofContract()
    ;({ ctx } = createContext({ txId: 'tx-create-project' }))
    await contract.CreateProject(
      ctx, 'P001', 'ChainProof Demo', '课程演示项目', 'alice',
      JSON.stringify(['alice', 'bob', 'charlie'])
    )
    ctx.stub.nextTransaction('tx-create-milestone')
  })

  const createMilestone = (overrides = {}) => contract.CreateMilestone(
    ctx,
    overrides.milestoneId || 'M001',
    overrides.projectId || 'P001',
    overrides.title || '第一版原型',
    overrides.description || '完成 MVP',
    overrides.fileName || 'prototype.zip',
    overrides.fileHash || HASH_A,
    overrides.contributorsJson || JSON.stringify([
      { memberId: 'alice', percentage: 50 },
      { memberId: 'bob', percentage: 50 }
    ])
  )

  test('CreateMilestone 返回完整 Milestone，字段与 API.md §6 一致', async () => {
    const milestone = JSON.parse(await createMilestone())

    expect(milestone).toEqual({
      docType: 'milestone',
      milestoneId: 'M001',
      projectId: 'P001',
      title: '第一版原型',
      description: '完成 MVP',
      fileName: 'prototype.zip',
      fileHash: HASH_A,
      contributors: [
        { memberId: 'alice', percentage: 50 },
        { memberId: 'bob', percentage: 50 }
      ],
      confirmations: [],
      createdAt: expect.any(String),
      status: 'PENDING_CONFIRMATION',
      txId: 'tx-create-milestone'
    })
  })

  test('GetMilestone 回读创建结果', async () => {
    const created = JSON.parse(await createMilestone())
    const read = JSON.parse(await contract.GetMilestone(ctx, 'M001'))
    expect(read).toEqual(created)
  })

  test('读取不存在的里程碑 -> MILESTONE_NOT_FOUND', async () => {
    await expect(contract.GetMilestone(ctx, 'M404')).rejects.toThrow(/^MILESTONE_NOT_FOUND: /)
  })

  test('项目不存在时优先报 PROJECT_NOT_FOUND', async () => {
    await expect(createMilestone({ projectId: 'P404' })).rejects.toThrow(/^PROJECT_NOT_FOUND: /)
  })

  test('重复里程碑 ID -> VALIDATION_ERROR', async () => {
    await createMilestone()
    await expect(createMilestone()).rejects.toThrow(/已经存在/)
  })

  test('fileHash 必须是 64 位小写十六进制', async () => {
    await expect(createMilestone({ fileHash: 'abc' })).rejects.toThrow(/SHA-256/)
    await expect(createMilestone({ fileHash: 'A'.repeat(64) })).rejects.toThrow(/SHA-256/)
    await expect(createMilestone({ fileHash: HASH_B })).resolves.toBeDefined()
  })

  test('贡献比例总和不是 100 -> CONTRIBUTION_TOTAL_INVALID', async () => {
    await expect(createMilestone({
      contributorsJson: JSON.stringify([
        { memberId: 'alice', percentage: 50 },
        { memberId: 'bob', percentage: 47 }
      ])
    })).rejects.toThrow(/^CONTRIBUTION_TOTAL_INVALID: 贡献比例总和是 97%/)

    await expect(createMilestone({
      contributorsJson: JSON.stringify([
        { memberId: 'alice', percentage: 60 },
        { memberId: 'bob', percentage: 60 }
      ])
    })).rejects.toThrow(/总和是 120%/)
  })

  test('percentage 必须是整数（拒绝小数与字符串）', async () => {
    await expect(createMilestone({
      contributorsJson: JSON.stringify([
        { memberId: 'alice', percentage: 50.5 },
        { memberId: 'bob', percentage: 49.5 }
      ])
    })).rejects.toThrow(/必须是整数/)

    await expect(createMilestone({
      contributorsJson: JSON.stringify([
        { memberId: 'alice', percentage: '50' },
        { memberId: 'bob', percentage: '50' }
      ])
    })).rejects.toThrow(/必须是整数/)
  })

  test('percentage 越界 -> VALIDATION_ERROR', async () => {
    await expect(createMilestone({
      contributorsJson: JSON.stringify([
        { memberId: 'alice', percentage: 120 },
        { memberId: 'bob', percentage: -20 }
      ])
    })).rejects.toThrow(/0 到 100 之间/)
  })

  test('空 contributors -> VALIDATION_ERROR', async () => {
    await expect(createMilestone({ contributorsJson: '[]' })).rejects.toThrow(/不能为空/)
  })

  test('contributors 内成员重复 -> VALIDATION_ERROR', async () => {
    await expect(createMilestone({
      contributorsJson: JSON.stringify([
        { memberId: 'alice', percentage: 50 },
        { memberId: 'alice', percentage: 50 }
      ])
    })).rejects.toThrow(/重复出现/)
  })

  test('贡献者不是项目成员 -> VALIDATION_ERROR', async () => {
    await expect(createMilestone({
      contributorsJson: JSON.stringify([
        { memberId: 'alice', percentage: 50 },
        { memberId: 'mallory', percentage: 50 }
      ])
    })).rejects.toThrow(/不属于项目/)
  })

  test('单个贡献者 100% 合法', async () => {
    const milestone = JSON.parse(await createMilestone({
      milestoneId: 'M002',
      contributorsJson: JSON.stringify([{ memberId: 'charlie', percentage: 100 }])
    }))
    expect(milestone.contributors).toEqual([{ memberId: 'charlie', percentage: 100 }])
  })

  test('三人 42/31/27 分配合法（API.md 示例）', async () => {
    const milestone = JSON.parse(await createMilestone({
      milestoneId: 'M003',
      contributorsJson: JSON.stringify([
        { memberId: 'alice', percentage: 42 },
        { memberId: 'bob', percentage: 31 },
        { memberId: 'charlie', percentage: 27 }
      ])
    }))
    expect(milestone.contributors).toHaveLength(3)
  })

  test('GetProjectMilestones 按 createdAt 正序返回，且按项目隔离', async () => {
    await contract.CreateProject(ctx, 'P002', 'other', 'd', 'alice', JSON.stringify(['alice', 'bob']))

    ctx.stub.setTimestamp('2026-09-13T10:00:00.000Z')
    await createMilestone({ milestoneId: 'M002', projectId: 'P002' })
    ctx.stub.setTimestamp('2026-09-11T10:00:00.000Z')
    await createMilestone({ milestoneId: 'M001' })
    ctx.stub.setTimestamp('2026-09-12T10:00:00.000Z')
    await createMilestone({
      milestoneId: 'M003',
      contributorsJson: JSON.stringify([{ memberId: 'alice', percentage: 100 }])
    })

    const p1 = JSON.parse(await contract.GetProjectMilestones(ctx, 'P001'))
    expect(p1.map((m) => m.milestoneId)).toEqual(['M001', 'M003'])

    const p2 = JSON.parse(await contract.GetProjectMilestones(ctx, 'P002'))
    expect(p2.map((m) => m.milestoneId)).toEqual(['M002'])
  })

  test('项目无里程碑时返回空数组而非报错', async () => {
    await contract.CreateProject(ctx, 'P003', 'empty', 'd', 'alice', JSON.stringify(['alice']))
    await expect(contract.GetProjectMilestones(ctx, 'P003')).resolves.toBe('[]')
  })

  test('GetProjectMilestones 对不存在项目 -> PROJECT_NOT_FOUND', async () => {
    await expect(contract.GetProjectMilestones(ctx, 'P404')).rejects.toThrow(/^PROJECT_NOT_FOUND: /)
  })
})
