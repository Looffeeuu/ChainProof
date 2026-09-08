# ChainProof

> 基于区块链的团队成果与贡献可信存证平台

ChainProof 是“区块链技术应用实践”课程大作业项目。项目用于记录团队协作过程中的关键里程碑、文件哈希、贡献比例、成员确认结果以及最终贡献证明，并通过 Hyperledger Fabric 提供可追溯、难篡改的可信记录。

## 为什么做 ChainProof？

团队项目中经常会出现“谁做了什么”“成果什么时候完成”“贡献比例是否被后续修改”等争议。ChainProof 将关键证据写入 Hyperledger Fabric，使已经确认的项目里程碑可以被追溯和独立验证。

## 核心业务流程

1. 创建项目并登记团队成员。
2. 提交项目里程碑，包括说明和成果文件。
3. 后端计算文件 SHA-256，并只将哈希写入链上。
4. 提交该里程碑的成员贡献比例。
5. 相关成员确认或拒绝贡献声明。
6. 满足确认规则后，里程碑状态变为链上已验证 `VERIFIED`。
7. 系统展示项目时间线和贡献统计面板。
8. 项目完成后生成可验证的个人贡献证明。

## MVP 功能范围

- 项目创建与成员管理
- 项目里程碑提交
- 文件 SHA-256 计算
- 贡献比例声明
- 多成员确认
- Hyperledger Fabric 链上存证
- 项目时间线
- 贡献统计面板
- 贡献证明生成与验证页面

## 技术栈

- **前端：** Vue 3 + Vite
- **后端：** Node.js + Express
- **区块链：** Hyperledger Fabric + JavaScript Chaincode
- **数据库：** SQLite，用于链下应用数据
- **链上集成：** Fabric Gateway SDK

## 仓库结构

```text
ChainProof/
├── frontend/                 # Vue 前端
├── backend/                  # Express API + Fabric Gateway 集成
├── blockchain/
│   ├── chaincode/            # Fabric 智能合约
│   └── network/              # 本地 Fabric 网络说明与配置
├── docs/
│   ├── REQUIREMENTS.md       # MVP 需求
│   ├── ARCHITECTURE.md       # 系统架构
│   ├── API.md                # REST API 约定
│   └── TEAM_WORKFLOW.md      # 三人协作规范
├── .gitignore
└── README.md
```

## 四周开发计划

### Week 1：基础搭建
- 本地跑通 Fabric test-network
- 明确链上数据模型
- 完成 Project / Milestone 基础 Chaincode
- 搭建前端与后端基础工程

### Week 2：核心业务闭环
- 文件上传与 SHA-256
- 贡献比例声明
- 成员确认 / 拒绝
- Express ↔ Fabric Gateway 集成

### Week 3：产品展示层
- Dashboard
- Timeline
- 贡献可视化
- 贡献证明生成与验证

### Week 4：交付准备
- 集成测试与 Bug 修复
- Demo 数据与 UI 打磨
- PPT、项目介绍文档、演示视频

## 开发原则

区块链只存放真正需要“防篡改、可追溯、多人共同确认”的关键数据。大文件、头像、界面状态和可替换的应用数据保留在链下。

## 当前状态

🚧 项目基础骨架已建立，进入 Week 1 开发阶段。
