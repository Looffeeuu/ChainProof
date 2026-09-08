# ChainProof 系统架构

## 1. 总体架构

ChainProof 采用常规 B/S Web 架构，并使用 Hyperledger Fabric 作为可信记录层。

```text
浏览器
  |
  v
Vue 3 前端
  |
  | REST/JSON
  v
Node.js + Express 后端
  |             |
  |             +--> SQLite / 本地文件存储
  |
  +--> Fabric Gateway SDK
            |
            v
     Hyperledger Fabric
            |
            +--> ChainProof Chaincode
```

## 2. 链上 / 链下边界

### 链上保存
用于保存需要防篡改、可追溯的数据：
- 项目标识与核心成员引用
- 里程碑标识
- 文件 SHA-256
- 贡献比例
- 成员确认结果
- 验证状态
- 贡献证明记录
- 区块链交易时间 / 历史记录

### 链下保存
用于保存体积较大、可替换、偏展示或隐私相关的数据：
- 用户上传的原始文件
- 用户头像
- UI 偏好
- Dashboard 缓存统计
- 会话信息

## 3. 前端

技术：Vue 3 + Vite。

计划页面：
- Dashboard
- 项目列表
- 项目详情
- 创建项目
- 提交里程碑
- 贡献确认
- Timeline
- 贡献证明
- 公开验证页面

前端不能直接与 Fabric 通信，所有链上操作都通过后端完成。

## 4. 后端

技术：Node.js + Express。

主要职责：
- 提供 REST API
- 参数校验
- 文件 SHA-256 计算
- 本地文件处理
- Fabric Gateway 连接
- 区块链交易提交 / 查询
- 将 Fabric 错误转换成前端可理解的 API 错误
- 可选使用 SQLite 保存链下数据

建议模块：

```text
backend/src/
├── app.js
├── routes/
├── controllers/
├── services/
│   ├── fabric.service.js
│   ├── hash.service.js
│   └── certificate.service.js
└── config/
```

## 5. 区块链层

技术：Hyperledger Fabric + JavaScript Chaincode。

主要智能合约：`ChainProofContract`。

计划事务函数：
- `CreateProject`
- `GetProject`
- `CreateMilestone`
- `GetMilestone`
- `ConfirmContribution`
- `GetProjectMilestones`
- `GetProjectHistory`
- `IssueCertificate`
- `VerifyCertificate`

课程 MVP 可以直接基于官方本地 Fabric test-network 开发。答辩时可以说明，在真实联盟链场景中，不同组织节点可以代表不同团队、学院、竞赛主办方或验证机构。

## 6. 文件完整性验证模型

上传文件后：

```text
文件内容
   |
   v
SHA-256
   |
   v
64 位十六进制摘要
   |
   v
Fabric 交易
```

原始文件保留在链下。后续验证时重新计算 SHA-256，并与链上记录比对。

## 7. 贡献确认规则

MVP 规则：
- 所有 contributor 的贡献比例之和必须严格等于 100%。
- 所有列出的 contributor 都必须确认。
- 任意成员拒绝后，不允许自动进入已验证状态。
- 所有必要确认完成后，milestone 状态变为 `VERIFIED`。

这个规则故意保持简单，便于完整展示“多人确认 + 区块链存证”的核心逻辑，而不引入复杂治理系统。

## 8. 安全与仓库规范

严禁提交：
- Fabric 私钥
- 自动生成的证书
- 连接秘密配置
- `.env`
- 用户上传文件

需要配置模板时使用 `.env.example`。
