#!/usr/bin/env bash
#
# ChainProof 链码冒烟测试（Issue #1 + Issue #2 验收）
#
# 在真实 Fabric 通道上跑完整业务链路，逐项断言：
#   CreateProject → GetProject → CreateMilestone → 提交者以外成员 ConfirmContribution
#   → VERIFIED → GetProjectMilestones → GetProjectContributions
#   → IssueCertificate → VerifyCertificate
# 并验证独立确认状态机的负向规则：
#   SUBMITTER_CANNOT_CONFIRM / MEMBER_NOT_REVIEWER / ALREADY_DECIDED / MILESTONE_CLOSED
#
# 为什么需要这个脚本而不只靠单元测试：
#   单元测试用的是 mock stub。mock 与真实 peer 在复合键、范围查询、
#   背书与交易时间戳上仍可能存在差异。只有真实链上跑通，才算 Issue #1 验收通过。
#
# 幂等：每次运行使用带时间戳的新 ID，不会与上一次的数据冲突。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../config.env
source "${SCRIPT_DIR}/../config.env"

C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_BLUE='\033[0;34m'; C_RESET='\033[0m'
info()    { printf "${C_BLUE}==>${C_RESET} %s\n" "$*"; }
fatal()   { printf "${C_RED}[FAIL]${C_RESET} %s\n" "$*" >&2; exit 1; }

PASS_COUNT=0
FAIL_COUNT=0
FAILED_CASES=()

pass() { printf "  ${C_GREEN}[PASS]${C_RESET} %s\n" "$*"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { printf "  ${C_RED}[FAIL]${C_RESET} %s\n" "$*"; FAIL_COUNT=$((FAIL_COUNT + 1)); FAILED_CASES+=("$*"); }

# ---------------------------------------------------------------------------
# 环境准备
# ---------------------------------------------------------------------------

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

cd "${TEST_NETWORK_DIR}"
export PATH="${SAMPLES_DIR}/bin:${PATH}"
export FABRIC_CFG_PATH="${SAMPLES_DIR}/config"

command -v jq >/dev/null 2>&1 || fatal "需要 jq 来安全构造交易参数：sudo apt-get install -y jq"
# shellcheck source=/dev/null
source scripts/envVar.sh
setGlobals 1 >/dev/null

peer channel list 2>/dev/null | grep -q "${CHANNEL_NAME}" \
  || fatal "通道 ${CHANNEL_NAME} 不存在。请先运行：./chainproof-network.sh up"
peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CC_NAME}" >/dev/null 2>&1 \
  || fatal "链码 ${CC_NAME} 未提交到通道。请先运行：./chainproof-network.sh deploy"

info "开始冒烟测试：channel=${CHANNEL_NAME} chaincode=${CC_NAME}"

# 双组织背书：test-network 默认背书策略需要两个组织的多数派，
# 因此 invoke 必须同时指定 org1 与 org2 的 peer。
PEER_CONN_PARMS=(
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PEER0_ORG1_CA}"
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PEER0_ORG2_CA}"
)

# ---------------------------------------------------------------------------
# 交易辅助
# ---------------------------------------------------------------------------

# 提交交易（写操作）。用 jq 构造参数，避免中文与嵌套 JSON 的转义问题。
# 用法：invoke_tx <functionName> <arg1> <arg2> ...
# 结果写入全局 TX_OUT，退出码写入 TX_RC
invoke_tx() {
  local fn="$1"; shift
  local args_json
  args_json="$(jq -n --arg fn "${fn}" --args '{function: $fn, Args: $ARGS.positional}' "$@")"

  TX_OUT="$(peer chaincode invoke \
    -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
    --tls --cafile "${ORDERER_CA}" \
    -C "${CHANNEL_NAME}" -n "${CC_NAME}" \
    "${PEER_CONN_PARMS[@]}" \
    --waitForEvent \
    -c "${args_json}" 2>&1)"
  TX_RC=$?
  return ${TX_RC}
}

# 查询（读操作）
query_tx() {
  local fn="$1"; shift
  local args_json
  args_json="$(jq -n --arg fn "${fn}" --args '{function: $fn, Args: $ARGS.positional}' "$@")"

  TX_OUT="$(peer chaincode query \
    -C "${CHANNEL_NAME}" -n "${CC_NAME}" \
    -c "${args_json}" 2>&1)"
  TX_RC=$?
  return ${TX_RC}
}

