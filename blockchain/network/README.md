# 本地 Fabric 开发网络（成员 B / Issue #1）

ChainProof 使用官方 Hyperledger Fabric `test-network` 作为本地开发网络。
本目录提供一键脚本，把「装样例 → 起网络 → 建通道 → 部署链码 → 跑通验收链路」固化成可复现流程。

> 自动生成的证书、私钥、channel artifacts 一律不进仓库，已由根目录 `.gitignore` 排除。

---

## 当前验证状态（务必先读）

本目录脚本的**验证程度不一致**，请按此表判断可信度：

| 内容 | 验证方式 | 状态 |
|---|---|---|
| 链码合约逻辑 | 107 个单元测试，覆盖率 语句 95.8% / 分支 86.4% | ✅ 已实测通过 |
| 测试替身与真实 `fabric-shim` 的一致性 | 逐字节对比（复合键、范围查询边界、键校验），已设为 `npm test` 门禁 | ✅ 已实测通过 |
| `config.env` 中固定的版本号与下载地址 | 在目标 Ubuntu 20.04 环境实测：v2.5.16 / CA v1.5.17 二进制地址均返回 HTTP 200 | ✅ 已实测通过 |
| `fabric-samples` 仓库 tag 情况 | 实测确认不存在 `v2.5.x` tag（最新 `v2.4.9`），故改用 `main` 并记录 commit | ✅ 已实测通过 |
| 全部 shell 脚本 | `bash -n` 语法检查通过 | ✅ 已实测通过 |
| **`setup` / `up` / `deploy` / `smoke` 端到端真实链路** | **未执行** | ⚠️ **未实测** |

⚠️ **最后一项是 Issue #1 的核心验收，目前尚未跑通。** 原因是执行环境（Ubuntu 虚拟机）
当时处于关机状态，且宿主机可用内存不足（2.6 GB，虚拟机需 6 GB），
继续执行会导致宿主机进入内存交换。因此本次交付**不包含真实链路的实测结果**。

**你第一次运行时的预期**：脚本本身经过语法检查与参数核对，但未经端到端验证，
可能在 `deploy`（链码容器构建、npm install 阶段）或 `smoke`（jq 断言）处暴露问题。
请按下方「排错手册」处理，并把失败输出反馈给成员 B。

---

## 快速开始

```bash
cd blockchain/network
./chainproof-network.sh setup
```

这一条命令会依次完成：环境自检 → 准备 fabric-samples 与二进制 → 启动网络并创建 `chainproof` 通道
→ 部署本仓库链码 → 在真实链上跑完整业务冒烟测试。

全部通过时，最后会打印本次写入链上的 `projectId` / `milestoneId` / `certificateId`，可直接用于答辩演示。

### 分子命令

| 命令 | 作用 |
|---|---|
| `./chainproof-network.sh preflight` | 只做环境自检，不改动任何东西 |
| `./chainproof-network.sh up` | 启动网络并创建通道 |
| `./chainproof-network.sh deploy` | 部署 / 重新部署本仓库链码 |
| `./chainproof-network.sh smoke` | 只跑链码冒烟测试 |
| `./chainproof-network.sh status` | 查看容器、通道、链码状态 |
| `./chainproof-network.sh down` | 关闭网络并清理容器与暂存目录 |

---

## 前置条件

### 硬件

| 项目 | 最低 | 建议 |
|---|---|---|
| 内存 | 4 GB 可用 | 6–8 GB |
| 磁盘 | 10 GB 可用 | 20 GB |
| CPU | 2 核 | 4 核以上 |

内存低于 4 GB 时，容器会被 OOM 杀掉，表现为「网络起来了但 peer 反复重启」。

### 操作系统

Fabric test-network 需要 **Linux 容器环境**。三种可行方式：

1. **Linux 虚拟机（推荐，本项目实测环境）**
   VMware / VirtualBox 里跑一台 Ubuntu 20.04+，4 GB 以上内存，开启嵌套虚拟化。
2. **WSL2 + Docker Desktop（Windows）**
   必须在 WSL2 里执行本脚本，不能在 PowerShell / CMD 里执行。
   Docker Desktop 需开启「Settings → Resources → WSL integration」。
3. **macOS / 原生 Linux**
   安装 Docker Desktop 或 Docker Engine 即可。

### 软件

- Docker Engine 20.10+，且**当前用户能免 sudo 使用 docker**
- Docker Compose（v2 插件或 `docker-compose` 均可）
- git、curl、tar、jq
- Node.js 18+（仅本机跑链码单元测试时需要；部署本身不要求）

`preflight` 会逐项检查并给出修复命令：

```bash
./chainproof-network.sh preflight
```

---

## 版本固定

所有版本号集中在 [`config.env`](./config.env)，**不要在命令行里临时改**，否则三个组员的环境会漂移。

| 配置项 | 固定值 |
|---|---|
| Fabric 二进制与镜像 | `2.5.16` |
| Fabric CA | `1.5.17` |
| fabric-samples ref | `main` |
| 通道名 | `chainproof` |
| 链码名 | `chainproof` |
| 状态数据库 | `leveldb` |

