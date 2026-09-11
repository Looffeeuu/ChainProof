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
- 初始：`PENDING_CONFIRMATION`
- 所有 contributor 都确认：`VERIFIED`
- 任意 contributor 拒绝：立即 `REJECTED`
- `VERIFIED` 和 `REJECTED` 都是关闭状态，不再接受新表态。
- 同一成员只能表态一次，不允许撤回或改票。

因此 Chaincode / 后端需要区分：
- `ALREADY_DECIDED`
- `MILESTONE_CLOSED`
- `MEMBER_NOT_IN_CLAIM`

## 8. 贡献统计规则

Contribution Dashboard 只统计 `VERIFIED` 里程碑。

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

- 项目至少有 1 条 `VERIFIED` milestone 才允许签发。
- 成员必须属于该项目。
- 同一 `projectId + memberId` 重复请求时返回已存在的证书。
- Certificate 保存 / 返回 `txId`，用于答辩时展示链上交易依据。

## 10. 安全与仓库规范

严禁提交：
- Fabric 私钥
- 自动生成证书
- `.env`
- 用户上传文件
- 其他秘密配置

需要配置模板时使用 `.env.example`。
