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
  "status": "ACTIVE",
  "txId": "46a1aa73018e30521f1a6ebb6698e4bf671c3a8b2425b6399de2047e0fd389c8"
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
    "status": "ACTIVE",
    "txId": "46a1aa73018e30521f1a6ebb6698e4bf671c3a8b2425b6399de2047e0fd389c8"
  }
]
```

MVP 中若 Header 缺失，可以返回全部演示项目；前端会把这种情况视为降级模式。

Project 的 `txId` 是创建该项目的 Fabric 交易 ID（64 位小写十六进制）；旧数据或纯演示数据可以没有此字段。链码内部的 `docType` 不属于 REST 响应，不得返回给前端。

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

返回该项目链上历史记录，按 Fabric 返回顺序排列：

```json
[
  {
    "txId": "46a1aa73018e30521f1a6ebb6698e4bf671c3a8b2425b6399de2047e0fd389c8",
    "timestamp": "2026-09-11T10:00:00.000Z",
    "isDelete": false,
    "value": {
      "projectId": "P001",
      "name": "ChainProof Demo",
      "description": "课程演示项目",
      "ownerId": "alice",
      "members": ["alice", "bob", "charlie"],
      "createdAt": "2026-09-11T10:00:00.000Z",
      "status": "ACTIVE",
      "txId": "46a1aa73018e30521f1a6ebb6698e4bf671c3a8b2425b6399de2047e0fd389c8"
    }
  }
]
```

`value` 不返回链码内部的 `docType`；删除记录的 `value` 可以为 `null`。

---

## 3. Milestones

### POST `/projects/:projectId/milestones`

使用 `multipart/form-data`。

请求必须携带 `X-Member-Id`。该值是本次里程碑的 `submitterId`，不从 body 读取。提交者必须属于项目；项目至少需要 2 名不同成员，才能形成独立确认关系。

字段：

- `title`
- `description`
- `contributors`：JSON 字符串
- `file`：原始文件
- `clientFileHash`：浏览器计算的 64 位小写 SHA-256

流程：

1. 后端要求并读取 `X-Member-Id`，作为 `submitterId` 提交 Fabric。
2. 后端对上传文件原始字节独立计算 SHA-256。
3. 与 `clientFileHash` 比对。
4. 不一致：HTTP 400 + `FILE_HASH_MISMATCH`。
5. 一致：以后端计算值作为权威 `fileHash`，提交 Fabric，并将原始文件保留在链下。
6. Chaincode 保存 `requiredConfirmerIds` 快照：创建时项目全部成员中除 `submitterId` 外的人，按 UTF-8 无符号字节序升序排列。后续确认资格只读取这份快照。

返回：新建后的完整 `Milestone`。

### GET `/milestones/:milestoneId`

返回完整 `Milestone`。

### GET `/milestones/:milestoneId/file`

返回链下托管的原始文件，`Content-Disposition` 使用链上 `fileName`。链上存在里程碑但本地文件缺失时返回 HTTP 404 + `FILE_NOT_FOUND`。

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
- 提交者不能确认或拒绝自己提交的里程碑。
- 只有 `requiredConfirmerIds` 中的成员可以表态；确认资格与该成员是否出现在 contributors 中无关。
- 全部 required confirmer 确认 → `VERIFIED`
- 任意 required confirmer 拒绝 → 立即 `REJECTED`
- 同一成员不得重复表态
- `VERIFIED` / `REJECTED` 后不得继续表态

---

## 4. Dashboard

### GET `/projects/:projectId/contributions`

只基于 `VERIFIED` milestones 统计，并把每条已验证里程碑视为等权重样本。

固定算法：

1. `basedOnMilestones = N`，其中 `N` 是项目中 `VERIFIED` milestone 的数量。
2. 对项目中的每个成员，把该成员在全部 `VERIFIED` milestones 中的 `percentage` 相加；未出现在某条 milestone 的成员在该条记录中按 `0` 计算。
3. 对每个项目成员计算整数 `sum`：其在全部 `VERIFIED` milestones 中的 `percentage` 之和；未参与某条时该条计 0。每条 milestone 的比例总和均为 100，因此所有成员的 `sum` 总和为 `100 × N`。
4. 当 `N > 0` 时，仅用整数运算计算 `floor = sum div N`、`remainder = sum mod N`（`div` 为整数除法，`mod` 为整数取余）；精确比例在数学上为 `sum / N`，实现不得用浮点除法或浮点余数比较。
5. 先给每位成员分配 `floor`，再计算 `remaining = 100 - Σfloor`；按 `remainder` 降序，余数相同按 `memberId` 的 UTF-8 无符号字节序升序，给前 `remaining` 位各加 1。最终 `members[].percentage` 均为整数且总和严格等于 100。
6. `members` 必须包含项目全部成员；没有参与任何已验证 milestone 的成员返回 `percentage: 0`。返回数组也按 `memberId` 的 UTF-8 无符号字节序升序排列。比较规则固定，不使用 `localeCompare()` 或依赖运行环境的本地化排序。

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

签发按以下顺序处理：

1. 先按 `projectId + memberId` 查询已有 Certificate；若存在，直接返回原证书，不重新检查成员资格、已验证里程碑数量或累计比例，也不生成新的 `certificateId`。
2. 若尚无证书，检查成员属于该项目。
3. 若项目没有 `VERIFIED` milestone，返回 HTTP 409 + `NO_VERIFIED_CONTRIBUTION`。
4. 按上述最大余数法完成全部成员的整数分配后，以 Dashboard 返回的最终 `members[].percentage` 作为该成员的 `contributionPercentage`。若最终值为 `0`，同样返回 HTTP 409 + `NO_VERIFIED_CONTRIBUTION`；只有最终值大于 `0` 才签发。

两种 `NO_VERIFIED_CONTRIBUTION` 情况的中文 `message` 统一为「累计贡献比例为 0%，不能签发证书。」0% 成员仍显示在 Contribution Dashboard 中。判断不得使用取整前的精确比例；例如成员实际参与了某条 milestone，但最终分配结果为 0%，仍不能签发。

`milestoneIds` 只保存该成员实际参与的 `VERIFIED` milestone ID：即该成员在该 milestone 的 contributors 中且 `percentage > 0`。数组按 milestone 的 `createdAt` 正序排列，时间相同时按 `milestoneId` 升序排列。Dashboard 的 `basedOnMilestones` 是项目全部 `VERIFIED` milestone 数量；`Certificate.milestoneIds.length` 只统计该成员实际参与的数量，二者不要求相等。

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
- `txId: string`（可选；存在时为创建项目的 Fabric 交易 ID，64 位小写十六进制）

### Milestone
- `milestoneId: string`
- `projectId: string`
- `title: string`
- `description: string`
- `fileName: string`
- `fileHash: string`（64 位小写 hex）
- `submitterId: string`
- `requiredConfirmerIds: string[]`（创建时除提交者外的项目成员快照，UTF-8 无符号字节序升序）
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
- `milestoneIds: string[]`（该成员实际参与且 `percentage > 0` 的 VERIFIED milestone ID 快照；长度不要求等于 Dashboard 的 `basedOnMilestones`）
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
| `MEMBER_NOT_IN_CLAIM` | 403 | 当前成员不属于需要成员资格的业务对象（保留给既有接口） |
| `SUBMITTER_CANNOT_CONFIRM` | 403 | 里程碑提交者尝试确认或拒绝自己的提交 |
| `MEMBER_NOT_REVIEWER` | 403 | 当前成员不在该里程碑的 requiredConfirmerIds 快照中 |
| `ALREADY_DECIDED` | 409 | 当前成员已经表态 |
| `MILESTONE_CLOSED` | 409 | milestone 已 VERIFIED / REJECTED |
| `FILE_HASH_MISMATCH` | 400 | 前后端文件哈希不一致 |
| `NO_VERIFIED_CONTRIBUTION` | 409 | 无 VERIFIED milestone，或最终整数累计贡献为 0；message：累计贡献比例为 0%，不能签发证书。 |
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
