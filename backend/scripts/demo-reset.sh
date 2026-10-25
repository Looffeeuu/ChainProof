#!/usr/bin/env bash
#
# ChainProof Demo 一键重置脚本（Issue #26）
#
# 功能：关闭旧网络 → 清理本地账本 → 启动网络 → 部署最新链码 → 等待 Backend → 执行 seed
#
# 用法：
#   npm run demo:reset          # 从仓库根目录运行
#   ./scripts/demo-reset.sh     # 从 backend/ 目录运行
#
# 前置条件：
#   - Docker Desktop 已启动
#   - WSL2 已安装（Windows）或原生 Linux
#   - Node.js >= 18, npm >= 9
#   - Fabric 镜像和二进制已下载（首次运行 chainproof-network.sh setup）
#
# 预计耗时：3-5 分钟（取决于网络速度和机器性能）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${BACKEND_DIR}/.." && pwd)"
NETWORK_SCRIPT="${REPO_ROOT}/blockchain/network/chainproof-network.sh"

# 颜色
if [[ -t 1 ]]; then
  C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'
  C_BLUE='\033[0;34m'; C_BOLD='\033[1m'; C_RESET='\033[0m'
else
  C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_BOLD=''; C_RESET=''
fi

info()    { printf "${C_BLUE}==>${C_RESET} %s\n" "$*"; }
success() { printf "${C_GREEN}[OK]${C_RESET} %s\n" "$*"; }
warn()    { printf "${C_YELLOW}[WARN]${C_RESET} %s\n" "$*" >&2; }
fatal()   { printf "${C_RED}[FAIL]${C_RESET} %s\n" "$*" >&2; exit 1; }

# ─── 破坏性操作确认 ──────────────────────────────────────────────────────────

echo ""
printf "${C_BOLD}${C_RED}"
cat <<'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                    ⚠️  破坏性重置警告  ⚠️                        ║
╠══════════════════════════════════════════════════════════════════╣
║  此脚本将执行以下操作：                                          ║
║                                                                  ║
║  1. 关闭当前 Fabric 网络（所有容器将被删除）                     ║
║  2. 清理本地账本数据与链下上传文件（所有链上状态将丢失）         ║
║  3. 重新启动网络并部署最新链码                                   ║
║  4. 写入 Demo 演示数据（覆盖现有数据）                           ║
║                                                                  ║
║  ⚠️  所有现有数据将永久丢失！                                    ║
║                                                                  ║
║  如果你正在开发或测试，请先备份重要数据。                        ║
╚══════════════════════════════════════════════════════════════════╝
EOF
printf "${C_RESET}"
echo ""

read -rp "确认要继续吗？输入 yes 继续: " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  info "已取消操作。"
  exit 0
fi

echo ""

# ─── Step 1: 关闭旧网络 ──────────────────────────────────────────────────────

info "Step 1/5: 关闭 Fabric 网络..."
if [[ -f "${NETWORK_SCRIPT}" ]]; then
  bash "${NETWORK_SCRIPT}" down || warn "网络可能未运行，继续..."
else
  fatal "找不到网络脚本: ${NETWORK_SCRIPT}"
fi
success "网络已关闭"

