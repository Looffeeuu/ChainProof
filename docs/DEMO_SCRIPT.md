# ChainProof 答辩演示脚本

## 第 1 节 · 环境准备

### 启动 Fabric 网络

```bash
cd chaincode
./network.sh up createChannel -c chainproof -ca
./network.sh deployCC -ccn chainproof -ccp ../chaincode/chainproof-contract -ccl javascript
```

### 启动后端

```bash
cd backend
npm install
npm run demo:reset    # 重置演示数据
npm start
```

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 验证环境

- 前端：http://localhost:5173
- 后端：http://localhost:3000
- Fabric：Org1 + Org2 + Orderer 运行中

---

## 第 2 节 · 现场演示脚本（2:45）

### 演示身份

- alice（项目负责人）
- bob（团队成员）
- charlie（团队成员）

### 演示流程

| 步骤 | 身份 | 操作 | 预期结果 | 时长 |
|------|------|------|----------|------|
| 1 | alice | 创建项目「课程大作业」，添加 bob、charlie | 项目创建成功，成员列表显示 3 人 | 0:20 |
| 2 | alice | 提交里程碑「需求文档」，上传文件，声明贡献比例 alice:50, bob:30, charlie:20 | 浏览器显示 SHA-256，后端复算一致，里程碑进入 PENDING_CONFIRMATION | 0:30 |
| 3 | alice | 查看确认页 | **提交者没有确认按钮**（链码强制） | 0:15 |
| 4 | bob | 下载原文件 → 拖入核对框 → 哈希一致 → 确认 | 确认成功，等待 charlie | 0:30 |
| 5 | charlie | 确认 | 全部确认完成，状态变为 VERIFIED，显示 txId | 0:30 |
| 6 | alice | 查看项目详情 | 累计贡献比例显示，里程碑时间线显示 VERIFIED | 0:20 |
| 7 | bob | 签发贡献证明 | 证书生成，显示 certificateId | 0:20 |
| 8 | 任意 | 公开验证页面输入 certificateId | 显示 VALID，证书详情 | 0:20 |
| 9 | 任意 | 输入伪造编号 | 显示 NOT_FOUND（有效验证结果） | 0:10 |

### 异常场景（备用）

- 上传文件后修改一个字节再上传 → FILE_HASH_MISMATCH
- 非成员尝试确认 → MEMBER_NOT_REVIEWER
- 已确认成员再次确认 → ALREADY_DECIDED

---

## 第 3 节 · 常见问题与回答

### 每人至少认领 3 题

#### @Darioyy（杨宇）- 前端 / 产品
- [ ] Q1: 为什么用 Fabric，不用以太坊等公链？
- [ ] Q5: 贡献比例由提交者自己填，不主观吗？
- [ ] Q9: SHA-256 会不会碰撞？

#### @Hmg901（黄铭谦）- 区块链 / 智能合约
- [ ] Q4: 管理员直接改 peer 上的状态数据库会怎样？
- [ ] Q6: 如果有人故意一直不确认？
- [ ] Q7: 为什么统计不用浮点数？

#### @Looffeeuu（全书阅）- 后端 / 集成
- [ ] Q2: 后端能不能冒充成员确认？
- [ ] Q3: 原文件在链下，被改了或删了怎么办？
- [ ] Q8: 为什么不把文件直接上链？

---

### 问题回答草稿

#### Q2: 后端能不能冒充成员确认？

**能，这是当前 MVP 的局限。**

身份通过 `X-Member-Id` 请求头传递，所有交易由后端以同一个 Org1 用户提交。改进方案是用 Fabric CA 给每位成员签发身份，链码通过 `ctx.clientIdentity` 识别调用者。

（PPT 第 12 页）

#### Q3: 原文件在链下，被改了或删了怎么办？

**被改能发现：** 重新计算 SHA-256 后与链上不一致，确认人下载原文件在浏览器本地核验即可发现。

**被删无法恢复：** 改进方案是对象存储 / IPFS 加备份，链上保留内容寻址（CID）。

（PPT 第 12 页）

#### Q8: 为什么不把文件直接上链？

**会让账本膨胀，还会把成果内容暴露给所有节点。** 哈希已经足以证明文件身份——改一个字节，哈希就完全不同。

联盟链的价值是「多方共同认可的记录」，不是存储。只把证据上链，不把它当存储。

（PPT 第 5、12 页）

---

## 第 4 节 · 彩排计时表

### 第一次彩排（10-25）

| 环节 | 主讲 | 目标时长 | 实际时长 | 问题记录 |
|------|------|----------|----------|----------|
| PPT 1-4 页 | @Darioyy | 1:30 | | |
| PPT 5-8 页 | @Hmg901 | 1:45 | | |
| PPT 9-13 页 | @Looffeeuu | 3:40 | | |
| 现场演示 | @Looffeeuu | 2:45 | | |
| 模拟提问 | 全员 | 3:00 | | |
| **合计** | | **~7:00** | | |

### 第二次彩排（10-27）

| 环节 | 主讲 | 目标时长 | 实际时长 | 问题记录 |
|------|------|----------|----------|----------|
| PPT 1-4 页 | @Darioyy | 1:30 | | |
| PPT 5-8 页 | @Hmg901 | 1:45 | | |
| PPT 9-13 页 | @Looffeeuu | 3:40 | | |
| 现场演示 | @Looffeeuu | 2:45 | | |
| 模拟提问 | 全员 | 3:00 | | |
| **合计** | | **~7:00** | | |

---

## 附录 · 演示数据

### 种子脚本

```bash
cd backend
npm run demo:seed    # 一键创建演示项目、里程碑、成员
npm run demo:reset   # 重置到初始状态
```

### 演示文件

- 固定小文件 + 固定 SHA-256（chaincode/test/fixtures/）
- 文件哈希：`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

### 演示身份切换

前端右上角切换：alice / bob / charlie

请求头：`X-Member-Id: alice`