# 断言查询返回的 JSON 中某字段等于期望值
assert_json_field() {
  local label="$1" json="$2" filter="$3" expected="$4"
  local actual
  actual="$(printf '%s' "${json}" | jq -r "${filter}" 2>/dev/null || echo "<jq-parse-error>")"
  if [[ "${actual}" == "${expected}" ]]; then
    pass "${label}（${filter}=${actual}）"
  else
    fail "${label}：期望 ${filter}=${expected}，实际=${actual}"
  fi
}

# 断言某次调用失败且错误码匹配
assert_error_code() {
  local label="$1" output="$2" rc="$3" expected_code="$4"
  if [[ ${rc} -ne 0 ]] && printf '%s' "${output}" | grep -q "${expected_code}"; then
    pass "${label}（按预期报 ${expected_code}）"
  elif [[ ${rc} -eq 0 ]]; then
    fail "${label}：期望失败并报 ${expected_code}，但调用成功了"
  else
    fail "${label}：期望错误码 ${expected_code}，实际输出：$(printf '%s' "${output}" | tail -2 | tr '\n' ' ')"
  fi
}

# ---------------------------------------------------------------------------
# 测试数据
# ---------------------------------------------------------------------------

RUN_ID="$(date +%Y%m%d%H%M%S)"
PROJECT_ID="P${RUN_ID}"
MILESTONE_ID="M${RUN_ID}"
CERT_ID="CP-${RUN_ID}"

# 合法的 SHA-256（64 位小写十六进制）
FILE_HASH="$(printf 'chainproof-smoke-%s' "${RUN_ID}" | sha256sum | awk '{print $1}')"

# alice 70 / bob 30；charlie 未列入 contributors，但仍是独立确认人。
# 这组数据直接验证“确认资格与贡献分配无关”。
CONTRIBUTORS_ALICE='[{"memberId":"alice","percentage":70},{"memberId":"bob","percentage":30}]'
CONTRIBUTORS_BAD_TOTAL='[{"memberId":"alice","percentage":50},{"memberId":"bob","percentage":47}]'

echo
info "本次测试标识：project=${PROJECT_ID} milestone=${MILESTONE_ID} cert=${CERT_ID}"
info "文件哈希：${FILE_HASH}"
echo

# ---------------------------------------------------------------------------
# 用例 1：负向 —— 项目不存在
# ---------------------------------------------------------------------------

printf "\n${C_BLUE}--- 1. 读取不存在的项目${C_RESET}\n"
query_tx "GetProject" "${PROJECT_ID}" >/dev/null 2>&1
assert_error_code "GetProject 对不存在的项目" "${TX_OUT}" "${TX_RC}" "PROJECT_NOT_FOUND"

# ---------------------------------------------------------------------------
# 用例 2：CreateProject → GetProject（Issue #1 的核心验收链路）
# ---------------------------------------------------------------------------

printf "\n${C_BLUE}--- 2. CreateProject → GetProject${C_RESET}\n"
MEMBERS_JSON='["alice","bob","charlie"]'

info "提交 CreateProject"
invoke_tx "CreateProject" "${PROJECT_ID}" "ChainProof Demo" "课程演示项目" "alice" "${MEMBERS_JSON}" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  pass "CreateProject 交易提交成功"
  TX_ID="$(printf '%s' "${TX_OUT}" | grep -o 'transaction ID: [a-f0-9]*' | head -1 | awk '{print $3}')"
  [[ -n "${TX_ID}" ]] && info "  txId = ${TX_ID}"
else
  fail "CreateProject 提交失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

query_tx "GetProject" "${PROJECT_ID}" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  pass "GetProject 查询成功"
  PROJECT_JSON="${TX_OUT}"
  assert_json_field "Project.projectId"  "${PROJECT_JSON}" '.projectId'  "${PROJECT_ID}"
  assert_json_field "Project.name"       "${PROJECT_JSON}" '.name'       "ChainProof Demo"
  assert_json_field "Project.ownerId"    "${PROJECT_JSON}" '.ownerId'    "alice"
  assert_json_field "Project.status"     "${PROJECT_JSON}" '.status'     "ACTIVE"
  assert_json_field "Project.members 数量" "${PROJECT_JSON}" '.members | length' "3"
  assert_json_field "Project.createdAt 非空" "${PROJECT_JSON}" '(.createdAt | length) > 0' "true"
  assert_json_field "Project.txId 非空"  "${PROJECT_JSON}" '(.txId | length) > 0' "true"
