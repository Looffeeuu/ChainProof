# ChainProof REST API 契约

Base URL：`/api`

本文档是 A（前端）、B（Chaincode）、C（后端）联调时的统一契约。除非通过 Issue 明确变更，否则不要单方面修改字段名、枚举或返回结构。

## 0. 通用约定

### 当前演示身份

MVP 不实现正式登录。需要当前成员身份的请求统一通过 Header：

```http
X-Member-Id: alice
```

前端的演示身份切换器负责设置该 Header。

### 返回结构

成功时直接返回业务实体或数组，**不要额外包一层 `{ data: ... }`**。

例如：

```json
{
  "projectId": "P001",
  "name": "ChainProof Demo",
  "description": "课程演示项目",
  "ownerId": "alice",
  "members": ["alice", "bob", "charlie"],
  "createdAt": "2026-09-11T10:00:00.000Z",
  "status": "ACTIVE"
}
```

### ID / 时间 / 百分比

- ID 一律作为不透明字符串处理。
- 时间统一 ISO 8601。
- `percentage` 使用整数。
- 同一 milestone 的 contributor 百分比总和必须严格等于 100。

## 1. Health

### GET `/health`

返回后端状态。

---

## 2. Projects

### GET `/projects`

返回当前 `X-Member-Id` 可查看的项目：

```json
[
  {
    "projectId": "P001",
    "name": "ChainProof Demo",
    "description": "课程演示项目",
    "ownerId": "alice",
    "members": ["alice", "bob", "charlie"],
    "createdAt": "2026-09-11T10:00:00.000Z",
    "status": "ACTIVE"
  }
]
```

MVP 中若 Header 缺失，可以返回全部演示项目；前端会把这种情况视为降级模式。

### POST `/projects`

创建项目。

请求：

```json
{
  "name": "ChainProof Demo",
  "description": "课程演示项目",
  "members": ["alice", "bob", "charlie"]
}
```

`ownerId` 默认取 `X-Member-Id`。为兼容调试，也允许 body 显式传 `ownerId`，但 Header 存在时以 Header 为准。

返回：新建后的完整 `Project`。

### GET `/projects/:projectId`

返回完整 `Project`。

### GET `/projects/:projectId/milestones`

返回该项目 `Milestone[]`，按 `createdAt` 正序。

### GET `/projects/:projectId/history`

返回该项目链上历史记录。该接口不阻塞第一阶段前端联调。

---

## 3. Milestones

### POST `/projects/:projectId/milestones`

使用 `multipart/form-data`。

字段：

- `title`
- `description`
- `contributors`：JSON 字符串
- `file`：原始文件
- `clientFileHash`：浏览器计算的 64 位小写 SHA-256

流程：

1. 后端对上传文件原始字节独立计算 SHA-256。
2. 与 `clientFileHash` 比对。
3. 不一致：HTTP 400 + `FILE_HASH_MISMATCH`。
4. 一致：以后端计算值作为权威 `fileHash`，提交 Fabric，并将原始文件保留在链下。

返回：新建后的完整 `Milestone`。

### GET `/milestones/:milestoneId`

返回完整 `Milestone`。

### POST `/milestones/:milestoneId/confirmations`

当前成员由 `X-Member-Id` 决定。

请求：

```json
{
  "decision": "CONFIRMED"
}
```

`decision` 只能是：
- `CONFIRMED`
- `REJECTED`

成功返回：**更新后的完整 `Milestone`**，包括新的 `confirmations`、`status`、`txId`。

状态规则：
- 全部 contributor 确认 → `VERIFIED`
- 任意 contributor 拒绝 → 立即 `REJECTED`
- 同一成员不得重复表态
- `VERIFIED` / `REJECTED` 后不得继续表态

---

## 4. Dashboard

### GET `/projects/:projectId/contributions`

只基于 `VERIFIED` milestones 统计，并把每条已验证里程碑视为等权重样本。

固定算法：

1. `basedOnMilestones = N`，其中 `N` 是项目中 `VERIFIED` milestone 的数量。
2. 对项目中的每个成员，把该成员在全部 `VERIFIED` milestones 中的 `percentage` 相加；未出现在某条 milestone 的成员在该条记录中按 `0` 计算。
3. 精确累计比例为 `sum(member percentages) / N`。由于每条 milestone 的比例总和都是 100，所有成员的精确累计比例总和也必然是 100。
4. API 只返回整数，因此使用最大余数法取整到总和严格等于 100；小数余数相同时按 `memberId` 升序分配，保证 Fabric 背书节点结果确定。
5. `members` 必须包含项目的全部成员；没有参与任何已验证 milestone 的成员返回 `percentage: 0`。返回数组按 `memberId` 升序排列。

项目尚无 `VERIFIED` milestone 时，返回全部项目成员且比例均为 `0`，同时 `basedOnMilestones: 0`。

例如 M1 只有 alice 且为 100%，M2 只有 bob 且为 100%，两条都验证通过时，最终结果是 alice 50%、bob 50%，不是 100% + 100%。

