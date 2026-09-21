#!/usr/bin/env bash
#
# 准备 fabric-samples：clone/更新仓库 + 下载与 FABRIC_VERSION 对齐的二进制。
#
# 为什么要自己写这一步，而不直接用官方 install-fabric.sh：
#   1. 官方脚本默认拉 latest 镜像、装 main 分支样例，版本随时间漂移，
#      三个组员在不同日子跑会得到不同环境 —— 违背「版本固定」要求。
#   2. 官方脚本会 clone 到当前目录，不便于复用已有 fabric-samples。
#   3. 需要能识别并复用本机已有的 fabric-samples（例如放在
#      ~/hyperledger/fabric/scripts/fabric-samples 的旧安装），避免重复下载 1.4 GB。
#
# 幂等：重复运行不会重复下载，已就绪则快速跳过。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../config.env
source "${SCRIPT_DIR}/../config.env"

C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_BLUE='\033[0;34m'; C_RESET='\033[0m'
info()    { printf "${C_BLUE}==>${C_RESET} %s\n" "$*"; }
success() { printf "${C_GREEN}[OK]${C_RESET} %s\n" "$*"; }
warn()    { printf "${C_YELLOW}[WARN]${C_RESET} %s\n" "$*" >&2; }
fatal()   { printf "${C_RED}[FAIL]${C_RESET} %s\n" "$*" >&2; exit 1; }

SAMPLES_REPO="https://github.com/hyperledger/fabric-samples.git"

# ---------------------------------------------------------------------------
# 1. 定位或获取 fabric-samples
# ---------------------------------------------------------------------------

# 已存在的 fabric-samples 搜索顺序：
#   a) 用户显式指定的 FABRIC_SAMPLES_DIR
#   b) 常见历史安装位置（避免重复下载）
find_existing_samples() {
  local candidates=(
    "${FABRIC_SAMPLES_DIR}"
    "${HOME}/fabric-samples"
    "${HOME}/hyperledger/fabric/scripts/fabric-samples"
    "/opt/fabric-samples"
  )
  local dir
  for dir in "${candidates[@]}"; do
    if [[ -d "${dir}/test-network" && -d "${dir}/bin" ]]; then
      echo "${dir}"
      return 0
    fi
  done
  return 1
}

EXISTING="$(find_existing_samples || true)"

if [[ -n "${EXISTING}" && -d "${EXISTING}/test-network" ]]; then
  if [[ "$(cd "${EXISTING}" && pwd)" != "$(cd "${FABRIC_SAMPLES_DIR}" && pwd 2>/dev/null || echo)" ]]; then
    info "复用已存在的 fabric-samples：${EXISTING}"
    # 更新 config.env 派生变量，供后续脚本使用
    FABRIC_SAMPLES_DIR="${EXISTING}"
    TEST_NETWORK_DIR="${FABRIC_SAMPLES_DIR}/test-network"
  else
    info "使用 fabric-samples：${FABRIC_SAMPLES_DIR}"
  fi
else
  info "克隆 fabric-samples 到 ${FABRIC_SAMPLES_DIR}"
  mkdir -p "$(dirname "${FABRIC_SAMPLES_DIR}")"
  git -c core.autocrlf=false clone --depth 50 "${SAMPLES_REPO}" "${FABRIC_SAMPLES_DIR}" \
    || fatal "克隆 fabric-samples 失败，请检查网络或代理设置。"
  FABRIC_SAMPLES_DIR="${FABRIC_SAMPLES_DIR}"
  TEST_NETWORK_DIR="${FABRIC_SAMPLES_DIR}/test-network"
fi

cd "${FABRIC_SAMPLES_DIR}"
# 防止后续切换 ref 时被用户的全局 core.autocrlf=true 转回 CRLF。
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git config core.autocrlf false
fi

# ---------------------------------------------------------------------------
# 2. 检出指定 ref
# ---------------------------------------------------------------------------
#
# 实测：fabric-samples 仓库没有 v2.5.x tag（最新只到 v2.4.9），
# 所以默认 ref 是 main。若用户显式指定了不存在的 ref，必须给出清晰报错，
# 而不是让 git 抛出一句难懂的 fatal。

CURRENT_DESC="$(git describe --tags --always 2>/dev/null || echo unknown)"
info "当前 samples 版本：${CURRENT_DESC}"

if [[ "${FABRIC_SAMPLES_REF}" == "main" ]]; then
  # main 分支：仅在有网络时尝试快进，失败不阻塞（离线可用已有副本）
  if git fetch --quiet origin main 2>/dev/null; then
    git checkout --quiet main 2>/dev/null || warn "切换到 main 失败，继续使用当前 HEAD"
    git merge --ff-only --quiet origin/main 2>/dev/null || warn "main 无法快进（可能有本地改动），继续使用当前 HEAD"
    success "samples 已同步到 main 最新"
  else
    warn "无法访问 GitHub，使用本地已有的 samples 副本继续"
  fi
