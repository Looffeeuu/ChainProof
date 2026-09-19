# Week 1 进度汇报 — 成员 B（区块链 / Fabric）

**分支**：`feat/2-chaincode-core`
**提交**：4 个，18 个文件，+8786 / −93
**汇报日期**：2026-09-14

---

## Issue #2：完成并验证 ChainProof 核心 Chaincode

### 状态：✅ 代码完成并已通过单元测试验证

### 交付内容

**补全 8 个事务函数**（`docs/ARCHITECTURE.md` §5 要求的清单现已全部实现）：

| 函数 | 用途 |
|---|---|
| `GetProjectMilestones` | 项目里程碑列表，按 `createdAt` 正序 |
| `GetProjectHistory` | 项目链上历史，供 Timeline 展示 |
| `GetProjectContributions` | 贡献统计，仅计 `VERIFIED` |
| `IssueCertificate` | 签发贡献证明，幂等 |
| `VerifyCertificate` | 公开验证，不存在时返回 `NOT_FOUND` |
| `GetCertificate` / `GetCertificates` | 证书读取与按条件列举 |
| `GetAllProjects` | 供后端 `GET /projects` 使用 |

**修正 4 处与契约冲突的实现**（属缺陷修复，非功能新增）：

1. 原 `ConfirmContribution` 允许同一成员**改票**，且已 `VERIFIED` / `REJECTED` 的里程碑仍能继续表态，
   违反 §7「同一成员只能表态一次」「关闭状态不再接受新表态」。
   现按优先级严格判定：`MILESTONE_CLOSED` → `MEMBER_NOT_IN_CLAIM` → `ALREADY_DECIDED`。
2. 原比例校验用 `1e-6` 容差，实际**放行了小数**（如 `50.5`），而 §7 与 API.md §0 要求整数。
   现强制 `Number.isInteger` 且总和严格等于 100。
3. 补齐 `Milestone.txId`；`fileHash` 增加 64 位小写 hex 校验；贡献者必须是项目成员。
4. **贡献统计取整后总和溢出到 101%**（详见下节，独立提交 `f56d28a` 修复）。

### 补充：贡献统计的取整缺陷

`GetProjectContributions` 原先对每个成员的平均值**逐项 `Math.round`**。
`Math.round` 对 `.5` 一律进位，多个成员同时命中 `.5` 时整数总和会超过 100。

实测复现（两个 `VERIFIED` 里程碑）：

```
M1: alice 40 / bob 35 / charlie 25
M2: alice 60 / bob 20 / charlie 20
精确平均 = 50 / 27.5 / 22.5
逐项 Math.round = 50 + 28 + 23 = 101   ← 总和溢出
```

**影响**：Dashboard 贡献占比图对不上，答辩时会出现「贡献总和 101%」。
API.md §4 示例是 `42+31+27=100`，说明契约期望总和为 100。

**修复**：改用最大余数法（Hamilton method），保证整数之和 === `Math.round(浮点之和)`。
余数相同时按 `memberId` 升序作稳定次级排序键 —— 这是链码的确定性硬要求，
否则各背书节点结果不一致会导致背书失败。已用「四人同余数 `.5`」场景实测三次运行结果完全一致。

> 值得记录：原有测试用例断言的正是逐项 `Math.round` 的错误行为，且未校验总和，
> 所以该缺陷一度被测试「保护」着。这说明覆盖率数字本身不等于正确性。

### 验收情况

| 验收项 | 结果 |
|---|---|
| 单元测试 | **109 passed / 109 total**，4 个 suite 全通过 |
| 覆盖率 | 语句 96.11%、分支 87.08%、函数 98.46%、行 97.04% |
| 依赖固定 | `latest` → `2.5.8`，已补 `package-lock.json` |
| 干净环境可复现 | `npm install && npm test` 即可，已实测 |

### 需要 A / C 知悉的接口约定

链码错误消息统一为 `CODE: 中文说明` 格式，例如：

```
ALREADY_DECIDED: 成员 alice 已对里程碑 M001 表过态，不能撤回或改票。
```

**C（后端）**：取冒号前的 `CODE` 直接映射到 API.md §7 的 `error.code`，无需字符串模糊匹配。
已覆盖全部约定错误码。

**A（前端）**：状态跃迁到 `VERIFIED` / `REJECTED` 时会发 `MilestoneClosed` 事件，
签发证书时发 `CertificateIssued`。可选订阅，不订阅不影响 REST 链路。

