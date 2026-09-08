# ChainProof REST API 草案

Base URL：`/api`

本文档用于约定 MVP 阶段前端与后端之间的接口。具体字段后续可以调整，但接口职责尽量保持稳定。

## 健康检查

### GET `/health`
返回后端运行状态。

## Projects

### POST `/projects`
创建项目。

示例请求：

```json
{
  "name": "VLA Safety Benchmark",
  "description": "课程演示项目",
  "ownerId": "alice",
  "members": ["alice", "bob", "charlie"]
}
```

### GET `/projects`
获取当前演示用户可查看的项目列表。

### GET `/projects/:projectId`
获取项目详情。

### GET `/projects/:projectId/milestones`
按时间顺序获取项目里程碑。

### GET `/projects/:projectId/history`
获取基于账本记录的项目历史。

## Milestones

### POST `/projects/:projectId/milestones`
使用 `multipart/form-data` 提交里程碑。

字段：
- `title`
- `description`
- `contributors`：JSON 字符串
- `file`

后端负责计算 SHA-256，并将摘要提交到 Fabric。

### GET `/milestones/:milestoneId`
获取单个里程碑。

### POST `/milestones/:milestoneId/confirmations`
确认或拒绝一个贡献声明。

```json
{
  "memberId": "bob",
  "decision": "CONFIRMED"
}
```

## Dashboard

### GET `/projects/:projectId/contributions`
返回用于可视化的累计贡献数据。

示例响应：

```json
{
  "projectId": "P001",
  "members": [
    { "memberId": "alice", "percentage": 42 },
    { "memberId": "bob", "percentage": 31 },
    { "memberId": "charlie", "percentage": 27 }
  ]
}
```

## Certificates

### POST `/projects/:projectId/certificates`
当项目满足验证要求后，为成员生成贡献证明。

### GET `/certificates/:certificateId`
返回贡献证明详情。

### GET `/verify/:certificateId`
公开验证接口。

## 错误返回格式

所有 API 错误统一使用类似格式：

```json
{
  "error": {
    "code": "CONTRIBUTION_TOTAL_INVALID",
    "message": "Contribution percentages must sum to 100."
  }
}
```

错误 `code` 保留英文，便于前端判断；`message` 后续可以根据界面需要切换为中文。

## MVP 约定

- ID 可以使用 UUID 或稳定生成的业务 ID。
- 时间统一使用 ISO 8601。
- API 不得暴露 Fabric 私钥或敏感连接配置。
- 为了答辩展示，可以在响应中附带区块链 transaction ID 等非敏感元数据。