### 关于 fabric-samples 的版本（容易踩坑）

`fabric-samples` 仓库**没有 v2.5.x 的 tag**，最新 tag 只到 `v2.4.9`，它的版本号与 Fabric 本体并不同步。
因此不能写成 `FABRIC_SAMPLES_REF="v${FABRIC_VERSION}"`——那样 checkout 会失败。
官方 `install-fabric.sh` 的行为同样是找不到 tag 就回落到 `main`，本脚本沿用该策略。

真正决定链上行为的是二进制与镜像版本，脚本会强制下载到 `2.5.16` / `1.5.17`，
因此 samples 用哪个 ref 不影响一致性。若需完全复现成员 B 的环境，可显式指定已实测的 commit：

```bash
FABRIC_SAMPLES_REF=d999452 ./chainproof-network.sh setup
```

### 为什么用 leveldb 而不是 couchdb

本仓库链码只用到 `getState` / `putState` / `getStateByRange` / `getStateByPartialCompositeKey` /
`getHistoryForKey`，全部属于 leveldb 支持的操作，没有用到 CouchDB 的 rich query。
切到 CouchDB 只会多起两个容器、增加约 1 GB 内存占用，对课程 Demo 没有收益。

---

## 复用已有的 fabric-samples

如果本机已经装过 fabric-samples（例如在 `~/hyperledger/fabric/scripts/fabric-samples`），
脚本会自动识别并复用，只补齐与 `2.5.16` 对齐的二进制，不重新下载 1.4 GB 镜像。

也可以显式指定：

```bash
FABRIC_SAMPLES_DIR=/path/to/fabric-samples ./chainproof-network.sh setup
```

脚本判断「已就绪」的依据是目录下同时存在 `test-network/` 与 `bin/`，
并用 `bin/.chainproof-fabric-version` 标记文件记录二进制版本以实现幂等。

> 注意：若复用的旧安装里 `peer` 是 v2.5.0 而镜像是 2.5.16，`network.sh` 的 `checkPrereqs`
> 会打印 out-of-sync 告警。本脚本会自动下载 2.5.16 二进制覆盖，消除该告警。

---

## 手动验证链码

`smoke` 已经覆盖完整链路。若想手动逐条调用，按下面步骤操作。

### 设置环境变量

```bash
cd <fabric-samples>/test-network
export PATH=$(pwd)/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/configtx
source scripts/envVar.sh
setGlobals 1     # 切换到 Org1 管理员身份
```

### Issue #1 的核心验收：CreateProject → GetProject

用 `jq` 构造参数，避免中文与嵌套 JSON 的转义问题：

```bash
# 提交 CreateProject
ARGS=$(jq -n '{function:"CreateProject", Args:["P001","ChainProof Demo","课程演示项目","alice","[\"alice\",\"bob\",\"charlie\"]"]}')

peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${ORDERER_CA}" \
  -C chainproof -n chainproof \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PEER0_ORG1_CA}" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PEER0_ORG2_CA}" \
  --waitForEvent -c "${ARGS}"

# 查询 GetProject
peer chaincode query -C chainproof -n chainproof \
  -c '{"function":"GetProject","Args":["P001"]}'
```

期望返回：

```json
{"docType":"project","projectId":"P001","name":"ChainProof Demo","description":"课程演示项目",
 "ownerId":"alice","members":["alice","bob","charlie"],
 "createdAt":"2026-09-14T07:00:00.000Z","status":"ACTIVE","txId":"..."}
```

### 关于背书策略

test-network 默认背书策略要求两个组织的多数派，因此 **invoke 必须同时带上 org1 与 org2 的
`--peerAddresses`**。只带 org1 会报 `endorsment policy not satisfied`。
纯查询（`peer chaincode query`）不需要背书，只带当前组织即可。

---

## 给后端（成员 C）的连接信息

| 配置项 | 值 |
|---|---|
| peer0.org1 | `localhost:7051` |
| peer0.org2 | `localhost:9051` |
| orderer | `localhost:7050` |
| 通道名 | `chainproof` |
| 链码名 | `chainproof` |
| MSP ID | `Org1MSP` |
| 证书根目录 | `<fabric-samples>/test-network/organizations/` |

Org1 管理员的证书与私钥路径：

```text
organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/
├── signcerts/User1@org1.example.com-cert.pem
└── keystore/priv_sk            # 文件名是随机的，需在运行时用 glob 匹配
```

TLS 根证书：

```text
organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
```

> 这些文件由 `cryptogen` 在本地生成，**只属于开发环境，严禁提交到仓库**。
> 后端应通过 `.env` 读取路径，`.env` 已在 `.gitignore` 中排除。

---

## 排错

### `preflight` 报「当前用户无权访问 Docker」

```bash
sudo usermod -aG docker $USER
newgrp docker          # 或重新登录
```

### `deployCC` 卡在 chaincode install