### 一项值得记录的质量措施

单元测试依赖手写的 `MockStub`，存在「测试全绿但真链失败」的盲区。
为此新增 `test/mock-stub-parity.test.js`，把 mock 与真实 `fabric-shim` 原型方法做逐字节对比，
并纳入 `npm test` 门禁。

**该门禁在开发中抓出一个真实缺陷**：`fabric-shim` 2.5.8 的复合键在 `objectType` 之后也会插入分隔符
（实际格式 `\x00type\x00attr1\x00attr2\x00`），mock 最初少写一个分隔符。
若不修正，所有复合键索引查询会在真链上静默失效，而合约单元测试永远发现不了。

同时固化一条易被误判的性质：`P001` 的部分键查询**不会**污染 `P0010`。
因分隔符 `\x00` 小于所有可打印字符，区间上界恰好将其排除 —— 这是 Fabric 选用
`MIN_UNICODE_RUNE_VALUE` 作分隔符的原因。已加回归测试锁定。

---

## Issue #1：搭建 Hyperledger Fabric 本地测试网络

### 状态：⚠️ 脚本与文档已交付，**端到端真实链路尚未实测**

### 交付内容

`blockchain/network/` 下新增一键脚本，固化「装样例 → 起网络 → 建通道 → 部署链码 → 冒烟测试」全流程：

| 命令 | 作用 |
|---|---|
| `./chainproof-network.sh setup` | 全流程一次跑完（首次推荐） |
| `./chainproof-network.sh preflight` | 环境自检，只读不改动 |
| `./chainproof-network.sh up` | 启动网络并创建 `chainproof` 通道 |
| `./chainproof-network.sh deploy` | 部署 / 重新部署链码 |
| `./chainproof-network.sh smoke` | 真实链上完整业务链路冒烟测试 |
| `./chainproof-network.sh status` | 查看容器、通道、链码状态 |
| `./chainproof-network.sh down` | 关闭并清理 |

版本集中在 `config.env`：Fabric **2.5.16** / CA **1.5.17** / leveldb / 通道名与链码名均为 `chainproof`。

`README.md` 已重写，含前置条件、版本固定说明、手动验证命令、**给后端的连接信息**、
排错手册、WSL2 特别说明、Week 1 验收清单。

### 验收情况

| 验收项 | 状态 |
|---|---|
| Fabric / CA 二进制下载地址有效 | ✅ 实测 HTTP 200 |
| 目标环境 Docker 与 2.5.16 全套镜像就绪 | ✅ 实测确认 |
| 全部脚本语法正确 | ✅ `bash -n` 通过 |
| `network.sh` 子命令、`deployCC.sh` 参数、`envVar.sh` 变量名 | ✅ 逐项对照官方源码核对 |
| **`setup` / `up` / `deploy` / `smoke` 端到端跑通** | ❌ **未执行** |
| 真实调用 `CreateProject` / `GetProject` 成功 | ❌ **未执行** |

### 未完成原因

执行环境（Ubuntu 虚拟机）当时处于关机状态，且宿主机可用内存不足（2.6 GB 可用，虚拟机需 6 GB）。
继续启动会导致宿主机进入内存交换、其他程序明显卡顿，因此经确认改为先交付代码。

**这不是脚本已知有错，而是没有运行过。** 参数虽已逐项核对，仍可能在
`deploy`（链码容器构建、容器内 `npm install`）或 `smoke`（jq 断言）阶段暴露问题。

### 写脚本前实测纠正的两个错误假设

这两点若凭记忆编写，会直接导致脚本失败，记录在此供组员参考：

1. **`fabric-samples` 仓库没有 `v2.5.x` 的 tag**，最新只到 `v2.4.9`，
   其版本号与 Fabric 本体**并不同步**。按 `FABRIC_VERSION` 拼 samples ref 会 checkout 失败
   （`codeload` 对 `v2.5.16` 返回 HTTP 404）。
   脚本沿用官方 `install-fabric.sh` 的回落策略使用 `main`，并记录已实测 commit `d999452` 以便复现。
2. **Docker Compose 版本号字符串不可靠**：实测某环境输出 `v5.5.1`（非官方命名）。
   因此 `preflight` 改用「最小 compose 文件能力探测」而非校验版本字符串，避免误判可用环境。

### 下一步（建议 Week 2 首要事项）

由任一有可用 Docker 环境的组员执行：

```bash
cd blockchain/network
./chainproof-network.sh setup
```