else
  fail "GetProject 查询失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

# 重复创建必须被拒
invoke_tx "CreateProject" "${PROJECT_ID}" "dup" "dup" "bob" "${MEMBERS_JSON}" >/dev/null 2>&1
assert_error_code "重复 CreateProject 被拒" "${TX_OUT}" "${TX_RC}" "VALIDATION_ERROR"

# ---------------------------------------------------------------------------
# 用例 3：CreateMilestone（含哈希与比例校验）
# ---------------------------------------------------------------------------

printf "\n${C_BLUE}--- 3. CreateMilestone 与参数校验${C_RESET}\n"

# 非法比例总和（97%）
invoke_tx "CreateMilestone" "${MILESTONE_ID}-bad" "${PROJECT_ID}" "t" "d" "f.zip" "${FILE_HASH}" "${CONTRIBUTORS_BAD_TOTAL}" "alice" >/dev/null 2>&1
assert_error_code "比例总和 97% 被拒" "${TX_OUT}" "${TX_RC}" "CONTRIBUTION_TOTAL_INVALID"

# 非法哈希
invoke_tx "CreateMilestone" "${MILESTONE_ID}-bad2" "${PROJECT_ID}" "t" "d" "f.zip" "not-a-sha256" "${CONTRIBUTORS_ALICE}" "alice" >/dev/null 2>&1
assert_error_code "非法 fileHash 被拒" "${TX_OUT}" "${TX_RC}" "VALIDATION_ERROR"

# 不存在的成员
invoke_tx "CreateMilestone" "${MILESTONE_ID}-bad3" "${PROJECT_ID}" "t" "d" "f.zip" "${FILE_HASH}" \
  '[{"memberId":"alice","percentage":50},{"memberId":"mallory","percentage":50}]' "alice" >/dev/null 2>&1
assert_error_code "非项目成员作为贡献者被拒" "${TX_OUT}" "${TX_RC}" "VALIDATION_ERROR"

# 合法创建
info "提交 CreateMilestone（alice 70 / bob 30；charlie 0%，但仍需确认）"
invoke_tx "CreateMilestone" "${MILESTONE_ID}" "${PROJECT_ID}" "后端 API 开发" "第一阶段成果" "backend.zip" "${FILE_HASH}" "${CONTRIBUTORS_ALICE}" "alice" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  pass "CreateMilestone 交易提交成功"
else
  fail "CreateMilestone 提交失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

query_tx "GetMilestone" "${MILESTONE_ID}" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  MILESTONE_JSON="${TX_OUT}"
  assert_json_field "Milestone.status 初始值" "${MILESTONE_JSON}" '.status' "PENDING_CONFIRMATION"
  assert_json_field "Milestone.fileHash"     "${MILESTONE_JSON}" '.fileHash' "${FILE_HASH}"
  assert_json_field "Milestone.fileName"     "${MILESTONE_JSON}" '.fileName' "backend.zip"
  assert_json_field "Milestone.projectId"    "${MILESTONE_JSON}" '.projectId' "${PROJECT_ID}"
  assert_json_field "Milestone.submitterId" "${MILESTONE_JSON}" '.submitterId' "alice"
  assert_json_field "Milestone.requiredConfirmerIds" "${MILESTONE_JSON}" '.requiredConfirmerIds | join(",")' "bob,charlie"
  assert_json_field "Milestone.contributors 数量" "${MILESTONE_JSON}" '.contributors | length' "2"
  assert_json_field "Milestone.confirmations 初始为空" "${MILESTONE_JSON}" '.confirmations | length' "0"
  assert_json_field "alice 比例"             "${MILESTONE_JSON}" '.contributors[] | select(.memberId=="alice") | .percentage' "70"
  assert_json_field "bob 比例"               "${MILESTONE_JSON}" '.contributors[] | select(.memberId=="bob") | .percentage' "30"
  assert_json_field "charlie 未列入 contributors" "${MILESTONE_JSON}" '[.contributors[].memberId] | index("charlie") == null' "true"
else
  fail "GetMilestone 查询失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

# ---------------------------------------------------------------------------
# 用例 4：确认状态机
# ---------------------------------------------------------------------------

printf "\n${C_BLUE}--- 4. 贡献确认状态机${C_RESET}\n"