else
  if git rev-parse --verify --quiet "refs/tags/${FABRIC_SAMPLES_REF}" >/dev/null \
     || git rev-parse --verify --quiet "${FABRIC_SAMPLES_REF}" >/dev/null; then
    git checkout --quiet "${FABRIC_SAMPLES_REF}"
    success "已检出 samples ref：${FABRIC_SAMPLES_REF}"
  else
    # 尝试从远端拉取该 ref
    if git fetch --quiet --tags origin 2>/dev/null \
       && git rev-parse --verify --quiet "${FABRIC_SAMPLES_REF}" >/dev/null; then
      git checkout --quiet "${FABRIC_SAMPLES_REF}"
      success "已从远端检出 samples ref：${FABRIC_SAMPLES_REF}"
    else
      fatal "fabric-samples 中不存在 ref「${FABRIC_SAMPLES_REF}」。
      实测该仓库没有 v2.5.x 的 tag（最新只到 v2.4.9），因此不能用 FABRIC_VERSION 拼 ref。
      请改用 main，或指定 config.env 中记录的已验证 commit：
        FABRIC_SAMPLES_REF=${CHAINPROOF_VERIFIED_SAMPLES_COMMIT} ./chainproof-network.sh setup"
    fi
  fi
fi

# 已有 samples 可能在全局 core.autocrlf=true 下检出为 CRLF。
# 改 Git 配置不会修复已检出的文件，先给出明确报错而不是等 bash\r 异常。
for required_lf in network.sh network.config scripts/envVar.sh; do
  if [[ -f "${TEST_NETWORK_DIR}/${required_lf}" ]] \
    && LC_ALL=C grep -q $'\r' "${TEST_NETWORK_DIR}/${required_lf}"; then
    fatal "${TEST_NETWORK_DIR}/${required_lf} 使用 CRLF；请先将已有 fabric-samples 的 test-network 文本转换为 LF 后重试。"
  fi
done

# ---------------------------------------------------------------------------
# 3. 下载与 FABRIC_VERSION 严格对齐的二进制
# ---------------------------------------------------------------------------

OS="$(uname -s | tr '[:upper:]' '[:lower:]' | sed 's/mingw64_nt.*/windows/')"
ARCH="$(uname -m | sed -e 's/x86_64/amd64/' -e 's/aarch64/arm64/')"
PLATFORM="${OS}-${ARCH}"

FABRIC_BINARY_URL="https://github.com/hyperledger/fabric/releases/download/v${FABRIC_VERSION}/hyperledger-fabric-${PLATFORM}-${FABRIC_VERSION}.tar.gz"
CA_BINARY_URL="https://github.com/hyperledger/fabric-ca/releases/download/v${FABRIC_CA_VERSION}/hyperledger-fabric-ca-${PLATFORM}-${FABRIC_CA_VERSION}.tar.gz"

# 版本标记文件：记录 bin 下二进制对应哪个版本，用于幂等判断
VERSION_MARKER="${FABRIC_SAMPLES_DIR}/.chainproof-fabric-version"

need_download() {
  # 缺 peer 就必须下载
  [[ ! -x "${FABRIC_SAMPLES_DIR}/bin/peer" ]] && return 0
  # 版本不匹配也必须重下（避免 samples 自带 v2.5.0 与镜像 2.5.16 out of sync）
  if [[ -f "${VERSION_MARKER}" ]]; then
    local recorded
    recorded="$(cat "${VERSION_MARKER}")"
    [[ "${recorded}" != "${FABRIC_VERSION}/${FABRIC_CA_VERSION}" ]] && return 0
    return 1
  fi
  # 有 peer 但没有标记文件：说明是别处装来的，检查真实版本
  local local_ver
  local_ver="$("${FABRIC_SAMPLES_DIR}/bin/peer" version 2>/dev/null | sed -ne 's/^ Version: v\?//p' | head -1)"
  [[ "${local_ver}" != "${FABRIC_VERSION}" ]] && return 0
  return 1
}

if need_download; then
  LOCAL_VER="$("${FABRIC_SAMPLES_DIR}/bin/peer" version 2>/dev/null | sed -ne 's/^ Version: //p' | head -1 || echo none)"
  info "下载 Fabric v${FABRIC_VERSION} 二进制（当前为 ${LOCAL_VER}）"
  note_out_of_sync() {
    warn "二进制与镜像版本不一致会触发 network.sh 的 out-of-sync 告警，"
    warn "并可能导致 configtx 格式差异。这里强制对齐到 ${FABRIC_VERSION}。"
  }
  [[ "${LOCAL_VER}" != "none" && "${LOCAL_VER}" != "v${FABRIC_VERSION}" ]] && note_out_of_sync

  info "  -> hyperledger-fabric-${PLATFORM}-${FABRIC_VERSION}.tar.gz"
  curl -fsSL --retry 5 --retry-delay 3 "${FABRIC_BINARY_URL}" | tar xz -C "${FABRIC_SAMPLES_DIR}" \
    || fatal "下载 Fabric 二进制失败：${FABRIC_BINARY_URL}"

  info "  -> hyperledger-fabric-ca-${PLATFORM}-${FABRIC_CA_VERSION}.tar.gz"
  curl -fsSL --retry 5 --retry-delay 3 "${CA_BINARY_URL}" | tar xz -C "${FABRIC_SAMPLES_DIR}" \
    || fatal "下载 Fabric CA 二进制失败：${CA_BINARY_URL}"

  echo "${FABRIC_VERSION}/${FABRIC_CA_VERSION}" > "${VERSION_MARKER}"
  success "二进制已对齐到 Fabric v${FABRIC_VERSION} / CA v${FABRIC_CA_VERSION}"