预期有利条件：目标环境已有 Docker 26.1.3、Fabric 2.5.16 全套镜像、`fabric-samples` 与二进制齐备，
大概率无需重新下载约 1.4 GB 内容。

跑通后请把真实输出回填到 `README.md` 的 Week 1 验收清单，并注明环境。
若脚本报错，请贴出完整输出，我会修。

---

## 额外修复：`.gitattributes`（影响全组）

新增仓库级 `.gitattributes`，强制 `*.sh` 与源码以 **LF** 检出。

**问题**：仓库当前 `core.autocrlf=true`，而该配置因机器而异。
在 Windows 上 clone 的组员会拿到 CRLF 的 shell 脚本，在 Linux / WSL2 里直接报
`bad interpreter: /bin/bash^M` 而无法运行，整套 Fabric 部署流程失效。

**影响范围已核验**：提交前确认索引中所有已跟踪文件本就是纯 LF（CRLF 计数 0），
因此本次改动**不产生任何跨范围 diff**，未触及 A（前端）与 C（后端）的文件内容。

---

## 提交记录

```
f56d28a fix(chaincode): 修正贡献统计取整导致总和溢出到 101 的缺陷
76878ee docs(network): 如实标注真实链路未实测,移除含错误结论的调试脚本
8b4fea3 feat(network): 提供 Fabric test-network 一键部署脚本与文档
480b213 feat(chaincode): 补全核心事务函数并修正贡献确认状态机
```

工作区干净，无敏感文件（已核验无 `organizations/`、`*.pem`、`*.key` 等进入提交）。
PR 描述见同目录 `ChainProof-PR描述.md`，可直接贴到 GitHub。

---

## PR #9 后续：B 线验收清单对齐（2026-09-19 补充）

组长在《v2.2 待讨论事项回复》中采纳了 A 线关于 0% 成员证书规则的建议，
并要求 PR #9 合并后 B 线按新契约对齐实现。本节记录本次对齐的四处代码修正与对应测试。

### 代码修正（`lib/chainproof-contract.js`）

**Gap 1：`GetProjectContributions` 改为等权分母 = 全部 VERIFIED 总数 N**

- 先读项目，用 `project.members` 初始化 `totals` Map，保证 0% 成员出现在结果中；
- 分母改为「项目全部 VERIFIED 里程碑总数 N」，成员未出现在某条 VERIFIED 里程碑时按 0 计算；
- 遍历前对 `milestoneIds` 做升序排序，保证各背书节点浮点累加顺序一致（确定性要求）。

**Gap 2：`_roundContributions` 的 `targetSum` 固定为 100**

- 原实现用 `Math.round(exactSum)`，当存在 0% 成员时 `exactSum` 可能小于 100；
- 新契约下每个 VERIFIED 里程碑内 contributors 百分比之和为 100，
  故精确平均之和恒为 100，`targetSum` 直接固定为 `basedOnMilestones > 0 ? 100 : 0`，语义更贴合契约。

**Gap 3：`_getVerifiedMilestoneIdsForMember` 过滤 `percentage > 0` 并排序**

- 原实现只要成员出现在 VERIFIED 里程碑中就计入，未过滤 `percentage = 0` 的情况；
- 新契约要求 `milestoneIds` 只包含该成员「实际参与」的已验证里程碑；
- 排序规则：先按 `createdAt` 正序，时间相同再按 `milestoneId` 升序（确定性次级键）。

**Gap 4：`IssueCertificate` 对 0% 成员使用专用错误码**

- 原实现抛 `VALIDATION_ERROR`，与「缺参数」等校验错误混在一起；
- 新契约要求 `NO_VERIFIED_CONTRIBUTION`，便于前端区分「成员在项目里但没贡献」
  与「参数写错」两类 UI 提示。

### 新增 / 更新的单元测试（`test/certificate.test.js`）

按 B 线验收清单逐项对应：