JavaScript 链码首次安装时，peer 会在 `ccenv` 容器里跑 `npm install`。网络慢时会卡几分钟，属正常现象。

```bash
# 看构建日志
docker logs $(docker ps -aq --filter name=dev-peer) 2>&1 | tail -60
```

若报 npm 网络错误，可在虚拟机内配置 npm 镜像源后重试：

```bash
npm config set registry https://registry.npmmirror.com
./chainproof-network.sh deploy
```

### 端口被占用

Fabric 固定使用 7050 / 7051 / 7052 / 7053 / 9051 / 9052 / 5054。
多半是上一次没关干净：

```bash
./chainproof-network.sh down
docker ps -a --filter name='peer0|orderer|ca_'
```

### `endorsement policy not satisfied`

invoke 少带了一个组织的 peer。见上文「关于背书策略」。

### 容器起来又退出

```bash
docker logs peer0.org1.example.com --tail 50
docker logs orderer.example.com --tail 50
```

常见原因：内存不足被 OOM、端口冲突、`organizations/` 与运行中的容器不同步
（`./chainproof-network.sh down` 后重来即可）。

### 想彻底重置

```bash
./chainproof-network.sh down
docker system prune -af --volumes      # 会删掉未使用的镜像，谨慎
```

---

## WSL2 特别说明

Windows + WSL2 环境下有两个高频坑，脚本已自动规避：

1. **仓库位于 `/mnt/c`、`/mnt/e` 等 Windows 挂载路径**
   这类路径由 9P 协议提供服务，peer 打包链码时文件遍历极慢，
   且 `npm install` 可能因可执行位丢失而失败。
   → `deploy` 会先把链码复制到 Linux 原生文件系统（`~/.chainproof/chaincode`）再打包。
2. **Docker Desktop 未开启 WSL 集成**
   → `preflight` 会检测到并提示。

---

## Week 1 验收标准

任意组员按本文档应能独立完成：

> ⚠️ 下列条目截至本次交付**尚未端到端跑通**（见文首「当前验证状态」）。
> 这是**待验证的目标清单**，不是已完成记录。谁先跑通，请把勾选项补上并注明环境。

- [ ] clone ChainProof 仓库；
- [ ] `./chainproof-network.sh preflight` 全部通过；
- [ ] `./chainproof-network.sh setup` 一次跑完；
- [ ] `chainproof` 通道已创建，两个 peer 均已加入；
- [ ] 本仓库链码已提交，`status` 能查到链码定义；
- [ ] 真实调用 `CreateProject` 与 `GetProject` 成功（Issue #1 核心链路）；
- [ ] `./chainproof-network.sh smoke` 全部用例通过（Issue #2 验收）；
- [ ] `./chainproof-network.sh down` 能干净关闭，再次 `up` 能重新跑通。

### 冒烟测试覆盖内容

`smoke` 在真实链上逐项断言：

**正向链路**
`CreateProject` → `GetProject` → `CreateMilestone` → 三人 `ConfirmContribution` → `VERIFIED`
→ `GetProjectMilestones` → `GetProjectContributions` → `GetProjectHistory`
→ `IssueCertificate` → `GetCertificate` → `VerifyCertificate` = `VALID`

**负向规则（状态机与校验）**

| 场景 | 期望错误码 |
|---|---|
| 读取不存在的项目 | `PROJECT_NOT_FOUND` |
| 重复创建同一项目 | `VALIDATION_ERROR` |
| 贡献比例总和 97% | `CONTRIBUTION_TOTAL_INVALID` |
| `fileHash` 不是 64 位小写 hex | `VALIDATION_ERROR` |
| 贡献者不是项目成员 | `VALIDATION_ERROR` |
| 非贡献者表态 | `MEMBER_NOT_IN_CLAIM` |
| 同一成员改票 | `ALREADY_DECIDED` |
| `VERIFIED` 后继续表态 | `MILESTONE_CLOSED` |
| 单人拒绝即 `REJECTED`，他人再表态 | `MILESTONE_CLOSED` |
| 非法 `decision`（如 `MAYBE`） | `VALIDATION_ERROR` |
| 重复签发证书（幂等） | 返回原证书，不产生新 ID |
| 非项目成员签发证书 | `VALIDATION_ERROR` |
| 验证不存在的证书 | `NOT_FOUND`（非错误） |

同时校验确认流程不会篡改 `fileHash` 与贡献比例。

> 若你的环境导致命令有差异，请把**真正验证通过**的命令更新回本文档，
> 确保三个人使用同一套流程。

---

## 仓库安全规则

以下内容只属于本地开发环境，**严禁提交**（已由根目录 `.gitignore` 排除）：

- `organizations/`（证书与私钥）
- `system-genesis-block/`、`channel-artifacts/`
- `crypto-config/`
- 任何 `*.pem`、`*.key`
- Docker 数据卷

提交前建议自查：

```bash
git status --porcelain | grep -Ei 'organizations|channel-artifacts|\.pem|\.key'
```