# 链下原文件按 milestoneId 落盘且只写一次（file-storage.service.js 用 'wx'）。
# 账本清空后必须一起清掉，否则 seed 的固定 ID（M001…）会因文件已存在而 500。
UPLOAD_DIR_RESOLVED="${UPLOAD_DIR:-$(grep -E '^UPLOAD_DIR=' "${BACKEND_DIR}/.env" 2>/dev/null | tail -n 1 | cut -d= -f2-)}"
UPLOAD_DIR_RESOLVED="${UPLOAD_DIR_RESOLVED:-${BACKEND_DIR}/uploads}"
[[ "${UPLOAD_DIR_RESOLVED}" = /* ]] || UPLOAD_DIR_RESOLVED="${BACKEND_DIR}/${UPLOAD_DIR_RESOLVED#./}"
if [[ -d "${UPLOAD_DIR_RESOLVED}" ]]; then
  removed="$(find "${UPLOAD_DIR_RESOLVED}" -maxdepth 1 -type f -name '*.bin' -print -delete | wc -l)"
  success "已清理链下上传文件 ${removed} 个（${UPLOAD_DIR_RESOLVED}）"
fi

# ─── Step 2: 启动网络 ────────────────────────────────────────────────────────

info "Step 2/5: 启动 Fabric 网络并创建通道..."
bash "${NETWORK_SCRIPT}" up
success "网络已启动"

# ─── Step 3: 部署链码 ────────────────────────────────────────────────────────

info "Step 3/5: 部署最新链码..."
# 上一步刚清空账本并创建了全新通道，首个链码定义必须从 sequence 1 开始。
# config.env 默认 sequence 2 用于升级已有开发网络；这里显式覆盖。
CC_SEQUENCE=1 bash "${NETWORK_SCRIPT}" deploy
success "链码已部署（全新通道 sequence 1）"

# 从刚生成的 test-network 证书导出 Backend Gateway 配置。
# 这样全新 worktree 无需先手工创建 backend/.env。
# shellcheck source=../../blockchain/network/config.env
source "${REPO_ROOT}/blockchain/network/config.env"
ORG1_DIR="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com"
USER1_MSP="${ORG1_DIR}/users/User1@org1.example.com/msp"

export FABRIC_MSP_ID="Org1MSP"
export FABRIC_CHANNEL_NAME="${CHANNEL_NAME}"
export FABRIC_CHAINCODE_NAME="${CC_NAME}"
export FABRIC_PEER_ENDPOINT="localhost:7051"
export FABRIC_PEER_HOST_ALIAS="peer0.org1.example.com"
export FABRIC_TLS_CERT_PATH="${ORG1_DIR}/peers/peer0.org1.example.com/tls/ca.crt"
export FABRIC_CERT_PATH="${USER1_MSP}/signcerts/User1@org1.example.com-cert.pem"
export FABRIC_KEY_PATH="${USER1_MSP}/keystore/priv_sk"

if [[ ! -f "${FABRIC_KEY_PATH}" ]]; then
  FABRIC_KEY_PATH="$(find "${USER1_MSP}/keystore" -maxdepth 1 -type f -print -quit)"
  export FABRIC_KEY_PATH
fi

[[ -f "${FABRIC_TLS_CERT_PATH}" ]] || fatal "找不到 Org1 peer TLS 证书：${FABRIC_TLS_CERT_PATH}"
[[ -f "${FABRIC_CERT_PATH}" ]] || fatal "找不到 User1 签名证书：${FABRIC_CERT_PATH}"
[[ -n "${FABRIC_KEY_PATH}" && -f "${FABRIC_KEY_PATH}" ]] || fatal "找不到 User1 私钥：${USER1_MSP}/keystore"

# ─── Step 4: 启动 Backend ────────────────────────────────────────────────────

info "Step 4/5: 启动 Backend 服务..."

cd "${BACKEND_DIR}"

# 检查是否已有 Backend 在运行
if curl -s http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  warn "Backend 已在运行，跳过启动步骤"
else
  # 后台启动 Backend
  npm run dev > /tmp/chainproof-backend.log 2>&1 &
  BACKEND_PID=$!
  info "Backend 已启动（PID: ${BACKEND_PID}）"

  # 等待 Backend 就绪
  info "等待 Backend 就绪..."
  MAX_WAIT=30
  WAITED=0
  while ! curl -s http://127.0.0.1:3000/api/health >/dev/null 2>&1; do
    sleep 1
    WAITED=$((WAITED + 1))
    if [[ ${WAITED} -ge ${MAX_WAIT} ]]; then
      fatal "Backend 启动超时（${MAX_WAIT}s），请检查日志: /tmp/chainproof-backend.log"
    fi
    printf "."
  done
  echo ""
  success "Backend 已就绪"
fi

# ─── Step 5: 执行 Seed ───────────────────────────────────────────────────────

info "Step 5/5: 写入 Demo 演示数据..."
npm run demo:seed

# ─── 完成 ────────────────────────────────────────────────────────────────────

echo ""
printf "${C_BOLD}${C_GREEN}"
cat <<'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                  ✅  Demo 环境初始化完成！  ✅                    ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Backend:  http://127.0.0.1:3000                                ║
║  Frontend:  cd frontend && npm run dev                          ║
║                                                                  ║
║  已写入数据：                                                    ║
║    - 3 个项目（P001 / P002 / P003）                              ║
║    - 6 个里程碑（VERIFIED × 4 / REJECTED × 1 / PENDING × 1）    ║
║    - 2 张贡献证书                                                ║
║                                                                  ║
║  前端入口：                                                      ║
║    Dashboard    →  http://localhost:5173/                        ║
║    项目详情     →  http://localhost:5173/projects/P001           ║
║    里程碑确认   →  http://localhost:5173/milestones/M004         ║
║                    （PENDING 状态）                               ║
║    公开验证     →  http://localhost:5173/verify/                 ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
EOF
printf "${C_RESET}"
echo ""
