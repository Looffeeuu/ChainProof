# ChainProof 团队协作规范

## 三人分工

ChainProof 按三人小组设计，每个人负责一条主线，同时需要参与整体集成与互相 review。

### A：前端 / 产品
主要负责：
- Vue 页面与组件
- 响应式布局
- Dashboard 与 Timeline
- Certificate 与验证页面
- 最终 Demo 的视觉打磨

### B：区块链 / 智能合约
主要负责：
- Fabric test-network 搭建
- Chaincode 数据模型与交易逻辑
- 账本历史查询
- 合约测试
- 部署说明文档

### C：后端 / 集成
主要负责：
- Express REST API
- SHA-256 文件哈希
- 文件上传处理
- Fabric Gateway 连接
- 错误处理
- 前后端联调

## 分支命名

每个 Issue 使用独立分支：

```text
feat/1-fabric-network
feat/2-chaincode-core
feat/3-backend-foundation
feat/4-frontend-foundation
fix/<issue>-short-description
docs/<issue>-short-description
```

## Pull Request 规则

- 团队正式开发开始后，功能代码不要直接 push 到 `main`。
- 每个 PR 必须关联对应 GitHub Issue。
- PR 尽量保持小而清晰，目标是 10 分钟左右可以 review 完。
- 涉及集成逻辑的 PR，至少让另一位成员检查一次。
- 建议使用 squash merge，保持课程项目提交历史清晰。

## Definition of Done

一个 Issue 只有满足以下条件才算完成：
- 代码已经提交；
- 验收条件已经手动或自动检查；
- 必要的配置和说明文档已经同步更新；
- 没有提交私钥、Fabric 生成证书或其他敏感文件；
- 在合理情况下，相关 Demo 流程可以从干净环境重新跑通。

## 每周协作节奏

每周建议：
1. 先确认本周每个 Issue 的验收标准。
2. 三个人分别推进自己的主任务。
3. 周末前完成联调，而不是等到最后一周。
4. 遇到 blocker 直接记录在 Issue 中，不只留在微信群或私聊里。
5. 最后一周只做修复、打磨和交付，原则上不再加大功能。

## 控制项目范围

除非 MVP 已经全部完成，否则不要新增：
- Token
- NFT
- 支付
- 跨链
- AI 自动贡献评分
- 复杂争议仲裁

这个项目拿高分的关键是“完整、实用、好看、能稳定演示”，不是堆功能。