| B 线验收项 | 对应测试 |
|---|---|
| Contribution 返回项目全部成员 | `返回项目全部成员，包括 0% 成员` |
| 无已验证里程碑时全员为 0 | `没有 VERIFIED 里程碑时返回全员 0 与 basedOnMilestones 0`、`只统计 VERIFIED：仅有 PENDING 与 REJECTED 的项目返回全员 0`（已更新） |
| 50%/50% 判定用例通过 | `50%/50% 判定用例：M1 只有 alice 100%，M2 只有 bob 100%，最终必须为 50%/50%` |
| 最大余数法平局用例通过 | `最大余数法平局用例：四人同余数 0.5，按 memberId 升序分配 +1` |
| 0% 成员不能签发 Certificate | `项目有 VERIFIED 里程碑但成员累计贡献为 0% -> NO_VERIFIED_CONTRIBUTION`、`milestoneIds 过滤掉 percentage = 0 的贡献记录`（bob 部分） |
| `NO_VERIFIED_CONTRIBUTION` 异常用例通过 | 同上 |
| `milestoneIds` 只包含成员实际参与的已验证里程碑 | `milestoneIds 只包含该成员参与的 VERIFIED 里程碑`、`milestoneIds 按 createdAt 正序、时间相同再按 milestoneId 升序`、`milestoneIds 过滤掉 percentage = 0 的贡献记录`（alice 部分） |
| 重复签发幂等测试通过 | `同一 projectId + memberId 重复签发返回已有证书`、`幂等重复签发不写入新状态键`、`幂等重复签发不重复发出事件` |

此外还更新了：

- `成员参与里程碑数量不同时`：按新契约口径重新计算期望值（bob (31+0)/2=15.5→16，charlie (27+30)/2=28.5→28，总和 100）；
- `成员有 VERIFIED 里程碑之外无贡献记录`：改为断言 `NO_VERIFIED_CONTRIBUTION` 错误码。

### 验收情况

| 验收项 | 状态 |
|---|---|
| B 线验收清单（除 Fabric 真实链路外） | ✅ 代码与测试已对齐 |
| 单元测试本地运行 | ⚠️ **未运行**：当前环境无 Node.js / npm，无法执行 `npm test` |
| Fabric 真实链路 `setup → up → deploy → smoke` | ❌ **未执行**：原因同前（虚拟机未启动、宿主机内存不足） |

**需要组员协助验证**：请在有 Node.js 的环境执行一次 `cd blockchain/chaincode && npm install && npm test`，
把输出贴到 PR 评论。若全部通过即可认为本次对齐完成；若有失败请贴出完整报错，我会修。

### 与既有风险项的关系

- **Issue #1 真实链路**：仍是 Week 2 首要阻塞项，状态未变；
- **贡献统计口径**：本次按组长确认的新契约实现，原「算术平均 vs 加权平均」的讨论已终结；
- **`.gitattributes`**：本次改动未触及行尾约定，无需额外核验。

### 提交记录（本次补充）

本次修改尚未提交，待组员本地跑通测试后一并 commit：

```
fix(chaincode): 按 PR #9 契约对齐贡献统计与证书签发规则
```

预期包含：

- `lib/chainproof-contract.js`：4 处 Gap 修正；
- `test/certificate.test.js`：5 个新增测试 + 2 个既有测试更新；
- 本文件的补充章节。

---

## 风险与需要团队决策的点

1. **Issue #1 的真实链路必须在 Week 2 联调前跑通**，否则 C 的 Fabric Gateway 无处可接。
   这是目前唯一的阻塞项。
2. **状态数据库选 leveldb**：本合约未用 CouchDB rich query，leveldb 足够且省约 1 GB 内存。
   若后续 Dashboard 需要按贡献者做复杂查询，需重新评估 —— 但那更适合在后端 SQLite 侧做。
3. **贡献统计口径需 A / C 确认**：`GetProjectContributions` 采用「成员在其参与的
   `VERIFIED` 里程碑中 `percentage` 的**算术平均**，再用最大余数法取整」。
   API.md §4 只给了返回结构示例、**未定义聚合算法**，因此这属于我的实现选择。

   两点需要确认：
   - **算术平均是否符合预期**？另一种常见口径是按里程碑加权（例如按成果大小或时间），
     若需改动，逻辑集中在一个函数内。
   - **成员参与里程碑数量不同时，总和可能不等于 100**。例如 alice 参与 2 个里程碑、
     bob 只参与 1 个，精确平均之和本身就不是 100。当前实现保证
     `整数总和 === Math.round(精确平均之和)`，不强行凑成 100。
     若 Dashboard 需要固定显示 100%，需要重新定义口径 —— 请 A 明确前端预期。

4. **Dashboard 数据源建议**：若前端需要按贡献者做复杂筛选或排序，建议在后端 SQLite 侧
   完成，不要依赖链码做重查询。链码侧的 `GetProjectContributions` 定位是「提供权威数值」。
