/**
 * 假数据。字段严格照 spec/02 §2 的四张表，只有那些字段，不多不少——
 * 多造一个字段，页面就可能用上它，等接真接口时才发现它根本不存在。
 *
 * 2026-09-11 按 B、C 线的答复对齐（spec/03 §5、§9）：
 * - Milestone 与 Certificate 都多了 `txId`，是 Fabric 的交易 ID，64 位十六进制。
 *   里程碑的 txId 对应「最近一次让它进入当前状态」的那笔交易，
 *   所以确认导致状态变化时它会被更新，不是创建时就固定。
 * - Certificate 的 `verificationStatus` 取值是 `VALID` / `NOT_FOUND`，
 *   **不是 `VERIFIED`**——后者是 Milestone.status 的取值，两者同形不同义。
 *
 * 内容沿用最初那份静态样张（已删除）的设定，这样页面做出来
 * 和样张能直接对照。三个项目分别覆盖三种情况：有待确认的、全部已验证的、一条里程碑都没有的。
 */

export const MEMBERS = ['alice', 'bob', 'charlie']

export const projects = [
  {
    projectId: 'P001',
    name: 'VLA 安全性基准测试',
    description:
      '面向视觉—语言—动作模型的安全性评测集，包含 200 条标注样本、评测脚本与基线结果。每次提交的文件由系统计算 SHA-256 后连同贡献声明一起存证。',
    ownerId: 'alice',
    members: ['alice', 'bob', 'charlie'],
    createdAt: '2026-08-31T09:00:00.000Z',
    status: 'ACTIVE'
  },
  {
    projectId: 'P002',
    name: '课程实验报告归档',
    description: '四次实验的报告与代码存证，用于结课材料核对。',
    ownerId: 'bob',
    members: ['alice', 'bob', 'charlie'],
    createdAt: '2026-08-20T02:30:00.000Z',
    status: 'ACTIVE'
  },
  {
    // 描述为空：spec/02 §2.1 说这个字段可能为空，页面要有兜底。
    // 假数据里必须真的留一个空的，否则那段兜底代码永远跑不到。
    projectId: 'P003',
    name: '答辩演示脚本',
    description: '',
    ownerId: 'charlie',
    members: ['alice', 'charlie'],
    createdAt: '2026-09-08T13:05:00.000Z',
    status: 'ACTIVE'
  }
]

