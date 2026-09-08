# 本地 Fabric 开发网络

ChainProof 开发阶段使用官方 Hyperledger Fabric `test-network` 作为基础，不把自动生成的网络文件复制进本仓库。

## 推荐本地流程

1. 按官方 Fabric 文档安装 `fabric-samples`、相关二进制文件和 Docker 镜像。
2. 进入 `fabric-samples/test-network`，启动网络并创建 ChainProof 使用的通道：

```bash
./network.sh down
./network.sh up createChannel -c chainproof
```

3. 部署本仓库中的 JavaScript Chaincode。命令形式如下：

```bash
./network.sh deployCC \
  -ccn chainproof \
  -ccp /absolute/path/to/ChainProof/blockchain/chaincode \
  -ccl javascript \
  -c chainproof
```

4. 在接入后端 Fabric Gateway 之前，先确认 Chaincode 已成功打包、安装并部署。

## 关闭网络

```bash
./network.sh down
```

## 仓库安全规则

不要把以下 Fabric 自动生成内容提交到本仓库：
- organizations
- 证书
- 私钥
- channel artifacts
- Docker 数据

这些内容只属于本地开发环境，并已经通过 `.gitignore` 排除。

## Week 1 验收标准

任意一位组员应该能够根据文档完成：

- clone ChainProof 仓库；
- 准备官方 Fabric test-network；
- 启动 `chainproof` channel；
- 部署本仓库 Chaincode；
- 至少成功调用 `CreateProject` 和 `GetProject`；
- 使用文档命令停止并重新启动网络。

如果你们本机 Fabric 版本导致命令略有差异，请把最终真正验证通过的命令更新回这个 README，确保三个人使用同一套流程。
