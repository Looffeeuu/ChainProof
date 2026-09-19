#!/usr/bin/env bash
#
# 环境自检：在真正启动网络前，把会失败的点一次性报清楚。
#
# 设计要点：
#   1. 只读检查，不安装、不启动容器、不修改系统。
#   2. 区分「致命」（必须修）与「警告」（可能出问题）。
#   3. 对工具做能力探测而非版本号字符串校验。
#      原因：曾遇到某环境的 `docker compose version` 输出 v5.5.1
#      （非官方 Compose 版本命名），但功能完全正常。
#      只校验版本字符串会把可用环境误判为不可用。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../config.env
source "${SCRIPT_DIR}/../config.env"

# 颜色：仅在输出到终端时启用（子脚本不会继承父脚本的未导出变量，这里自行定义）
if [[ -t 1 ]]; then
  C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'
  C_BLUE='\033[0;34m'; C_RESET='\033[0m'
else
  C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_RESET=''
fi

FATAL_COUNT=0
WARN_COUNT=0

ok()   { printf "  ${C_GREEN}[OK]${C_RESET}   %s\n" "$*"; }
bad()  { printf "  ${C_RED}[FAIL]${C_RESET} %s\n" "$*"; FATAL_COUNT=$((FATAL_COUNT + 1)); }
warn() { printf "  ${C_YELLOW}[WARN]${C_RESET} %s\n" "$*"; WARN_COUNT=$((WARN_COUNT + 1)); }
note() { printf "         %s\n" "$*"; }
# 注意：这个函数不能叫 head —— 那会遮蔽系统的 head 命令，
# 而本脚本多处用到 `head -1`，一旦遮蔽就会静默输出错误结果。
section() { printf "\n${C_BLUE}==>${C_RESET} %s\n" "$*"; }

# ---------------------------------------------------------------------------
section "1. 运行平台"
# ---------------------------------------------------------------------------

if grep -qi microsoft /proc/version 2>/dev/null; then
  warn "检测到 WSL2 环境"
  note "Fabric 需要 Docker Desktop 且已启用 WSL2 集成；否则容器起不来。"
  note "仓库若位于 /mnt/c 或 /mnt/e 等 Windows 挂载路径，链码打包会明显变慢，"
  note "且 npm install 可能失败。本项目的部署脚本已自动把链码复制到 Linux 原生"
  note "文件系统（见 config.env 的 CHAINCODE_STAGE_DIR）来规避该问题。"
else
  ok "原生 Linux 虚拟机 / 物理机"
fi

# Hyper-V 嵌套虚拟化：WSL2 与多数云主机上 Docker 依赖它
if [[ -r /sys/module/kvm_intel/parameters/nested ]]; then
  NESTED="$(cat /sys/module/kvm_intel/parameters/nested)"
  [[ "${NESTED}" == "Y" || "${NESTED}" == "1" ]] \
    && ok "Intel 嵌套虚拟化已开启" \
    || warn "Intel 嵌套虚拟化未开启（nested=${NESTED}），部分环境下会影响容器网络"
fi

KERNEL="$(uname -r)"
ok "内核 ${KERNEL}"
# cgroup v2 + 老版本 Docker 曾有不兼容问题，这里只做提示
if [[ -f /sys/fs/cgroup/cgroup.controllers ]]; then
  note "cgroup 模式：v2（unified）"
else
  note "cgroup 模式：v1 或 hybrid"
fi

# ---------------------------------------------------------------------------
section "2. 必备命令行工具"
# ---------------------------------------------------------------------------

for cmd in docker git curl tar jq; do
  if command -v "${cmd}" >/dev/null 2>&1; then
    ok "${cmd} -> $(command -v "${cmd}")"
  else
    bad "${cmd} 未安装"
    case "${cmd}" in
      docker) note "Ubuntu/Debian: 按官方文档安装 Docker Engine，并把当前用户加入 docker 组。" ;;
      jq)     note "Ubuntu/Debian: sudo apt-get install -y jq（peer chaincode invoke 需要它）" ;;
      git)    note "Ubuntu/Debian: sudo apt-get install -y git" ;;
      curl)   note "Ubuntu/Debian: sudo apt-get install -y curl" ;;
      tar)    note "缺少 tar 无法解包 Fabric 二进制" ;;
    esac
  fi
done

