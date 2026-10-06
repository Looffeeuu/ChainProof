#!/usr/bin/env bash
#
# ChainProof 本地 Fabric 网络一键脚本（Issue #1）
#
# 设计目标：任意组员 clone 仓库后，按 README 跑一条命令即可得到
# 「网络已启动 + chainproof 通道已创建 + 本仓库链码已部署 + 冒烟测试通过」的环境。
#
# 用法：
#   ./chainproof-network.sh setup     # 一键全流程（首次使用推荐）
#   ./chainproof-network.sh up        # 仅启动网络并创建通道
#   ./chainproof-network.sh deploy    # 仅部署/升级本仓库链码
#   ./chainproof-network.sh smoke     # 仅跑链码冒烟测试
#   ./chainproof-network.sh status    # 查看网络与链码状态
#   ./chainproof-network.sh down      # 关闭并清理网络
#   ./chainproof-network.sh preflight # 仅做环境自检
#
# 所有可调参数集中在同目录 config.env，可用环境变量覆盖。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./config.env
source "${SCRIPT_DIR}/config.env"

# ---------------------------------------------------------------------------
# 输出辅助
# ---------------------------------------------------------------------------

if [[ -t 1 ]]; then
  C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'
  C_BLUE='\033[0;34m'; C_RESET='\033[0m'
else
  C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_RESET=''
fi

info()    { printf "${C_BLUE}==>${C_RESET} %s\n" "$*"; }
success() { printf "${C_GREEN}[OK]${C_RESET} %s\n" "$*"; }
warn()    { printf "${C_YELLOW}[WARN]${C_RESET} %s\n" "$*" >&2; }
fatal()   { printf "${C_RED}[FAIL]${C_RESET} %s\n" "$*" >&2; exit 1; }

# 运行子脚本，统一带上 SCRIPT_DIR
run_step() {
  local script="$1"; shift
  bash "${SCRIPT_DIR}/scripts/${script}" "$@"
}

print_banner() {
  cat <<EOF

========================================================================
 ChainProof 本地 Fabric 网络
------------------------------------------------------------------------
 Fabric 版本      : ${FABRIC_VERSION}
 Fabric CA 版本   : ${FABRIC_CA_VERSION}
 fabric-samples   : ${FABRIC_SAMPLES_DIR}
 通道名           : ${CHANNEL_NAME}
 链码名           : ${CC_NAME} (${CC_SRC_LANGUAGE})
 状态数据库       : ${DATABASE}
 仓库根目录       : ${CHAINPROOF_REPO_DIR}
 链码源码         : ${CHAINCODE_SRC_DIR}
========================================================================

EOF
}

usage() {
  sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^#\s\{0,1\}//'
}

# ---------------------------------------------------------------------------
# 子命令
# ---------------------------------------------------------------------------

cmd_preflight() {
  run_step preflight.sh
}

cmd_install_samples() {
  run_step install-fabric-samples.sh
}

cmd_up() {
  info "启动网络并创建通道 ${CHANNEL_NAME}"
  run_step preflight.sh
  run_step install-fabric-samples.sh
  run_step network-control.sh up
}

cmd_deploy() {
  info "部署链码 ${CC_NAME}"
  run_step preflight.sh
  run_step install-fabric-samples.sh
  run_step deploy-chaincode.sh
}

cmd_smoke() {
  info "运行链码冒烟测试"
  run_step smoke-test.sh
}

cmd_down() {
  info "关闭并清理网络"
  run_step network-control.sh down
}

cmd_status() {
  run_step network-control.sh status
}

cmd_setup() {
  print_banner
  cmd_preflight
  cmd_install_samples
  info "[1/4] 启动网络"
  run_step network-control.sh up
  # Fabric 新通道的首个链码定义必须从 sequence 1 开始。
  # config.env 的默认 sequence 2 用于升级既有 1.0 定义；setup 面向全新网络，
  # 因此这里显式改为 1。SETUP_CC_SEQUENCE 仅供特殊复现场景覆盖。
  export CC_SEQUENCE="${SETUP_CC_SEQUENCE:-1}"
  info "[2/4] 部署链码 ${CC_NAME}（version=${CC_VERSION}, sequence=${CC_SEQUENCE}）"
  run_step deploy-chaincode.sh
  info "[3/4] 冒烟测试"
  run_step smoke-test.sh
  info "[4/4] 完成"
  cat <<EOF

${C_GREEN}ChainProof 本地环境已就绪。${C_RESET}

下一步：
  * 查看网络与链码状态 : ./chainproof-network.sh status
  * 手动调用链码       : 见 README.md「手动验证链码」
  * 接入后端 Gateway   : 连接信息见 README.md「给后端（成员 C）的连接信息」
  * 用完关闭网络       : ./chainproof-network.sh down

EOF
}

# ---------------------------------------------------------------------------
# 入口分发
# ---------------------------------------------------------------------------

main() {
  local mode="${1:-}"
  [[ $# -gt 0 ]] && shift

  case "${mode}" in
    setup)          cmd_setup "$@" ;;
    up)             cmd_up "$@" ;;
    deploy)         cmd_deploy "$@" ;;
    smoke)          cmd_smoke "$@" ;;
    down)           cmd_down "$@" ;;
    status)         cmd_status "$@" ;;
    preflight)      cmd_preflight "$@" ;;
    install-samples) cmd_install_samples "$@" ;;
    -h|--help|help|"")
      usage
      exit 0
      ;;
    *)
      warn "未知子命令：${mode}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
