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

后端调用：

```text
GetProjectsByMember(alice)
```

不带 Header 时进入演示降级模式：

```bash
curl http://localhost:3000/api/projects
```

后端调用：

```text
GetAllProjects()
```

因此 B 线需要在 Chaincode 中提供这两个查询。

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

## 11. 第一周验收清单

- [x] `npm install` 成功
- [x] `npm run dev` 成功
- [x] `/api/health` 返回 200
- [x] Gateway 代码骨架完成
- [ ] `.env` 配置真实 Fabric 证书路径
- [ ] 后端能连接 Fabric peer
- [ ] `POST /api/projects` → `CreateProject`
- [ ] `GET /api/projects/:id` → `GetProject`
- [ ] `GET /api/projects` → `GetProjectsByMember / GetAllProjects`
- [ ] A 线能把 Project 页面从 mock 切换到真实接口

完成后可关闭 Issue #3，并将 PR #8 从 Draft 转为 Ready。