# node/npm：只有链码打包阶段需要（JavaScript 链码）
if [[ "${CC_SRC_LANGUAGE}" == "javascript" ]]; then
  for cmd in node npm; do
    if command -v "${cmd}" >/dev/null 2>&1; then
      ok "${cmd} -> $("${cmd}" --version 2>&1 | head -1)"
    else
      warn "${cmd} 未安装"
      note "JavaScript 链码在 peer 的 ccenv 容器内执行 npm install，"
      note "宿主机没有 node/npm 通常也能部署；但本机跑单元测试需要 node。"
    fi
  done
fi

# ---------------------------------------------------------------------------
section "3. Docker 守护进程与 Compose 能力"
# ---------------------------------------------------------------------------

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    SERVER_VER="$(docker info --format '{{.ServerVersion}}' 2>/dev/null || echo unknown)"
    DRIVER="$(docker info --format '{{.Driver}}' 2>/dev/null || echo unknown)"
    ok "Docker 守护进程可用（server ${SERVER_VER}, driver ${DRIVER}）"

    # 当前用户能否免 sudo 使用 docker
    if docker ps >/dev/null 2>&1; then
      ok "当前用户可直接访问 Docker（无需 sudo）"
    else
      bad "当前用户无权访问 Docker"
      note "把用户加入 docker 组后【重新登录】生效："
      note "  sudo usermod -aG docker \$USER && newgrp docker"
    fi
  else
    bad "Docker 已安装但守护进程不可用"
    note "启动服务：sudo systemctl start docker"
    note "WSL2：确认 Docker Desktop 已启动且开启了 WSL 集成。"
  fi

  # Compose：能力探测（用一份最小 compose 文件验证能否正确解析）
  PROBE_FILE="$(mktemp -t chainproof-compose-probe-XXXXXX.yml)"
  printf 'services:\n  probe:\n    image: busybox\n' > "${PROBE_FILE}"

  COMPOSE_CMD=""
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  elif docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  fi

  if [[ -n "${COMPOSE_CMD}" ]]; then
    if ${COMPOSE_CMD} -f "${PROBE_FILE}" config >/dev/null 2>&1; then
      ok "Compose 可用：${COMPOSE_CMD}（能正确解析 compose 文件）"
      note "$(${COMPOSE_CMD} version 2>&1 | head -1)"
      note "network.sh 会自行选择 docker-compose 或 docker compose，此处只确认能力可用。"
    else
      bad "找到 ${COMPOSE_CMD}，但无法解析最小 compose 文件"
      note "这通常意味着 Compose 安装损坏或版本过旧。"
      note "建议安装官方 Compose v2 插件：https://docs.docker.com/compose/install/"
    fi
  else
    bad "未找到可用的 Docker Compose"
    note "安装官方 Compose v2 插件：https://docs.docker.com/compose/install/"
  fi

  rm -f "${PROBE_FILE}"
fi

# ---------------------------------------------------------------------------
section "4. Fabric 镜像"
# ---------------------------------------------------------------------------

