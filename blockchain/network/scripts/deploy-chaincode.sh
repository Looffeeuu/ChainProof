#!/usr/bin/env bash
#
# 部署 ChainProof 链码到 chainproof 通道（Issue #1 / Issue #2 验收链路）
#
# 关键设计：
#   1. 先把链码复制到 Linux 原生文件系统的暂存目录再打包。
#      在 WSL2 上仓库常位于 /mnt/c、/mnt/e 这类 9P 挂载路径，
#      直接从那里打包会很慢，且 npm install 可能因可执行位丢失而失败。
#   2. 打包时排除 node_modules / coverage / test：
#      peer 会在 ccenv 容器内按 package.json + package-lock.json 重新 npm install，
#      带上宿主机的 node_modules 只会让包体暴涨且可能引入平台相关的二进制。
#   3. 不传 -cci：本合约没有 Init 函数。
#      network.sh 在 CC_INIT_FCN=NA 时不会加 --init-required，这正是我们要的。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../config.env
source "${SCRIPT_DIR}/../config.env"

C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_BLUE='\033[0;34m'; C_RESET='\033[0m'
info()    { printf "${C_BLUE}==>${C_RESET} %s\n" "$*"; }
success() { printf "${C_GREEN}[OK]${C_RESET} %s\n" "$*"; }
warn()    { printf "${C_YELLOW}[WARN]${C_RESET} %s\n" "$*" >&2; }
fatal()   { printf "${C_RED}[FAIL]${C_RESET} %s\n" "$*" >&2; exit 1; }

resolve_samples_dir() {
  local recorded="${HOME}/.chainproof/samples-dir"
  if [[ -n "${FABRIC_SAMPLES_DIR:-}" && -d "${FABRIC_SAMPLES_DIR}/test-network" ]]; then
    echo "${FABRIC_SAMPLES_DIR}"; return 0
  fi
  if [[ -f "${recorded}" ]]; then
    local dir; dir="$(cat "${recorded}")"
    [[ -d "${dir}/test-network" ]] && { echo "${dir}"; return 0; }
  fi
  return 1
}

SAMPLES_DIR="$(resolve_samples_dir)" \
  || fatal "找不到 fabric-samples。请先运行：./chainproof-network.sh setup"
TEST_NETWORK_DIR="${SAMPLES_DIR}/test-network"

export PATH="${SAMPLES_DIR}/bin:${PATH}"
export FABRIC_CFG_PATH="${TEST_NETWORK_DIR}/configtx"

# ---------------------------------------------------------------------------
# 1. 前置校验
# ---------------------------------------------------------------------------

[[ -f "${CHAINCODE_SRC_DIR}/package.json" ]] \
  || fatal "未找到链码源码：${CHAINCODE_SRC_DIR}/package.json"
[[ -f "${CHAINCODE_SRC_DIR}/lib/chainproof-contract.js" ]] \
  || fatal "未找到合约文件：${CHAINCODE_SRC_DIR}/lib/chainproof-contract.js"

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^peer0.org1.example.com$'; then
  fatal "网络未启动。请先运行：./chainproof-network.sh up"
fi

# 通道必须已存在，否则 deployCC 会在 commit 阶段失败并给出难懂的报错
cd "${TEST_NETWORK_DIR}"
# shellcheck source=/dev/null
source scripts/envVar.sh
setGlobals 1 >/dev/null
if ! peer channel list 2>/dev/null | grep -q "${CHANNEL_NAME}"; then
  fatal "通道 ${CHANNEL_NAME} 不存在。请先运行：./chainproof-network.sh up"
fi
success "网络与通道 ${CHANNEL_NAME} 就绪"

# ---------------------------------------------------------------------------
# 2. 准备链码暂存目录
# ---------------------------------------------------------------------------

info "准备链码暂存目录 ${CHAINCODE_STAGE_DIR}"
mkdir -p "$(dirname "${CHAINCODE_STAGE_DIR}")"
rm -rf "${CHAINCODE_STAGE_DIR}"
mkdir -p "${CHAINCODE_STAGE_DIR}"

# 只复制链码运行必需的内容
for item in package.json package-lock.json index.js lib; do
  if [[ -e "${CHAINCODE_SRC_DIR}/${item}" ]]; then
    cp -R "${CHAINCODE_SRC_DIR}/${item}" "${CHAINCODE_STAGE_DIR}/"
  else
    warn "源目录缺少 ${item}（若为 package-lock.json 可忽略，但会导致依赖版本浮动）"
  fi
