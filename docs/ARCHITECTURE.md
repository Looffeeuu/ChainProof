# ChainProof 系统架构

## 1. 总体架构

ChainProof 采用常规 B/S Web 架构，并使用 Hyperledger Fabric 作为可信记录层。

```text
浏览器
  |
  v
Vue 3 前端
  |
  | REST/JSON + multipart/form-data
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
- 项目标识与核心成员引用
- 里程碑标识
- 文件 SHA-256
- 贡献比例
- 成员确认结果
- Milestone 状态
- 贡献证明记录
- 关键交易 txId / 时间等可追溯信息

### 链下保存
- 用户上传的原始成果文件
- 用户头像
- UI 偏好
- Dashboard 缓存统计
- 演示身份 / 会话信息

> MVP 是团队内部协作系统，不把后端设计成零知识或隐私保险箱。原始文件由服务端链下托管，Fabric 只保存摘要和业务存证数据。

## 3. 前端

技术：Vue 3 + Vite。

页面：
- Dashboard
- 项目列表
- 项目详情
- 创建项目
- 提交里程碑
- 贡献确认
- Timeline
- 贡献证明
- 公开验证页面

前端不直接与 Fabric 通信，所有链上操作都通过后端完成。

MVP 不做正式登录，前端通过演示身份切换器选择 alice / bob / charlie，并在需要身份的请求中统一发送：

```http
X-Member-Id: alice
```

## 4. 后端

技术：Node.js + Express。

职责：
- REST API
- 参数校验
- 接收上传文件
- 独立计算服务端 SHA-256
- 与前端 `clientFileHash` 做一致性比对
- 链下文件托管
- Fabric Gateway 连接
- 交易提交 / 查询
- 统一业务错误映射
- 可选 SQLite 链下数据
- 贡献统计与证书服务

建议模块：

```text
backend/src/
├── app.js
├── routes/
├── controllers/
├── services/
│   ├── fabric.service.js
│   ├── hash.service.js
│   ├── file.service.js
│   └── certificate.service.js
└── config/
```

## 5. 区块链层

技术：Hyperledger Fabric + JavaScript Chaincode。

主要智能合约：`ChainProofContract`。

事务函数：
- `CreateProject`
- `GetProject`
- `CreateMilestone`
- `GetMilestone`
- `ConfirmContribution`
- `GetProjectMilestones`
- `GetProjectHistory`
- `IssueCertificate`
- `VerifyCertificate`

课程 MVP 基于官方本地 Fabric test-network。真实联盟链场景中，不同组织节点可以代表团队、学院、竞赛主办方或验证机构。

## 6. 文件完整性验证模型

MVP 采用前后端双算：

```text
浏览器选择文件
   |
   +--> 对原始字节流计算 SHA-256
   |       |
   |       +--> 显示 clientFileHash
   |
   +--> 上传原始文件 + clientFileHash
               |
               v
          Express 后端
               |
               +--> 对 req.file 原始字节流重新计算 SHA-256
               |
               +--> clientFileHash == serverFileHash ?
                         | 是
                         v
                  serverFileHash 写入 Fabric
                         |
                         v
                    链下保存文件

               不一致 -> 400 FILE_HASH_MISMATCH
```

两边都必须对文件原始字节流计算；文件名、大小、修改时间和 multipart 编码不参与摘要。

确认页 / 验证页可以把本地文件拖入浏览器重新计算 SHA-256，与链上 `fileHash` 比对；该验证动作不需要再次上传文件。

## 7. 贡献确认状态机

MVP 固定规则：
- contributor 比例均为整数，总和必须严格等于 100。
- 创建请求的 `X-Member-Id` 保存为 `submitterId`；提交者必须属于项目。
- 项目至少需要 2 名不同成员。
- 创建时把项目全部非提交者成员按 UTF-8 无符号字节序排序，保存为 `requiredConfirmerIds` 快照。项目成员后续变化不回写既有里程碑的确认范围。
- 提交者不能确认或拒绝自己的里程碑。
- 确认资格由 `requiredConfirmerIds` 决定，与 contributors 分配无关；因此贡献为 0 或未列入 contributors 的项目成员仍可以是独立确认人。
- 初始：`PENDING_CONFIRMATION`
- 所有 required confirmer 都确认：`VERIFIED`
- 任意 required confirmer 拒绝：立即 `REJECTED`
- `VERIFIED` 和 `REJECTED` 都是关闭状态，不再接受新表态。
- 同一成员只能表态一次，不允许撤回或改票。

因此 Chaincode / 后端需要区分：
- `SUBMITTER_CANNOT_CONFIRM`
- `MEMBER_NOT_REVIEWER`
- `ALREADY_DECIDED`
- `MILESTONE_CLOSED`

## 8. 贡献统计规则

Contribution Dashboard 只统计 `VERIFIED` 里程碑，每条已验证里程碑权重相同。

设项目中 `VERIFIED` 里程碑数量为 `N = basedOnMilestones`：

- 以项目全部成员为全集。对每位成员计算整数 `sum`，即其在全部 `VERIFIED` 里程碑中的 `percentage` 之和；未参与某条时计 0。当 `N > 0` 时，精确累计比例在数学上是 `sum / N`。
- 当 `N > 0` 时，全程使用整数运算：`floor = sum div N`，`remainder = sum mod N`。先分配各成员的 `floor`，再将 `100 - Σfloor` 个百分点依次分给 `remainder` 最大的成员。不得用浮点除法或浮点余数比较。
- 余数相同时按 `memberId` 的 UTF-8 无符号字节序升序分配；返回数组也按同一顺序排列。不得使用 `localeCompare()` 或本地化排序，确保前端 Mock、后端与 Fabric 背书节点结果一致。
- 最终所有成员的整数 `percentage` 总和严格等于 100，包括累计比例为 0 的项目成员。
- `N = 0` 时不执行除法，全员返回 0，`basedOnMilestones` 返回 0。

后端返回：

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

## 9. Certificate 规则

- 签发时先按 `projectId + memberId` 查询已有 Certificate；若存在，直接返回原证书，不重新检查资格，也不重复写链。
- 尚无证书时，检查成员属于项目；若项目没有 `VERIFIED` milestone，返回 HTTP 409 + `NO_VERIFIED_CONTRIBUTION`。
- 资格以最大余数法完成后的最终整数 `contributionPercentage`（与 Dashboard 的 `members[].percentage` 相同）为准。最终为 0 时也返回 HTTP 409 + `NO_VERIFIED_CONTRIBUTION`，中文提示统一为「累计贡献比例为 0%，不能签发证书。」只有最终大于 0 才签发；0% 成员仍保留在 Dashboard。
- `milestoneIds` 只保存该成员实际参与（contributors 中 `percentage > 0`）的 `VERIFIED` milestone ID，作为不可变快照；按 `createdAt`、`milestoneId` 正序排列。项目全部已验证里程碑数 `basedOnMilestones` 与 `Certificate.milestoneIds.length` 不要求相等。
- Certificate 保存 / 返回 `txId`，用于答辩时展示链上交易依据。

## 10. 安全与仓库规范

严禁提交：
- Fabric 私钥
- 自动生成证书
- `.env`
- 用户上传文件
- 其他秘密配置

需要配置模板时使用 `.env.example`。