if docker info >/dev/null 2>&1; then
  NEEDED_IMAGES=(
    "hyperledger/fabric-peer:${FABRIC_VERSION}"
    "hyperledger/fabric-orderer:${FABRIC_VERSION}"
    "hyperledger/fabric-ccenv:${FABRIC_VERSION}"
    "hyperledger/fabric-baseos:${FABRIC_VERSION}"
    "hyperledger/fabric-ca:${FABRIC_CA_VERSION}"
  )

  MISSING_IMAGES=()
  for image in "${NEEDED_IMAGES[@]}"; do
    if docker image inspect "${image}" >/dev/null 2>&1; then
      ok "已有镜像 ${image}"
    else
      MISSING_IMAGES+=("${image}")
    fi
  done

  if [[ ${#MISSING_IMAGES[@]} -gt 0 ]]; then
    warn "缺少 ${#MISSING_IMAGES[@]} 个镜像，首次运行 setup 时会自动拉取（约 1.4 GB）"
    for image in "${MISSING_IMAGES[@]}"; do note "  - ${image}"; done
  else
    ok "全部所需镜像已就绪，setup 可跳过下载"
  fi
fi

# ---------------------------------------------------------------------------
section "5. 资源"
# ---------------------------------------------------------------------------

# 内存：test-network 起 5 个容器（2 peer + orderer + 2 ca）+ 链码容器，4 GB 是底线
MEM_TOTAL_KB="$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
MEM_TOTAL_GB=$((MEM_TOTAL_KB / 1024 / 1024))
if [[ ${MEM_TOTAL_GB} -ge 4 ]]; then
  ok "内存 ${MEM_TOTAL_GB} GB（>= 4 GB）"
else
  bad "内存仅 ${MEM_TOTAL_GB} GB，低于 4 GB 下限"
  note "test-network 默认起 5 个容器，内存不足会导致容器被 OOM 杀掉。"
  note "请把虚拟机内存调到 4 GB 以上（建议 6-8 GB）。"
fi

# 磁盘：镜像 1.4 GB + 样例 + 构建缓存，10 GB 是安全线
AVAIL_KB="$(df -Pk / | awk 'NR==2 {print $4}')"
AVAIL_GB=$((AVAIL_KB / 1024 / 1024))
if [[ ${AVAIL_GB} -ge 10 ]]; then
  ok "/ 可用空间 ${AVAIL_GB} GB（>= 10 GB）"
else
  bad "/ 可用空间仅 ${AVAIL_GB} GB，低于 10 GB"
  note "清理空间：docker system prune -a（会删除未使用的镜像与容器）"
fi

CPU_COUNT="$(nproc 2>/dev/null || echo 1)"
if [[ ${CPU_COUNT} -ge 2 ]]; then
  ok "CPU ${CPU_COUNT} 核"
else
  warn "CPU 仅 ${CPU_COUNT} 核，链码构建会较慢"
fi

# ---------------------------------------------------------------------------
section "6. 仓库与链码源码"
# ---------------------------------------------------------------------------

if [[ -d "${CHAINPROOF_REPO_DIR}/.git" ]]; then
  ok "仓库根目录：${CHAINPROOF_REPO_DIR}"
else
  warn "${CHAINPROOF_REPO_DIR} 下未发现 .git，可能不是仓库根目录"
fi

if [[ -f "${CHAINCODE_SRC_DIR}/package.json" ]]; then
  ok "链码源码：${CHAINCODE_SRC_DIR}"
else
  bad "未找到链码源码 ${CHAINCODE_SRC_DIR}/package.json"
  note "请确认已在仓库根目录之外正确放置 blockchain/chaincode。"
fi

if [[ -f "${CHAINCODE_SRC_DIR}/lib/chainproof-contract.js" ]]; then
  ok "合约文件存在"
else
  bad "缺少 lib/chainproof-contract.js"
fi

# ---------------------------------------------------------------------------
section "7. 网络端口占用"
# ---------------------------------------------------------------------------

# test-network 固定使用这些端口，被占用会导致容器起不来
PORTS=(7050 7051 7052 7053 9051 9052 5054)
PORT_TOOL=""
if command -v ss >/dev/null 2>&1; then PORT_TOOL="ss"
elif command -v netstat >/dev/null 2>&1; then PORT_TOOL="netstat"
fi

if [[ -n "${PORT_TOOL}" ]]; then
  CONFLICT=0
  for port in "${PORTS[@]}"; do
    if [[ "${PORT_TOOL}" == "ss" ]]; then
      LISTENING="$(ss -Hltn "sport = :${port}" 2>/dev/null | head -1)"
    else
      LISTENING="$(netstat -ltn 2>/dev/null | awk -v p=":${port}" '$4 ~ p"$" {print; exit}')"
    fi
    if [[ -n "${LISTENING}" ]]; then
      warn "端口 ${port} 已被占用"
      CONFLICT=1
    fi
  done
  [[ ${CONFLICT} -eq 0 ]] && ok "Fabric 所需端口（${PORTS[*]}）均空闲"
  if [[ ${CONFLICT} -ne 0 ]]; then
    note "占用多半是上一次没关干净的 Fabric 容器："
    note "  ./chainproof-network.sh down"
    note "  docker ps -a --filter name='peer0|orderer|ca_' "
  fi
else
  warn "未找到 ss / netstat，跳过端口检查"
fi

# ---------------------------------------------------------------------------
section "自检结果"
# ---------------------------------------------------------------------------

if [[ ${FATAL_COUNT} -gt 0 ]]; then
  printf "\n${C_RED:-}环境自检未通过：${FATAL_COUNT} 个致命问题、${WARN_COUNT} 个警告。${C_RESET:-}\n"
  printf "请先修复上面标记为 FAIL 的项，再重新运行 ./chainproof-network.sh preflight\n\n"
  exit 1
fi

if [[ ${WARN_COUNT} -gt 0 ]]; then
  printf "\n${C_GREEN:-}环境自检通过${C_RESET:-}（${WARN_COUNT} 个警告，通常不阻塞）。可以继续 setup。\n\n"
else
  printf "\n${C_GREEN:-}环境自检全部通过，可以继续 setup。${C_RESET:-}\n\n"
fi
exit 0