# 提交者不能确认自己的提交
invoke_tx "ConfirmContribution" "${MILESTONE_ID}" "alice" "CONFIRMED" >/dev/null 2>&1
assert_error_code "提交者自我确认被拒" "${TX_OUT}" "${TX_RC}" "SUBMITTER_CANNOT_CONFIRM"

# 非确认人表态
invoke_tx "ConfirmContribution" "${MILESTONE_ID}" "dave" "CONFIRMED" >/dev/null 2>&1
assert_error_code "非确认人表态被拒" "${TX_OUT}" "${TX_RC}" "MEMBER_NOT_REVIEWER"

# 非法 decision（由合法确认人触发）
invoke_tx "ConfirmContribution" "${MILESTONE_ID}" "bob" "MAYBE" >/dev/null 2>&1
assert_error_code "非法 decision 被拒" "${TX_OUT}" "${TX_RC}" "VALIDATION_ERROR"

# bob 确认 -> 仍是 PENDING_CONFIRMATION
info "bob 确认"
invoke_tx "ConfirmContribution" "${MILESTONE_ID}" "bob" "CONFIRMED" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  pass "bob 确认交易提交成功"
  query_tx "GetMilestone" "${MILESTONE_ID}" >/dev/null 2>&1
  assert_json_field "1/2 确认后状态" "${TX_OUT}" '.status' "PENDING_CONFIRMATION"
  assert_json_field "1/2 确认后记录数" "${TX_OUT}" '.confirmations | length' "1"
else
  fail "bob 确认失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

# bob 改票 -> ALREADY_DECIDED
invoke_tx "ConfirmContribution" "${MILESTONE_ID}" "bob" "REJECTED" >/dev/null 2>&1
assert_error_code "同一确认人改票被拒" "${TX_OUT}" "${TX_RC}" "ALREADY_DECIDED"

# charlie 未列入 contributors，但属于 requiredConfirmerIds；确认后应 VERIFIED
info "charlie（0%）确认（应触发 VERIFIED）"
invoke_tx "ConfirmContribution" "${MILESTONE_ID}" "charlie" "CONFIRMED" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  pass "charlie 确认交易提交成功"
  query_tx "GetMilestone" "${MILESTONE_ID}" >/dev/null 2>&1
  MILESTONE_JSON="${TX_OUT}"
  assert_json_field "2/2 确认后状态为 VERIFIED" "${MILESTONE_JSON}" '.status' "VERIFIED"
  assert_json_field "2/2 确认后记录数" "${MILESTONE_JSON}" '.confirmations | length' "2"
  assert_json_field "两位确认人均为 CONFIRMED" "${MILESTONE_JSON}" '[.confirmations[].decision] | unique | .[0]' "CONFIRMED"
  assert_json_field "确认后有 txId" "${MILESTONE_JSON}" '(.txId | length) > 0' "true"
else
  fail "charlie 确认失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

# 已关闭里程碑继续表态 -> MILESTONE_CLOSED
invoke_tx "ConfirmContribution" "${MILESTONE_ID}" "alice" "REJECTED" >/dev/null 2>&1
assert_error_code "VERIFIED 后继续表态被拒" "${TX_OUT}" "${TX_RC}" "MILESTONE_CLOSED"

# 确认过程不得篡改贡献比例与哈希
query_tx "GetMilestone" "${MILESTONE_ID}" >/dev/null 2>&1
assert_json_field "确认后 fileHash 未被篡改" "${TX_OUT}" '.fileHash' "${FILE_HASH}"
assert_json_field "确认后 alice 比例未变" "${TX_OUT}" '.contributors[] | select(.memberId=="alice") | .percentage' "70"

# ---------------------------------------------------------------------------
# 用例 5：REJECTED 分支
# ---------------------------------------------------------------------------

printf "\n${C_BLUE}--- 5. 拒绝分支${C_RESET}\n"

REJECTED_MID="MR${RUN_ID}"
invoke_tx "CreateMilestone" "${REJECTED_MID}" "${PROJECT_ID}" "被拒绝的里程碑" "d" "x.zip" "${FILE_HASH}" "${CONTRIBUTORS_ALICE}" "alice" >/dev/null 2>&1
[[ ${TX_RC} -eq 0 ]] && pass "创建待拒绝的里程碑" || fail "创建里程碑失败：$(printf '%s' "${TX_OUT}" | tail -2 | tr '\n' ' ')"