export const milestones = [
  {
    milestoneId: 'M004',
    projectId: 'P001',
    title: '基准测试集 v0.3 与评测脚本',
    description: '新增 60 条对抗样本；评测脚本改为按场景分组输出。等待 charlie 确认。',
    fileName: 'benchmark-v0.3.zip',
    fileHash: '9f2c4b7a58e13d0c6b91af4e27350d8ac6f1e94b03d7528aef6c1b496f970a4b',
    contributors: [
      { memberId: 'alice', percentage: 50 },
      { memberId: 'bob', percentage: 30 },
      { memberId: 'charlie', percentage: 20 }
    ],
    confirmations: [
      { memberId: 'alice', decision: 'CONFIRMED', timestamp: '2026-09-09T06:25:00.000Z' },
      { memberId: 'bob', decision: 'CONFIRMED', timestamp: '2026-09-09T08:41:00.000Z' }
    ],
    createdAt: '2026-09-09T06:22:00.000Z',
    status: 'PENDING_CONFIRMATION',
    txId: '799ee73cfb2737263c98c122d67e53f472789361dbe8843cec2260608246cc07'
  },
  {
    milestoneId: 'M003',
    projectId: 'P001',
    title: '初版评测指标与权重',
    description: 'bob 拒绝：指标权重与分工记录不一致，比例需要重新分配后再提交。',
    fileName: 'metrics-draft.pdf',
    fileHash: '3c81df20a74b6e5c19d0f8a37b2e64c95d18af07e3b6c24019d75a8e94ab7e03',
    contributors: [
      { memberId: 'alice', percentage: 60 },
      { memberId: 'bob', percentage: 20 },
      { memberId: 'charlie', percentage: 20 }
    ],
    confirmations: [
      { memberId: 'bob', decision: 'REJECTED', timestamp: '2026-09-07T02:10:00.000Z' }
    ],
    createdAt: '2026-09-07T01:15:00.000Z',
    status: 'REJECTED',
    txId: '6105d78cbf33b575210dda62272f3232daa2eea5d80d970391df609f1f044da2'
  },
  {
    milestoneId: 'M002',
    projectId: 'P001',
    title: '数据标注规范与 200 条样本',
    description: '标注规范 v1.0，200 条样本双人交叉标注，一致率 0.91。',
    fileName: 'annotation-v1.0.zip',
    fileHash: '84a8d6e4b1c2f30945ac77e0d3915bb27f4e6a18cd90b2e1a3746cf074cbcccf',
    contributors: [
      { memberId: 'alice', percentage: 40 },
      { memberId: 'bob', percentage: 35 },
      { memberId: 'charlie', percentage: 25 }
    ],
    confirmations: [
      { memberId: 'alice', decision: 'CONFIRMED', timestamp: '2026-09-05T02:20:00.000Z' },
      { memberId: 'bob', decision: 'CONFIRMED', timestamp: '2026-09-05T03:02:00.000Z' },
      { memberId: 'charlie', decision: 'CONFIRMED', timestamp: '2026-09-05T05:47:00.000Z' }
    ],
    createdAt: '2026-09-05T02:08:00.000Z',
    status: 'VERIFIED',
    txId: '9ab2108eaed25cebdf0ea9f2ade44b12ddbde54ede41cbf556e5ab0e2ea2e1c7'
  },
  {
    milestoneId: 'M001',
    projectId: 'P001',
    title: '选题报告与分工方案',
    description: '确定选题、评测范围与三人分工，附课程选题表。',
    fileName: 'proposal.pdf',
    fileHash: '1d7e40b9c85a2f316d09be74a1c3820f5e6d94b7a08c1f52e397d6b4f27308ce',
    contributors: [
      { memberId: 'alice', percentage: 48 },
      { memberId: 'bob', percentage: 26 },
      { memberId: 'charlie', percentage: 26 }
    ],
    confirmations: [
      { memberId: 'alice', decision: 'CONFIRMED', timestamp: '2026-09-01T13:45:00.000Z' },
      { memberId: 'bob', decision: 'CONFIRMED', timestamp: '2026-09-01T14:02:00.000Z' },
      { memberId: 'charlie', decision: 'CONFIRMED', timestamp: '2026-09-02T01:19:00.000Z' }
    ],
    createdAt: '2026-09-01T13:40:00.000Z',
    status: 'VERIFIED',
    txId: 'ca9f82ce8b5c8ca65e382d2a60658db8db121f0fc83fa9a39c8c48a9276d4ecf'
  },
  {
    milestoneId: 'M101',
    projectId: 'P002',
    title: '实验一至实验四报告归档',
    description: '四次实验的报告、代码与运行结果，打包存证。',
    fileName: 'labs-1-4.zip',
    fileHash: 'b7419ce0d2385a6f14bc90e73d5a812f6094ce3b7d81a250f6934cb87e10d9a2',
    contributors: [
      { memberId: 'alice', percentage: 34 },
      { memberId: 'bob', percentage: 33 },
      { memberId: 'charlie', percentage: 33 }
    ],
    confirmations: [
      { memberId: 'alice', decision: 'CONFIRMED', timestamp: '2026-08-21T01:00:00.000Z' },
      { memberId: 'bob', decision: 'CONFIRMED', timestamp: '2026-08-21T02:30:00.000Z' },
      { memberId: 'charlie', decision: 'CONFIRMED', timestamp: '2026-08-21T09:12:00.000Z' }
    ],
    createdAt: '2026-08-21T00:40:00.000Z',
    status: 'VERIFIED',
    txId: '7a9182d5b1a371595c5ee049bee9bcaa00ff5b9854e98151a0ca7a86da12ce4c'
  }
]

export const certificates = [
  {
    certificateId: 'CERT-P001-ALICE',
    projectId: 'P001',
    memberId: 'alice',
    contributionPercentage: 44,
    milestoneIds: ['M001', 'M002'],
    issuedAt: '2026-09-06T01:00:00.000Z',
    verificationStatus: 'VALID',
    txId: 'd7c32d24113569621cd9879ea1043962d8d8cf05adcfc0de053e5eb067767252'
  },
  {
    certificateId: 'CERT-P002-BOB',
    projectId: 'P002',
    memberId: 'bob',
    contributionPercentage: 33,
    milestoneIds: ['M101'],
    issuedAt: '2026-08-22T03:00:00.000Z',
    verificationStatus: 'VALID',
    txId: '6900a37590e3c406483871ce0ebf11d7211dd8a51829915669ce1410477451f4'
  }
]
