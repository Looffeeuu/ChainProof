# ChainProof 后端开发说明

## 1. 安装依赖

```bash
cd backend
npm install
```

## 2. 配置环境变量

复制模板：

```bash
cp .env.example .env
```

下面三个 Fabric 路径必须改成你本机 `fabric-samples/test-network` 对应的真实路径：

- `FABRIC_TLS_CERT_PATH`
- `FABRIC_CERT_PATH`
- `FABRIC_KEY_PATH`

默认：

```text
FABRIC_MSP_ID=Org1MSP
FABRIC_CHANNEL_NAME=chainproof
FABRIC_CHAINCODE_NAME=chainproof
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_HOST_ALIAS=peer0.org1.example.com
```

## 3. 启动

```bash
npm run dev
```

正常：

```text
ChainProof backend listening on http://localhost:3000
```

## 4. 健康检查

```bash
curl http://localhost:3000/api/health
```

## 5. 演示身份

MVP 不做正式登录。需要成员身份的接口统一使用：

```http
X-Member-Id: alice
```

前端会通过身份切换器自动设置这个 Header。

## 6. 创建项目

前提：Fabric 网络已启动，并部署 `chainproof` Chaincode。

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "X-Member-Id: alice" \
  -d '{
    "projectId": "P001",
    "name": "ChainProof Demo",
    "description": "Week 1 backend integration test",
    "members": ["alice", "bob", "charlie"]
  }'
```

Header 存在时，`ownerId` 取 `X-Member-Id`。为方便调试，Header 缺失时仍兼容 body 中的 `ownerId`。

成功时 HTTP 201，并**直接返回完整 Project**，不包 `{ data: ... }`。

## 7. 读取项目

```bash
curl http://localhost:3000/api/projects/P001
```

## 8. 项目列表

当前成员的项目：

```bash
curl http://localhost:3000/api/projects \
  -H "X-Member-Id: alice"
```

后端调用链码 `GetAllProjects()`，再按 `X-Member-Id` 对返回项目的 `members` 列表进行过滤。不带 Header 时进入演示降级模式，返回全部项目：

```bash
curl http://localhost:3000/api/projects
```

因此 B 线第一批只需提供 `GetAllProjects()`；`GetProjectsByMember(memberId)` 可作为后续优化，不是本阶段联调前置条件。

## 9. 成功响应与错误响应

成功响应直接返回业务实体 / 数组，不再额外包 `data`。

错误统一：

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "项目 P001 不存在。"
  }
}
```

- `code`：英文，前端用于判断分支。
- `message`：中文，前端会原样显示。
- 业务失败使用正确的 4xx。

完整契约以 `../docs/API.md` 为准。

## 10. Week 2 文件接口约定

里程碑上传使用 `multipart/form-data`：

- `title`
- `description`
- `contributors`
- `file`
- `clientFileHash`

前端先计算 SHA-256；后端收到文件后独立复算，两边必须一致，否则返回：

```text
400 FILE_HASH_MISMATCH
```

原始文件保存在链下，Fabric 只存服务端计算出的 SHA-256。

实现细节：

- 默认保存到 `backend/uploads/`，可用 `UPLOAD_DIR` 改到独立数据盘。
- 文件以 `milestoneId` 的 SHA-256 作为本地文件名，避免路径穿越和同名覆盖。
- Fabric 提交失败时会清理本次链下文件；链上提交成功后保留原始字节。
- `GET /api/milestones/:milestoneId/file` 按链上记录的原文件名下载。
- 单文件上限 50 MiB；超过时返回 `413 FILE_TOO_LARGE`。

真实 Fabric 和后端启动后运行 Week 2 闭环验收：

```bash
cd backend
npm run smoke:milestones
```

脚本会验证双哈希一致与故意不一致、链下文件下载、列表/详情、两名 contributor 依次确认、`VERIFIED`、拒绝立即 `REJECTED`、重复与关闭后表态错误，以及 Contribution Dashboard 的 `basedOnMilestones`。

## 11. 真实 Project API 冒烟验证

前提：按 `blockchain/network/README.md` 在 Linux/WSL2 的 Docker 环境部署 `chainproof` 链码；在本机 `backend/.env` 配好 Fabric TLS、用户证书和私钥的**绝对路径**，并启动后端。不要提交 `.env`、证书或私钥。

在另一个终端运行：

```bash
cd backend
npm run smoke:projects
```

如后端不在默认地址，可设 `CHAINPROOF_API_URL=http://127.0.0.1:3000/api/`。脚本会在**本地 Fabric 账本中新建一个唯一的演示项目**（不会自动删除），并检查健康状态、Project 创建/读取、`X-Member-Id` 优先级、成员列表过滤、无身份降级，以及链码业务错误到 HTTP 4xx 的映射。成功时输出 `projectId` 和 Fabric `txId`，可留作 #3/#8 的验收记录。

该脚本不会启动 Docker、Fabric 网络或后端；若网络未就绪，不能把本地单元测试通过当作真链路验收。

## 12. 第一周验收清单

- [x] `npm install` 成功
- [x] `npm run dev` 成功
- [x] `/api/health` 返回 200
- [x] Gateway 代码骨架完成
- [ ] `.env` 配置真实 Fabric 证书路径
- [ ] 后端能连接 Fabric peer
- [ ] `POST /api/projects` → `CreateProject`
- [ ] `GET /api/projects/:id` → `GetProject`
- [ ] `GET /api/projects` → `GetAllProjects` 并按 `X-Member-Id` 过滤
- [ ] `npm run smoke:projects` 在真实 Fabric 网络上全部通过并记录 projectId / txId
- [ ] A 线能把 Project 页面从 mock 切换到真实接口

真实 Fabric 联调与 A 线首批 Project API 联调通过后，将 PR #8 从 Draft 转为 Ready；审阅并合并后由 `Closes #3` 自动关闭 Issue #3。
