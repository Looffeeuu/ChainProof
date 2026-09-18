# ChainProof MVP 需求文档

## 1. 产品目标

ChainProof 为项目团队提供一种可信方式，用于记录项目里程碑、贡献声明、成员确认结果以及最终贡献证明。

MVP 的目标是在一次简短的课堂演示中，完整展示“创建项目 → 提交成果 → 声明贡献 → 多人确认 → 链上验证 → 生成证明”的闭环。

## 2. 用户角色

### 项目负责人
- 创建项目。
- 添加团队成员。
- 提交或查看项目里程碑。

### 团队成员
- 查看自己参与的项目。
- 查看贡献声明。
- 对贡献声明进行确认或拒绝。

### 外部验证者
- 通过贡献证明 ID 打开公开验证页面。
- 检查该证明是否存在，并核对是否与链上记录一致。

> MVP 不实现正式登录系统。前端提供演示身份切换器（如 alice / bob / charlie），请求通过 `X-Member-Id` Header 传递当前演示成员身份。

## 3. 核心数据实体

### Project
- projectId
- name
- description
- ownerId
- members[]
- createdAt
- status: `ACTIVE`

### Milestone
- milestoneId
- projectId
- title
- description
- fileName
- fileHash：64 位小写十六进制 SHA-256
- contributors[]
- confirmations[]
- createdAt
- status: `PENDING_CONFIRMATION | VERIFIED | REJECTED`
- txId：当前状态对应的最近一次关键 Fabric 交易 ID

### Contributor record
- memberId
- percentage：整数；同一里程碑总和必须严格等于 100

### Confirmation record
- memberId
- decision: `CONFIRMED | REJECTED`
- timestamp

### Certificate
- certificateId
- projectId
- memberId
- contributionPercentage
- milestoneIds[]
- issuedAt
- verificationStatus
- txId

## 4. 功能需求

### FR-01 创建项目
用户可以填写项目名称、项目描述和团队成员来创建项目。

### FR-02 提交里程碑
用户可以向指定项目提交一个里程碑，并上传对应成果文件。

### FR-03 文件哈希与链下托管
MVP 采用“链下托管 + 前后端双算 SHA-256”的方案：

1. 浏览器在用户选择文件后先对文件原始字节流计算 SHA-256，并显示给用户。
2. 前端上传原始文件，同时提交 `clientFileHash`。
3. 后端对收到的原始文件独立计算 SHA-256。
4. 两端摘要一致才继续；不一致返回 `FILE_HASH_MISMATCH`。
5. 写入 Fabric 的 `fileHash` 以服务端计算结果为准。
6. 原始文件仅保存在链下，不直接写入区块链。
7. 验证/确认页面可以在浏览器本地重新计算用户手中副本的 SHA-256，与存证摘要比对。

哈希统一针对文件原始字节流；文件名、文件大小、修改时间和 multipart 编码本身均不参与摘要计算。

### FR-04 贡献比例声明
里程碑提交者需要为参与成员分配整数贡献比例，总和必须等于 100%。

### FR-05 成员确认
相关 contributor 可以确认或拒绝贡献声明。成员一旦表态，MVP 中不得撤回或改票。

### FR-06 验证状态
- 初始状态：`PENDING_CONFIRMATION`
- 所有列出的 contributor 均确认后：`VERIFIED`
- 任意 contributor 拒绝后：立即变为 `REJECTED`
- `VERIFIED` / `REJECTED` 视为关闭状态，不再接受新的表态

### FR-07 项目时间线
用户可以按 `createdAt` 正序查看项目里程碑及其链上验证状态。已发生关键链上交易的记录应展示 `txId`，便于答辩时证明记录确实经过 Fabric 交易。

### FR-08 贡献统计面板
用户可以查看成员累计贡献比例、参与里程碑数量等统计信息。累计比例只基于 `VERIFIED` 里程碑，并返回 `basedOnMilestones` 表示统计依据的已验证里程碑数量。

每条已验证里程碑权重相同。成员累计比例等于其在全部已验证里程碑中的 percentage 总和除以已验证里程碑数量；未参与某条里程碑时按 0 计算。最终使用最大余数法生成总和严格为 100 的整数结果，余数相同时按 `memberId` 升序分配。结果包含项目全部成员，包括 0% 成员，并按 `memberId` 升序排列；没有已验证里程碑时全员为 0。

### FR-09 贡献证明生成
满足以下条件时可以为成员生成贡献证明：
- 该成员属于项目；
- 项目至少存在 1 条 `VERIFIED` 里程碑；
- 该成员累计 `contributionPercentage` 大于 0。

0% 成员仍显示在 Contribution Dashboard 中，但不签发贡献证明。证明中的 `milestoneIds` 只包含该成员实际参与（contributors 中 `percentage > 0`）的 `VERIFIED` milestone ID，并按 `createdAt`、`milestoneId` 正序排列。

同一 `projectId + memberId` 重复请求生成时，返回已有证明，不重复签发新的 certificateId。

### FR-10 贡献证明验证
外部验证者可以输入 certificateId，验证其对应记录。证书不存在时属于有效验证结果，应返回 `verificationStatus: NOT_FOUND`，而不是通用 404 错误。

## 5. 非功能需求

- 采用浏览器可访问的 B/S 架构。
- 界面需要具备基本响应式能力和一致的视觉风格。
- 核心演示流程不能依赖手工修改链上数据。
- 关键区块链交易必须提供清楚的成功/失败反馈，并尽量返回可展示的 `txId`。
- API 业务错误使用正确的 4xx 状态码；错误 `code` 使用英文，`message` 使用可直接展示给用户的中文说明。
- 不得提交生成的私钥、证书、秘密配置或用户上传文件。
- 开发环境应能够通过文档中的命令被其他组员复现。

## 6. MVP 暂不实现

- 加密货币或 Token 激励
- NFT
- 支付功能
- 跨链互操作
- 正式实名登录 / OAuth / JWT 身份系统
- 生产级联盟链治理
- 复杂争议仲裁
- AI 自动评估贡献

## 7. Demo 成功标准

7 分钟左右的演示应能完成：

1. 切换当前演示身份并创建一个项目。
2. 提交一个里程碑并上传文件。
3. 展示浏览器本地 SHA-256，并由后端独立复算通过。
4. 为成员分配贡献比例。
5. 不同成员分别完成贡献确认。
6. 展示该里程碑状态变为 `VERIFIED`，并能看到对应链上交易 ID。
7. 查看项目 Timeline 和 Contribution Dashboard。
8. 为成员生成贡献证明。
9. 打开公开验证页面并得到 `VALID`；对不存在的 ID 得到 `NOT_FOUND`。

