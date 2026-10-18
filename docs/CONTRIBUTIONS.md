# ChainProof 团队贡献记录

> 组名：ChainProof。依据：GitHub Issue、Pull Request、Review 与提交记录（截至 2026-10-18）。
> 仓库使用 squash merge，合并提交的作者显示为合并人，因此**以 PR 作者和 Review 记录为准**，提交数只作参考。

## 成员与分工

| 成员 | GitHub | 角色 | 主线 |
|---|---|---|---|
| 杨宇 | @Darioyy | A | 前端 / 产品 |
| 黄铭谦 | @Hmq901 | B | 区块链 / 智能合约 |
| 全书阅（组长） | @Looffeeuu | C | 后端 / 集成，兼项目统筹 |

## A 杨宇：前端 / 产品（@Darioyy）

**作者 PR**

| PR | 内容 | 规模 |
|---|---|---|
| [#13](https://github.com/Looffeeuu/ChainProof/pull/13) | 前端首次入库：9 个页面、组件库、Mock 数据、暗色模式、自检脚本，并按 PR #9 对齐贡献与证书规则 | +13856 / −105，100 个文件 |
| [#16](https://github.com/Looffeeuu/ChainProof/pull/16) | check:flows 零贡献场景改为条件等待，修复首次运行假失败 | +145 / −31 |
| [#20](https://github.com/Looffeeuu/ChainProof/pull/20) | 界面文案系统清理 | +28 / −31，12 个文件 |
| [#29](https://github.com/Looffeeuu/ChainProof/pull/29) | 确认页下载原文件并接上浏览器本地哈希核验 | +414 / −124 |
| [#30](https://github.com/Looffeeuu/ChainProof/pull/30) | 修复确认页 1280 宽横向滚动条 | +23 / −9 |

**其他贡献**
- 在 PR #28 中提交前端适配：按独立成员确认调整确认入口、进度显示与 Mock（#24）。
- 提出并跟进 Issue [#15](https://github.com/Looffeeuu/ChainProof/issues/15)、[#19](https://github.com/Looffeeuu/ChainProof/issues/19)。
- 第 4 周提出「自我确认漏洞」「原文件下载入口」「Demo 数据重放」三条完善建议，拆分为 #24 ~ #26 后实施。
- Review：PR [#9](https://github.com/Looffeeuu/ChainProof/pull/9)（Approve）、PR [#23](https://github.com/Looffeeuu/ChainProof/pull/23)（Approve）、PR [#28](https://github.com/Looffeeuu/ChainProof/pull/28)（评论）。

## B 黄铭谦：区块链 / 智能合约（@Hmq901）

**负责 Issue**：[#1](https://github.com/Looffeeuu/ChainProof/issues/1) Fabric 测试网络、[#2](https://github.com/Looffeeuu/ChainProof/issues/2) 核心 Chaincode、[#11](https://github.com/Looffeeuu/ChainProof/issues/11) 契约对齐

**作者 PR**

| PR | 内容 | 规模 |
|---|---|---|
| [#10](https://github.com/Looffeeuu/ChainProof/pull/10) | 补全核心事务函数、修正贡献确认状态机、Fabric test-network 一键部署脚本与文档 | +9299 / −93，19 个文件 |
| [#12](https://github.com/Looffeeuu/ChainProof/pull/12) | 按 PR #9 对齐 Contribution / Certificate 契约；整数运算、UTF-8 排序、余数平局测试 | +192 / −48 |
| [#17](https://github.com/Looffeeuu/ChainProof/pull/17) | 集成脚本在真实 Fabric 网络上的兼容性修复（关闭未合并） | +3273 / −113 |

**其他贡献**
- 在 PR #28 中提交链码测试适配独立确认逻辑（`9969db4`）。
- 编写 Demo 演示数据一键种子脚本 `demo-seed.mjs`（#26，`c48ccc8`）。
- 实现里程碑文件下载的首个版本（#25，`381377d`）。
- 修复贡献统计取整导致总和溢出到 101% 的缺陷（`f56d28a`）。
- Review：PR [#9](https://github.com/Looffeeuu/ChainProof/pull/9)（评论）、PR [#23](https://github.com/Looffeeuu/ChainProof/pull/23)（Approve）、PR [#28](https://github.com/Looffeeuu/ChainProof/pull/28)（Approve）。

## C 全书阅：后端 / 集成 · 组长（@Looffeeuu）

**负责 Issue**：[#3](https://github.com/Looffeeuu/ChainProof/issues/3) 后端基础，并参与 [#4](https://github.com/Looffeeuu/ChainProof/issues/4) [#5](https://github.com/Looffeeuu/ChainProof/issues/5) [#6](https://github.com/Looffeeuu/ChainProof/issues/6) [#24](https://github.com/Looffeeuu/ChainProof/issues/24)–[#27](https://github.com/Looffeeuu/ChainProof/issues/27)

**作者 PR**

| PR | 内容 | 规模 |
|---|---|---|
| [#8](https://github.com/Looffeeuu/ChainProof/pull/8) | 后端基础、Project API、Fabric Gateway 集成 | +2157 / −14 |
| [#9](https://github.com/Looffeeuu/ChainProof/pull/9) | 冻结累计贡献与证书签发规则（三方契约） | +50 / −14 |
| [#14](https://github.com/Looffeeuu/ChainProof/pull/14) | 前端 PR 构建与自检 CI | +59 |
| [#18](https://github.com/Looffeeuu/ChainProof/pull/18) | 修复 WSL 网络辅助脚本与真实链码验收 | +36 / −16 |
| [#21](https://github.com/Looffeeuu/ChainProof/pull/21) | 前端接入首批 Project 真实 API | +906 / −78 |
| [#22](https://github.com/Looffeeuu/ChainProof/pull/22) | 里程碑上传、双 SHA-256、确认与贡献 API | +612 / −12 |
| [#23](https://github.com/Looffeeuu/ChainProof/pull/23) | 贡献证明签发与公开验证闭环 | +469 / −4 |
| [#28](https://github.com/Looffeeuu/ChainProof/pull/28) | 禁止提交者自我确认：契约、链码、后端、网络部署、Demo 重置与 CI 门禁 | +2037 / −351，48 个文件 |
| [#31](https://github.com/Looffeeuu/ChainProof/pull/31) | 原文件下载限项目成员，统一成员鉴权 | +53 / −9 |
| [#32](https://github.com/Looffeeuu/ChainProof/pull/32) | 仓库换行规范 | +5 / −5 |

**其他贡献**
- 创建并拆分全部周任务 Issue（#1 ~ #7）及第 4 周完善项（#24 ~ #27），维护验收清单。
- Review：PR [#12](https://github.com/Looffeeuu/ChainProof/pull/12)（2 次 Request changes 后 Approve）、PR [#13](https://github.com/Looffeeuu/ChainProof/pull/13)（2 次 Request changes 后 Approve）、PR [#29](https://github.com/Looffeeuu/ChainProof/pull/29)（Request changes 后 Approve）、PR [#30](https://github.com/Looffeeuu/ChainProof/pull/30)（Approve）。
- 组织真实 Fabric 环境下的冒烟、契约检查与 Demo 重置验收。

## 交叉 Review 一览

| PR | 作者 | Reviewer |
|---|---|---|
| #9 | C | A（Approve）、B（评论） |
| #12 | B | C（Request changes ×2 → Approve） |
| #13 | A | C（Request changes ×2 → Approve） |
| #23 | C | A（Approve）、B（Approve） |
| #28 | C | B（Approve）、A（评论） |
| #29 | A | C（Request changes → Approve） |
| #30 | A | C（Approve） |

## 第 4 周交付（Issue #7）

| 交付物 | 负责人 | 跟踪 |
|---|---|---|
| 项目介绍文档、贡献记录、分工打分表、演示脚本、答辩 PPT 初稿、打包脚本 | 全书阅 | PR #33 |
| 演示讲解视频：录制 / 剪辑 | 全书阅 / 杨宇 | #34 |
| PPT 定稿与讲述分工 | 全体 | #35 |
| 计时彩排与问答准备 | 全体 | #36 |
