#!/usr/bin/env bash
#
# 网络生命周期控制：up / down / status
#
# 直接调用官方 fabric-samples/test-network/network.sh，不重新实现其逻辑。
# 本脚本只负责：进入正确目录、传入固定参数、把结果校验清楚。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../config.env
source "${SCRIPT_DIR}/../config.env"

C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_BLUE='\033[0;34m'; C_RESET='\033[0m'
info()    { printf "${C_BLUE}==>${C_RESET} %s\n" "$*"; }
success() { printf "${C_GREEN}[OK]${C_RESET} %s\n" "$*"; }
warn()    { printf "${C_YELLOW}[WARN]${C_RESET} %s\n" "$*" >&2; }
fatal()   { printf "${C_RED}[FAIL]${C_RESET} %s\n" "$*" >&2; exit 1; }

# 解析 samples 目录：优先用 config.env 的值，其次用 install 阶段写入的记录
resolve_samples_dir() {
  local recorded="${HOME}/.chainproof/samples-dir"
  if [[ -n "${FABRIC_SAMPLES_DIR:-}" && -d "${FABRIC_SAMPLES_DIR}/test-network" ]]; then
    echo "${FABRIC_SAMPLES_DIR}"
    return 0
  fi
  if [[ -f "${recorded}" ]]; then
    local dir
    dir="$(cat "${recorded}")"
    if [[ -d "${dir}/test-network" ]]; then
      echo "${dir}"
      return 0
    fi
  fi
  return 1
}

SAMPLES_DIR="$(resolve_samples_dir)" \
  || fatal "找不到 fabric-samples。请先运行：./chainproof-network.sh setup"
TEST_NETWORK_DIR="${SAMPLES_DIR}/test-network"

cd "${TEST_NETWORK_DIR}"

# network.sh 自己会 export PATH=${ROOTDIR}/../bin 与 FABRIC_CFG_PATH=${PWD}/configtx，
# 这里额外导出一次，供本脚本直接调用 peer 时使用。
export PATH="${SAMPLES_DIR}/bin:${PATH}"
export FABRIC_CFG_PATH="${TEST_NETWORK_DIR}/configtx"

# ---------------------------------------------------------------------------

cmd_up() {
  # `up createChannel` 是 network.sh 支持的组合子命令：
  # 解析时 MODE=up，随后遇到 createChannel 会把 MODE 改写为 createChannel，
  # 其内部 createChannel() 会在网络未启动时自动 networkUp。
  info "启动网络并创建通道 ${CHANNEL_NAME}（数据库：${DATABASE}）"
  ./network.sh up createChannel \
    -c "${CHANNEL_NAME}" \
    -s "${DATABASE}" \
    -i "${FABRIC_VERSION}" \
    -cai "${FABRIC_CA_VERSION}" \
    -r "${MAX_RETRY}" \
    -d "${CLI_DELAY}"

  # network.sh 失败时未必返回非零码（内部用 fatalln 退出），这里独立校验容器状态
  info "校验容器状态"
  local expected_running=0
  local containers
  containers="$(docker ps --format '{{.Names}}' 2>/dev/null || true)"

  for name in peer0.org1.example.com peer0.org2.example.com orderer.example.com; do
    if echo "${containers}" | grep -qx "${name}"; then
      success "${name} 运行中"
      expected_running=$((expected_running + 1))
    else
      fatal "容器 ${name} 未运行。请检查上面的 network.sh 输出。"
    fi
  done

  # 通道是否真的建好
  info "校验通道 ${CHANNEL_NAME}"
  # shellcheck source=/dev/null
  source scripts/envVar.sh
  setGlobals 1
  if peer channel list 2>/dev/null | grep -q "${CHANNEL_NAME}"; then
    success "通道 ${CHANNEL_NAME} 已创建，peer0.org1 已加入"
  else
    fatal "peer0.org1 未加入通道 ${CHANNEL_NAME}"
  fi

  setGlobals 2
  if peer channel list 2>/dev/null | grep -q "${CHANNEL_NAME}"; then
    success "peer0.org2 已加入通道 ${CHANNEL_NAME}"
  else
    warn "peer0.org2 未加入通道 ${CHANNEL_NAME}（单组织演示可忽略，但双组织背书会失败）"
  fi

  cat <<EOF

${C_GREEN}网络已启动${C_RESET}
  通道       : ${CHANNEL_NAME}
  peer0.org1 : ${PEER0_ORG1_ADDRESS}
  peer0.org2 : ${PEER0_ORG2_ADDRESS}
  orderer    : ${ORDERER_ADDRESS}

下一步：./chainproof-network.sh deploy

EOF
}

cmd_down() {
  info "关闭网络并清理容器、卷与生成物"
  ./network.sh down || warn "network.sh down 返回非零码，可能网络本就没启动"

  # 独立确认清理干净：残留的 dev-peer* 链码容器会导致下次部署行为诡异
  local leftovers
  leftovers="$(docker ps -aq --filter name='dev-peer' --filter name='peer0' --filter name='orderer' --filter name='ca_' 2>/dev/null || true)"
  if [[ -n "${leftovers}" ]]; then
    warn "仍有残留容器，尝试清理"
    docker rm -f ${leftovers} 2>/dev/null || true
  fi

  # 清理本项目自己的暂存目录（只删我们创建的，不碰 samples）
  if [[ -n "${CHAINCODE_STAGE_DIR:-}" && "${CHAINCODE_STAGE_DIR}" == "${HOME}/.chainproof/"* ]]; then
    rm -rf "${CHAINCODE_STAGE_DIR}"
    info "已清理链码暂存目录 ${CHAINCODE_STAGE_DIR}"
  fi

  success "网络已关闭"
}

cmd_status() {
  info "Docker 容器"
  if docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | grep -Ei 'peer0|orderer|ca_|dev-peer|NAMES' ; then
    :
  else
    warn "没有运行中的 Fabric 容器"
  fi

  info "链码容器（dev-peer*）"
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^dev-peer'; then
    docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E '^dev-peer|NAMES'
  else
    warn "没有运行中的链码容器（首次 invoke 时 peer 才会构建并启动它）"
  fi

  if [[ -d "${TEST_NETWORK_DIR}/organizations/peerOrganizations" ]]; then
    info "通道列表"
    # shellcheck source=/dev/null
    source scripts/envVar.sh
    setGlobals 1 >/dev/null 2>&1
    peer channel list 2>/dev/null || warn "无法查询通道列表"

    info "已提交的链码定义"
    peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" 2>/dev/null \
      || warn "通道 ${CHANNEL_NAME} 上还没有已提交的链码定义"

    info "peer0.org1 上已安装的链码包"
    peer lifecycle chaincode queryinstalled 2>/dev/null || warn "无法查询已安装链码"
  else
    warn "尚未生成组织证书，网络可能还没启动过"
  fi
}

# ---------------------------------------------------------------------------

case "${1:-}" in
  up)     cmd_up ;;
  down)   cmd_down ;;
  status) cmd_status ;;
  *)      fatal "用法：network-control.sh {up|down|status}" ;;
esac