else
  success "二进制已是 v${FABRIC_VERSION} / CA v${FABRIC_CA_VERSION}，跳过下载"
fi

# ---------------------------------------------------------------------------
# 4. 校验关键二进制
# ---------------------------------------------------------------------------

info "校验二进制"
MISSING_BIN=()
for bin in peer orderer configtxgen cryptogen osnadmin fabric-ca-client; do
  if [[ -x "${FABRIC_SAMPLES_DIR}/bin/${bin}" ]]; then
    ok_line="  ${bin}"
    printf "${C_GREEN}  [OK]${C_RESET} %s\n" "${bin}"
  else
    MISSING_BIN+=("${bin}")
    printf "${C_RED}  [MISS]${C_RESET} %s\n" "${bin}"
  fi
done
[[ ${#MISSING_BIN[@]} -gt 0 ]] && fatal "缺少二进制：${MISSING_BIN[*]}"

PEER_VER="$("${FABRIC_SAMPLES_DIR}/bin/peer" version | sed -ne 's/^ Version: //p' | head -1)"
info "peer 版本：${PEER_VER}"
if [[ "${PEER_VER}" != "v${FABRIC_VERSION}" ]]; then
  warn "peer 版本（${PEER_VER}）与目标 v${FABRIC_VERSION} 不一致，请检查下载是否成功"
fi

# checkPrereqs 要求 test-network 的上一级存在 config 目录
if [[ ! -d "${FABRIC_SAMPLES_DIR}/config" ]]; then
  fatal "缺少 ${FABRIC_SAMPLES_DIR}/config 目录，network.sh 的 checkPrereqs 会失败"
fi
success "config 目录存在"

# ---------------------------------------------------------------------------
# 5. 镜像（存在即跳过，缺失才拉）
# ---------------------------------------------------------------------------

info "检查 Docker 镜像（版本 ${FABRIC_VERSION} / CA ${FABRIC_CA_VERSION}）"
if docker info >/dev/null 2>&1; then
  IMAGES=(
    "hyperledger/fabric-peer:${FABRIC_VERSION}"
    "hyperledger/fabric-orderer:${FABRIC_VERSION}"
    "hyperledger/fabric-ccenv:${FABRIC_VERSION}"
    "hyperledger/fabric-baseos:${FABRIC_VERSION}"
    "hyperledger/fabric-ca:${FABRIC_CA_VERSION}"
  )
  for image in "${IMAGES[@]}"; do
    if docker image inspect "${image}" >/dev/null 2>&1; then
      printf "${C_GREEN}  [OK]${C_RESET} %s\n" "${image}"
    else
      info "  拉取 ${image}（首次约 1.4 GB，请耐心等待）"
      docker pull "${image}" || fatal "拉取镜像失败：${image}"
      # network.sh 与 deployCC.sh 会用 hyperledger/fabric-xxx:latest 与 :2.5 之类的短标签，
      # 补打标签避免它去拉取一个我们没固定版本的 latest。
      SHORT_TAG="${image%:*}"
      docker tag "${image}" "${SHORT_TAG}:latest" 2>/dev/null || true
      docker tag "${image}" "${SHORT_TAG}:$(echo "${FABRIC_VERSION}" | cut -d. -f1,2)" 2>/dev/null || true
      printf "${C_GREEN}  [OK]${C_RESET} %s（已补打 latest 与 2.x 标签）\n" "${image}"
    fi
  done
  success "镜像检查完成"
else
  warn "Docker 不可用，跳过镜像检查（preflight 会报错）"
fi

# ---------------------------------------------------------------------------
# 6. 输出结果供后续脚本使用
# ---------------------------------------------------------------------------

cat <<EOF

${C_GREEN}fabric-samples 已就绪${C_RESET}
  目录      : ${FABRIC_SAMPLES_DIR}
  test-net  : ${TEST_NETWORK_DIR}
  peer 版本 : ${PEER_VER}
  镜像/CA   : ${FABRIC_VERSION} / ${FABRIC_CA_VERSION}

下一步：./chainproof-network.sh up

EOF

# 把最终确定的 samples 目录写到一个临时文件，供同一次 setup 流程里的后续脚本读取。
# 不能靠环境变量传递：chainproof-network.sh 是分多次 bash 调用子脚本的。
mkdir -p "${HOME}/.chainproof"
printf '%s\n' "${FABRIC_SAMPLES_DIR}" > "${HOME}/.chainproof/samples-dir"
