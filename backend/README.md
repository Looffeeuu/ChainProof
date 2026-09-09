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

其中下面三个 Fabric 路径必须改成你本机 `fabric-samples/test-network` 对应的真实路径：

- `FABRIC_TLS_CERT_PATH`
- `FABRIC_CERT_PATH`
- `FABRIC_KEY_PATH`

默认配置：

```text
FABRIC_MSP_ID=Org1MSP
FABRIC_CHANNEL_NAME=chainproof
FABRIC_CHAINCODE_NAME=chainproof
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_HOST_ALIAS=peer0.org1.example.com
```

## 3. 启动后端

```bash
npm run dev
```

正常时终端应看到：

```text
ChainProof backend listening on http://localhost:3000
```

## 4. 验证健康检查

浏览器打开：

```text
http://localhost:3000/api/health
```

或运行：

```bash
curl http://localhost:3000/api/health
```

预期返回类似：

```json
{
  "service": "chainproof-backend",
  "status": "ok",
  "timestamp": "..."
}
```

## 5. 验证 Fabric 项目创建接口

前提：Fabric 网络已启动，并且 `chainproof` Chaincode 已部署。

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "P001",
    "name": "ChainProof Demo",
    "description": "Week 1 backend integration test",
    "ownerId": "alice",
    "members": ["alice", "bob", "charlie"]
  }'
```

成功时应返回 HTTP 201，并返回链上 Project 数据。

## 6. 读取项目

```bash
curl http://localhost:3000/api/projects/P001
```

如果能读回刚刚创建的数据，则说明：

```text
HTTP REST API
→ Express
→ Fabric Gateway
→ Chaincode
→ Ledger
```

这一条 Week 1 核心链路已经跑通。

## 7. 第一周验收清单

- [ ] `npm install` 成功
- [ ] `npm run dev` 成功
- [ ] `/api/health` 返回 200
- [ ] `.env` 配置正确且没有提交到 Git
- [ ] 后端能连接 Fabric peer
- [ ] `POST /api/projects` 能调用 `CreateProject`
- [ ] `GET /api/projects/:projectId` 能调用 `GetProject`

完成以上内容后即可关闭 GitHub Issue #3。
