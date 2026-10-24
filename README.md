# ChainProof

> 基于区块链的团队成果与贡献可信存证平台

ChainProof 是“课程综合实践Ⅱ”的“区块链技术应用实践”大作业项目。项目用于记录团队协作过程中的关键里程碑、文件哈希、贡献比例、成员确认结果以及最终贡献证明，并通过 Hyperledger Fabric 提供可追溯、难篡改的可信记录。

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
│   ├── TEAM_WORKFLOW.md      # 三人协作规范
│   ├── PROJECT_REPORT.md     # 项目介绍（最终交付）
│   ├── CONTRIBUTIONS.md      # 团队贡献记录（Issue / PR 追溯）
│   ├── TEAM_SCORES.md        # 组内成员任务分工与贡献打分
│   ├── DEMO_SCRIPT.md        # 现场演示 / 讲解视频脚本与彩排记录
│   └── defense/              # 答辩 PPT、Word 版文档、截图与生成脚本
├── scripts/
│   └── package-delivery.sh   # 敏感信息检查 + 最终交付打包
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

✅ MVP 功能（FR-01 ~ FR-10）全部完成，并在真实 Fabric 网络上通过冒烟、契约检查与 Demo 重置验收。当前处于课程交付阶段（Issue #7）。

- 项目介绍：[docs/PROJECT_REPORT.md](docs/PROJECT_REPORT.md)
- 团队贡献记录：[docs/CONTRIBUTIONS.md](docs/CONTRIBUTIONS.md)
- 成员分工与贡献打分：[docs/TEAM_SCORES.md](docs/TEAM_SCORES.md)
- 演示脚本（现场版 / 讲解视频版）：[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
- 答辩 PPT：[docs/defense/ChainProof-答辩.pptx](docs/defense/ChainProof-答辩.pptx)
- Word 版：[项目介绍](docs/defense/ChainProof-项目介绍.docx) · [成员分工与贡献打分](docs/defense/ChainProof-成员分工与贡献打分.docx)
- 交付打包：`bash scripts/package-delivery.sh`（每位组员各一份，截止 10-31 23:59 上传学在浙大）

## Demo 演示

答辩前可一键重置环境并写入演示数据，覆盖完整答辩故事线。

### 前置条件

- Docker Desktop 已启动
- WSL2 已安装（Windows）或原生 Linux
- Node.js >= 18, npm >= 9
- Fabric 镜像和二进制已下载（首次使用需运行 `blockchain/network/chainproof-network.sh setup`）

### 一键重置（推荐）

从仓库根目录执行：

```bash
cd blockchain/chaincode && npm install   # 首次安装依赖
cd ../../backend && npm install          # 首次安装依赖
npm run demo:reset                       # 一键重置 + 写入 Demo 数据
```

此命令会：
1. 关闭旧 Fabric 网络并清理本地账本
2. 启动新网络并部署最新链码
3. 启动 Backend 服务
4. 写入 Demo 演示数据

预计耗时 3-5 分钟。

### 仅写入数据

如果网络和 Backend 已就绪，可直接执行 seed：

```bash
cd backend
npm run demo:seed
```

### Demo 数据内容

写入 3 个项目、6 个里程碑、2 张证书：

| 项目 | 里程碑 | 状态 | 说明 |
|------|--------|------|------|
| P001 VLA 安全性基准测试 | M001 选题报告与分工方案 | VERIFIED | alice 提交，bob + charlie 确认 |
| | M002 数据标注规范与 200 条样本 | VERIFIED | bob 提交，alice + charlie 确认 |
| | M003 初版评测指标与权重 | REJECTED | alice 提交，bob 拒绝 |
| | M004 基准测试集 v0.3 与评测脚本 | PENDING | alice 提交，bob 确认，charlie 未确认 |
| P002 课程实验报告归档 | M101 实验一至实验四报告归档 | VERIFIED | bob 提交，alice + charlie 确认 |
| P003 答辩演示脚本 | M301 答辩演示脚本初稿 | VERIFIED | alice 提交，charlie 确认但贡献 0% |

证书：
- alice @ P001，贡献 44%
- bob @ P002，贡献 33%

证书 ID 由后端运行时生成；`npm run demo:seed` 完成后会输出两张证书的实际 ID 和可直接访问的页面路径。

NOT_FOUND 演示 ID：`CP-DEMO-NOT-FOUND`

### 前端入口

启动 Frontend 后访问：

```bash
cd frontend && npm run dev
```

- Dashboard → http://localhost:5173/
- 项目详情 → http://localhost:5173/projects/P001
- 里程碑确认（PENDING）→ http://localhost:5173/milestones/M004
- 贡献证书 → 使用 seed 输出的 `/certificates/<certificateId>`
- 公开验证 → 使用 seed 输出的 `/verify/<certificateId>`
- 公开验证 404 → http://localhost:5173/verify/CP-DEMO-NOT-FOUND