invoke_tx "ConfirmContribution" "${REJECTED_MID}" "bob" "REJECTED" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  query_tx "GetMilestone" "${REJECTED_MID}" >/dev/null 2>&1
  assert_json_field "单人拒绝即 REJECTED" "${TX_OUT}" '.status' "REJECTED"
else
  fail "拒绝表态提交失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

invoke_tx "ConfirmContribution" "${REJECTED_MID}" "charlie" "CONFIRMED" >/dev/null 2>&1
assert_error_code "REJECTED 后他人表态被拒" "${TX_OUT}" "${TX_RC}" "MILESTONE_CLOSED"

# ---------------------------------------------------------------------------
# 用例 6：项目里程碑列表与贡献统计
# ---------------------------------------------------------------------------

printf "\n${C_BLUE}--- 6. GetProjectMilestones / GetProjectContributions${C_RESET}\n"

query_tx "GetProjectMilestones" "${PROJECT_ID}" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  pass "GetProjectMilestones 查询成功"
  assert_json_field "里程碑数量为 2（1 VERIFIED + 1 REJECTED）" "${TX_OUT}" 'length' "2"
  MILESTONES_FILTER="[.[] | .milestoneId] | index(\"${MILESTONE_ID}\") != null"
  assert_json_field "包含本次 VERIFIED 里程碑" "${TX_OUT}" "${MILESTONES_FILTER}" "true"
  REJECTED_FILTER="[.[] | .milestoneId] | index(\"${REJECTED_MID}\") != null"
  assert_json_field "包含被拒绝的里程碑" "${TX_OUT}" "${REJECTED_FILTER}" "true"
  assert_json_field "列表按 createdAt 正序" "${TX_OUT}" \
    '[.[].createdAt] == ([.[].createdAt] | sort)' "true"
else
  fail "GetProjectMilestones 查询失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

query_tx "GetProjectContributions" "${PROJECT_ID}" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  pass "GetProjectContributions 查询成功"
  CONTRIB_JSON="${TX_OUT}"
  assert_json_field "统计只基于 1 条 VERIFIED 里程碑" "${CONTRIB_JSON}" '.basedOnMilestones' "1"
  assert_json_field "统计中的 alice 比例" "${CONTRIB_JSON}" '.members[] | select(.memberId=="alice") | .percentage' "70"
  assert_json_field "统计中的 bob 比例" "${CONTRIB_JSON}" '.members[] | select(.memberId=="bob") | .percentage' "30"
  assert_json_field "统计中的 charlie 比例" "${CONTRIB_JSON}" '.members[] | select(.memberId=="charlie") | .percentage' "0"
  assert_json_field "REJECTED 里程碑未计入统计" "${CONTRIB_JSON}" '.basedOnMilestones' "1"
else
  fail "GetProjectContributions 查询失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

query_tx "GetProjectHistory" "${PROJECT_ID}" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  pass "GetProjectHistory 查询成功"
  assert_json_field "历史记录至少 1 条" "${TX_OUT}" 'length >= 1' "true"
  assert_json_field "历史记录带 txId" "${TX_OUT}" '.[0].txId | length > 0' "true"
else
  fail "GetProjectHistory 查询失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

# ---------------------------------------------------------------------------
# 用例 7：证书签发与验证
# ---------------------------------------------------------------------------

printf "\n${C_BLUE}--- 7. IssueCertificate / VerifyCertificate${C_RESET}\n"

# 不存在的证书 -> NOT_FOUND（HTTP 200 语义，不是错误）
query_tx "VerifyCertificate" "CP-DOES-NOT-EXIST-${RUN_ID}" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  assert_json_field "不存在的证书返回 NOT_FOUND" "${TX_OUT}" '.verificationStatus' "NOT_FOUND"
  assert_json_field "NOT_FOUND 时回显 certificateId" "${TX_OUT}" '.certificateId' "CP-DOES-NOT-EXIST-${RUN_ID}"
else
  fail "VerifyCertificate 对不存在证书不应报错：$(printf '%s' "${TX_OUT}" | tail -2 | tr '\n' ' ')"
fi

