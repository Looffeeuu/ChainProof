# ChainProof 前端

Vue 3 + Vite，九个页面：概览、项目列表、项目详情、创建项目、提交里程碑、贡献确认、
证书、公开验证、404。默认跑在内置假数据上，**不需要后端与 Fabric**；
接口就绪后一个一个切到真后端。

## 启动

```bash
cd frontend
npm ci                 # 按 package-lock.json 装，与 CI 一致
npm run dev            # http://localhost:5173
```

```bash
npm run build          # 产物在 dist/
npm run preview        # 预览构建产物
npm run check          # 14 个自检脚本（对比度、间距、契约形状、交互流程……）
```

`npm run check` 里有两条要开无头浏览器（`check:browser`、`check:flows`）。
机器上没有 Chrome / Edge / Chromium 时它们自动 SKIP，不会红；
指定位置用 `CHROME_PATH=/usr/bin/chromium npm run check`。

## 接真后端

配置全在 `frontend/.env.local`（不提交，模板见 [`.env.example`](.env.example)）：

```bash
cp .env.example .env.local
```

三个变量：

| 变量 | 作用 | 不填时 |
|---|---|---|
| `VITE_REAL_APIS` | 哪些接口走真后端，逗号分隔的函数名，`*` 为全部 | 全部走假数据 |
| `VITE_API_TARGET` | 后端地址，dev 服务器把 `/api` 代理过去 | `http://localhost:3000` |
| `VITE_DEMO_MEMBERS` | 身份菜单里列哪几个成员，决定请求头 `X-Member-Id` | `alice,bob,charlie` |

**一次只切一个接口**，顺序照 `docs/API.md` §8。前面的通了后面的才有数据——
比如项目走真接口、里程碑还走假数据时，真项目在假数据里查不到里程碑，
页面会显示成空的，那不是 bug。

身份走请求头 `X-Member-Id`（`docs/API.md` §0），由 `src/api/client.js` 统一加，
取的就是侧栏最下面那个菜单里当前选中的人。

### 首批：Project 三个接口

`.env.local` 写：

```ini
VITE_REAL_APIS=listProjects,createProject,getProject
VITE_DEMO_MEMBERS=alice,bob,charlie,empty-test-20260921
```

后端不在本机 3000 时再加一行 `VITE_API_TARGET=http://<地址>:3000`。
然后 `npm run dev`，按下面四项验收。

| 验什么 | 怎么做 | 该看到什么 |
|---|---|---|
| 正常 · 列表 | 打开 `/projects`，身份选 `alice` | 链上真实项目的卡片；名称、负责人、成员数与后端返回一致 |
| 正常 · 详情 | 点任意一张卡片 | 打开详情页，页头信息与列表一致 |
| 正常 · 创建 | `/projects/new` 填名称后提交 | 落到新项目的详情页；回列表能看到它。`ownerId` 取当前身份 |
| 空状态 | 身份切到 `empty-test-20260921`，看 `/projects` | 空状态那一屏（「还没有任何项目」+ 创建按钮），侧栏计数 0 |
| 加载失败 · 404 | 地址栏打开 `/projects/P-NOT-EXIST` | 错误态，显示后端给的 `PROJECT_NOT_FOUND`，不是白屏 |
| 加载失败 · 连不上 | 停掉后端后刷新 `/projects` | 「连不上服务器，请确认后端已经启动。」+ 重试按钮 |

界面看着对不代表字段真的对得上（多一个、少一个、时间格式不同，界面都可能照样显示）。
再跑一次逐字段核对：

```bash
CONTRACT_BASE=http://localhost:3000/api npm run check:contract
```

## 目录

```
src/
├─ api/          与后端的全部接触面。client.js 是传输层，mode.js 是逐接口开关
├─ mock/         假数据。组件不直接 import 它，只能经过 api/
├─ views/        九个页面
├─ components/   base/ 通用；project/、milestone/、certificate/ 按领域分
├─ composables/  useAsync：加载 / 出错 / 空 / 有数据四态
├─ stores/       session（当前身份）、settings（主题）、recent（最近项目）
├─ styles/       tokens.css 是全部设计令牌，颜色与间距只准引用它
└─ utils/        纯函数：SHA-256、百分比、时间格式化、证书判据
```

改动前先看 `src/styles/tokens.css` 与 `src/api/`：前者是样式的唯一来源，
后者是与后端的唯一接触面。