done

[[ -f "${CHAINCODE_STAGE_DIR}/index.js" ]] || fatal "暂存目录缺少 index.js"
[[ -d "${CHAINCODE_STAGE_DIR}/lib" ]]      || fatal "暂存目录缺少 lib/"

# 显式确认没有把 node_modules 带进去
if [[ -d "${CHAINCODE_STAGE_DIR}/node_modules" ]]; then
  warn "暂存目录里出现了 node_modules，已移除（peer 会在容器内重新安装依赖）"
  rm -rf "${CHAINCODE_STAGE_DIR}/node_modules"
fi
success "链码已复制到暂存目录（不含 node_modules / test / coverage）"

# 校验暂存目录里的 package.json 依赖版本是固定的，不是 latest
if grep -q '"latest"' "${CHAINCODE_STAGE_DIR}/package.json"; then
  fatal "链码 package.json 里存在 \"latest\" 依赖，违反版本固定要求。请改成具体版本号。"
fi
success "链码依赖版本已固定（无 latest）"

# ---------------------------------------------------------------------------
# 3. 部署
# ---------------------------------------------------------------------------

info "部署链码：name=${CC_NAME} lang=${CC_SRC_LANGUAGE} version=${CC_VERSION} sequence=${CC_SEQUENCE}"
# 不传 -cci：合约没有 Init 函数，CC_INIT_FCN 保持默认 NA，
# network.sh 因此不会加 --init-required。
./network.sh deployCC \
  -c "${CHANNEL_NAME}" \
  -ccn "${CC_NAME}" \
  -ccp "${CHAINCODE_STAGE_DIR}" \
  -ccl "${CC_SRC_LANGUAGE}" \
  -ccv "${CC_VERSION}" \
  -ccs "${CC_SEQUENCE}" \
  -i "${FABRIC_VERSION}" \
  -cai "${FABRIC_CA_VERSION}" \
  -r "${MAX_RETRY}" \
  -d "${CLI_DELAY}"

# ---------------------------------------------------------------------------
# 4. 独立校验（不轻信 deployCC 的退出码）
# ---------------------------------------------------------------------------

info "校验链码定义已提交到通道"
setGlobals 1 >/dev/null
COMMITTED="$(peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CC_NAME}" 2>/dev/null || true)"
if echo "${COMMITTED}" | grep -q "Name: ${CC_NAME}"; then
  success "链码已提交：$(echo "${COMMITTED}" | grep "Name: ${CC_NAME}" | sed 's/^ *//')"
else
  fatal "链码 ${CC_NAME} 未提交到通道 ${CHANNEL_NAME}。deployCC 输出如下时请检查上面的日志。"
fi

info "用一次真实查询验证链码可执行"
# 查询一个不存在的项目：期望合约抛出 PROJECT_NOT_FOUND。
# 这一步同时验证了两件事：
#   a) 链码容器能成功构建并启动（JS 链码首次调用要跑 npm install，耗时较久）；
#   b) 我们的合约代码真的被执行了（错误 message 带上了自定义的 CODE 前缀）。
QUERY_OUT="$(peer chaincode query \
  -C "${CHANNEL_NAME}" -n "${CC_NAME}" \
  -c '{"function":"GetProject","Args":["__CHAINPROOF_PREFLIGHT__"]}' 2>&1 || true)"

if echo "${QUERY_OUT}" | grep -q "PROJECT_NOT_FOUND"; then
  success "链码执行正常（按预期返回 PROJECT_NOT_FOUND）"
elif echo "${QUERY_OUT}" | grep -qi "Error:.*does not exist"; then
  success "链码执行正常（返回项目不存在错误）"
else
  warn "首次查询未返回预期错误，输出如下："
  echo "${QUERY_OUT}" | sed 's/^/    /'
  warn "若提示 chaincode install failed / could not build，多半是 ccenv 容器内 npm install 失败。"
  warn "排查：docker logs dev-peer0.org1.example.com-${CC_NAME}* 2>&1 | tail -50"
fi

cat <<EOF

${C_GREEN}链码部署完成${C_RESET}
  通道   : ${CHANNEL_NAME}
  链码名 : ${CC_NAME}
  版本   : ${CC_VERSION} / sequence ${CC_SEQUENCE}

下一步：./chainproof-network.sh smoke
      （跑完整业务链路：建项目 → 建里程碑 → 三人确认 → VERIFIED → 签发证书 → 验证）

EOF