info "提交 IssueCertificate（alice）"
invoke_tx "IssueCertificate" "${CERT_ID}" "${PROJECT_ID}" "alice" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  pass "IssueCertificate 交易提交成功"
  query_tx "GetCertificate" "${CERT_ID}" >/dev/null 2>&1
  if [[ ${TX_RC} -eq 0 ]]; then
    CERT_JSON="${TX_OUT}"
    assert_json_field "Certificate.certificateId" "${CERT_JSON}" '.certificateId' "${CERT_ID}"
    assert_json_field "Certificate.memberId" "${CERT_JSON}" '.memberId' "alice"
    assert_json_field "Certificate.projectId" "${CERT_JSON}" '.projectId' "${PROJECT_ID}"
    assert_json_field "Certificate.contributionPercentage" "${CERT_JSON}" '.contributionPercentage' "70"
    assert_json_field "Certificate.verificationStatus" "${CERT_JSON}" '.verificationStatus' "VALID"
    assert_json_field "Certificate 带 txId" "${CERT_JSON}" '(.txId | length) > 0' "true"
    CERT_MILESTONE_FILTER=".milestoneIds | index(\"${MILESTONE_ID}\") != null"
    assert_json_field "milestoneIds 含 VERIFIED 里程碑" "${CERT_JSON}" "${CERT_MILESTONE_FILTER}" "true"
    assert_json_field "milestoneIds 不含 REJECTED 里程碑" "${CERT_JSON}" \
      ".milestoneIds | index(\"${REJECTED_MID}\") == null" "true"
  else
    fail "GetCertificate 查询失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
  fi
else
  fail "IssueCertificate 提交失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

# 幂等：同一 project+member 重复签发返回已有证书
invoke_tx "IssueCertificate" "CP-DUP-${RUN_ID}" "${PROJECT_ID}" "alice" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  query_tx "GetCertificates" "${PROJECT_ID}" "alice" >/dev/null 2>&1
  assert_json_field "重复签发未产生新证书（仍为 1 张）" "${TX_OUT}" 'length' "1"
  assert_json_field "重复签发返回原 certificateId" "${TX_OUT}" '.[0].certificateId' "${CERT_ID}"
else
  fail "幂等签发调用失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

# 验证有效证书
query_tx "VerifyCertificate" "${CERT_ID}" >/dev/null 2>&1
if [[ ${TX_RC} -eq 0 ]]; then
  assert_json_field "有效证书验证为 VALID" "${TX_OUT}" '.verificationStatus' "VALID"
  assert_json_field "验证结果内嵌证书信息" "${TX_OUT}" '.certificate.memberId' "alice"
  assert_json_field "内嵌证书状态一致" "${TX_OUT}" '.certificate.verificationStatus' "VALID"
else
  fail "VerifyCertificate 查询失败：$(printf '%s' "${TX_OUT}" | tail -3 | tr '\n' ' ')"
fi

# 非项目成员签发被拒
invoke_tx "IssueCertificate" "CP-OUT-${RUN_ID}" "${PROJECT_ID}" "mallory" >/dev/null 2>&1
assert_error_code "非项目成员签发被拒" "${TX_OUT}" "${TX_RC}" "VALIDATION_ERROR"

# ---------------------------------------------------------------------------
# 汇总
# ---------------------------------------------------------------------------

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo
printf "========================================================================\n"
printf " 冒烟测试结果：%s通过 %d / 失败 %d / 共 %d%s\n" \
  "${C_GREEN}" "${PASS_COUNT}" "${FAIL_COUNT}" "${TOTAL}" "${C_RESET}"
printf "========================================================================\n"

if [[ ${FAIL_COUNT} -gt 0 ]]; then
  printf "\n${C_RED}失败用例：${C_RESET}\n"
  for case_name in "${FAILED_CASES[@]}"; do
    printf "  - %s\n" "${case_name}"
  done
  echo
  echo "排查建议："
  echo "  * 查看链码容器日志：docker logs \$(docker ps -q --filter name=dev-peer) 2>&1 | tail -60"
  echo "  * 确认网络状态    ：./chainproof-network.sh status"
  echo "  * 重新部署链码    ：./chainproof-network.sh deploy"
  exit 1
fi

cat <<EOF

${C_GREEN}Issue #1 / Issue #2 验收链路已在真实 Fabric 网络上跑通：${C_RESET}
  Fabric Network → 部署 ChainProof Chaincode → CreateProject → GetProject
  → CreateMilestone → 非提交者独立确认 → VERIFIED → 贡献统计 → 签发证书 → 验证 VALID

链上数据（可答辩时展示）：
  projectId     = ${PROJECT_ID}
  milestoneId   = ${MILESTONE_ID}（VERIFIED）
  certificateId = ${CERT_ID}（VALID）

EOF
exit 0
