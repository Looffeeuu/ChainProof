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

## 3. 核心数据实体

### Project
- projectId
- name
- description
- ownerId
- members[]
- createdAt
- status

### Milestone
- milestoneId
- projectId
- title
- description
- fileName
- fileHash
- contributors[]
- confirmations[]
- createdAt
- status

### Contributor record
- memberId
- percentage

### Confirmation record
- memberId
- decision: CONFIRMED | REJECTED
- timestamp

### Certificate
- certificateId
- projectId
- memberId
- contributionPercentage
- milestoneIds[]
- issuedAt
- verificationStatus

## 4. 功能需求

### FR-01 创建项目
用户可以填写项目名称、项目描述和团队成员来创建项目。

### FR-02 提交里程碑
用户可以向指定项目提交一个里程碑。

### FR-03 文件哈希
后端对上传文件计算 SHA-256。文件本体保留在链下，不直接写入区块链。

### FR-04 贡献比例声明
里程碑提交者需要为参与成员分配贡献比例，总和必须等于 100%。

### FR-05 成员确认
相关成员可以确认或拒绝该贡献声明。

### FR-06 验证状态
当预设的确认规则满足时，里程碑状态变为 `VERIFIED`。

课程 MVP 默认采用：所有被列为 contributor 的成员都必须确认。

### FR-07 项目时间线
用户可以按时间顺序查看项目里程碑及其链上验证状态。

### FR-08 贡献统计面板
用户可以查看成员累计贡献比例、参与里程碑数量等统计信息。

### FR-09 贡献证明生成
项目满足验证条件后，可以为成员生成个人贡献证明。

### FR-10 贡献证明验证
外部验证者可以输入 certificateId，验证其对应的链上记录。

## 5. 非功能需求

- 采用浏览器可访问的 B/S 架构。
- 界面需要具备基本响应式能力和一致的视觉风格。
- 核心演示流程不能依赖手工修改链上数据。
- 关键区块链交易必须提供清楚的成功/失败反馈。
- 不得提交生成的私钥、证书、秘密配置等敏感文件。
- 开发环境应能够通过文档中的命令被其他组员复现。

## 6. MVP 暂不实现

- 加密货币或 Token 激励
- NFT
- 支付功能
- 跨链互操作
- 实名身份认证
- 生产级联盟链治理
- 复杂争议仲裁
- AI 自动评估贡献

## 7. Demo 成功标准

7 分钟左右的演示应能完成：

1. 创建一个项目。
2. 提交一个里程碑并上传文件。
3. 展示系统计算得到的 SHA-256。
4. 为成员分配贡献比例。
5. 不同成员完成贡献确认。
6. 展示该里程碑状态变为 `VERIFIED`。
7. 查看项目 Timeline 和 Contribution Dashboard。
8. 打开贡献证明验证页面并得到有效结果。