```json
{
  "projectId": "P001",
  "members": [
    { "memberId": "alice", "percentage": 42 },
    { "memberId": "bob", "percentage": 31 },
    { "memberId": "charlie", "percentage": 27 }
  ],
  "basedOnMilestones": 3
}
```

---

## 5. Certificates

### GET `/certificates?projectId=&memberId=`

两个 query 参数都可选。

返回：`Certificate[]`。

### POST `/projects/:projectId/certificates`

请求：

```json
{
  "memberId": "alice"
}
```

生成条件：
- member 属于该项目；
- 项目至少有 1 条 `VERIFIED` milestone；
- 该成员的累计 `contributionPercentage` 必须大于 `0`。

0% 成员仍必须显示在 Contribution Dashboard 中，但不能生成证书；后端返回 HTTP 409 + `NO_VERIFIED_CONTRIBUTION`。

`milestoneIds` 只保存该成员实际参与的 `VERIFIED` milestone ID：即该成员在该 milestone 的 contributors 中且 `percentage > 0`。数组按 milestone 的 `createdAt` 正序排列，时间相同时按 `milestoneId` 升序排列。

同一 `projectId + memberId` 重复生成时返回已有证书，不重复产生新的 certificateId。

返回完整 `Certificate`。

### GET `/certificates/:certificateId`

返回完整 `Certificate`。

### GET `/verify/:certificateId`

公开验证接口。

证书存在时示例：

```json
{
  "certificateId": "CP-001",
  "verificationStatus": "VALID",
  "certificate": {
    "certificateId": "CP-001",
    "projectId": "P001",
    "memberId": "alice",
    "contributionPercentage": 42,
    "milestoneIds": ["M001", "M002"],
    "issuedAt": "2026-09-11T10:00:00.000Z",
    "verificationStatus": "VALID",
    "txId": "8f3a1c9e..."
  }
}
```

证书不存在时不是接口错误，返回 HTTP 200：

```json
{
  "certificateId": "CP-NOT-FOUND",
  "verificationStatus": "NOT_FOUND"
}
```

---

## 6. 关键实体字段

### Project
- `projectId: string`
- `name: string`
- `description: string`
- `ownerId: string`
- `members: string[]`
- `createdAt: ISO 8601 string`
- `status: ACTIVE`

### Milestone
- `milestoneId: string`
- `projectId: string`
- `title: string`
- `description: string`
- `fileName: string`
- `fileHash: string`（64 位小写 hex）
- `contributors: {memberId, percentage}[]`
- `confirmations: {memberId, decision, timestamp}[]`
- `createdAt: ISO 8601 string`
- `status: PENDING_CONFIRMATION | VERIFIED | REJECTED`
- `txId: string`

### Certificate
- `certificateId: string`
- `projectId: string`
- `memberId: string`
- `contributionPercentage: number`
- `milestoneIds: string[]`（该成员实际参与的 VERIFIED milestone ID 快照）
- `issuedAt: ISO 8601 string`
- `verificationStatus: string`
- `txId: string`

---

## 7. 错误返回

统一格式：

```json
{
  "error": {
    "code": "CONTRIBUTION_TOTAL_INVALID",
    "message": "贡献比例总和是 97%，必须正好是 100%。"
  }
}
```

约定：
- `code` 英文，供前端分支判断。
- `message` 中文，前端会直接展示。
- 业务失败使用正确 4xx，不返回 200 假成功。

至少支持：

| code | HTTP | 场景 |
|---|---:|---|
| `PROJECT_NOT_FOUND` | 404 | 项目不存在 |
| `MILESTONE_NOT_FOUND` | 404 | 里程碑不存在 |
| `CERTIFICATE_NOT_FOUND` | 404 | 非 verify 场景查询证书不存在 |
| `CONTRIBUTION_TOTAL_INVALID` | 400 | 比例总和不是 100 |
| `MEMBER_NOT_IN_CLAIM` | 403 | 当前成员不是 contributor |
| `ALREADY_DECIDED` | 409 | 当前成员已经表态 |
| `MILESTONE_CLOSED` | 409 | milestone 已 VERIFIED / REJECTED |
| `FILE_HASH_MISMATCH` | 400 | 前后端文件哈希不一致 |
| `NO_VERIFIED_CONTRIBUTION` | 409 | 成员累计已验证贡献为 0，不能签发证书 |
| `VALIDATION_ERROR` | 400 | 普通参数校验失败 |
| `INTERNAL_ERROR` | 500 | 未分类服务端错误 |

## 8. 联调顺序

前端采用“一个接口一个开关”逐步从 mock 切换：

1. `GET /projects`
2. `POST /projects`
3. `GET /projects/:id`
4. `GET /projects/:id/milestones`
5. `POST /projects/:id/milestones`
6. `GET /milestones/:id`
7. `POST /milestones/:id/confirmations`
8. `GET /projects/:id/contributions`
9. Certificate / verify 系列

BC 每完成一个接口就通知 A，不需要等待整套后端全部完成。

