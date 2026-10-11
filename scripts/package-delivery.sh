#!/usr/bin/env bash
# 课程最终交付打包（Issue #7）
#
# 用法（仓库根目录）：
#   bash scripts/package-delivery.sh
#
# 1. 敏感信息检查：已跟踪文件中不得出现私钥、Fabric 证书、.env、账本或上传文件。
# 2. 用 git archive 导出当前 HEAD 的源码，天然排除 node_modules 和未跟踪文件。
# 3. 把 delivery/ 下的演示视频等不入库的材料一并放进压缩包。
#
# 输出：dist-delivery/ChainProof-交付包-<YYYYMMDD>.zip

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

fail() { echo "[FAIL] $*" >&2; exit 1; }
ok()   { echo "[ OK ] $*"; }

# ---------------------------------------------------------------------------
# 1. 敏感信息检查
# ---------------------------------------------------------------------------

echo "==> 敏感信息检查"

if [ -n "$(git status --porcelain)" ]; then
  echo "[WARN] 工作区有未提交改动；打包只包含已提交的 HEAD。"
fi

bad_paths="$(git ls-files | grep -iE \
  '(^|/)\.env($|\.)|\.(pem|key|crt|p12|pfx|sqlite3?|db)$|priv_sk|/keystore/|/signcerts/|(^|/)organizations/|channel-artifacts/|^backend/uploads/[^.]' \
  | grep -vE '\.env\.example$' || true)"
[ -z "$bad_paths" ] || fail "以下已跟踪文件不应入库：
$bad_paths"
ok "没有私钥、证书、.env、账本或上传文件被跟踪"

secret_hits="$(git grep -nIE \
  'BEGIN ([A-Z]+ )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{32,}' \
  -- . ':!**/package-lock.json' ':!scripts/package-delivery.sh' || true)"
[ -z "$secret_hits" ] || fail "疑似密钥内容：
$secret_hits"
ok "源码中没有疑似私钥或访问令牌"

# ---------------------------------------------------------------------------
# 2. 导出源码
# ---------------------------------------------------------------------------

stamp="$(date +%Y%m%d)"
name="ChainProof-交付包-${stamp}"
out_dir="$REPO_DIR/dist-delivery"
stage="$out_dir/$name"

rm -rf "$stage" "$out_dir/$name.zip"
mkdir -p "$stage/源码"

echo "==> 导出 HEAD $(git rev-parse --short HEAD) 的源码"
git archive --format=tar HEAD | tar -x -C "$stage/源码"
ok "源码已导出"

# 答辩材料单独放一层，方便老师直接找到
# （从导出的 HEAD 里取，保证与源码一致）
src_docs="$stage/源码/docs"
mkdir -p "$stage/答辩材料"
cp "$src_docs/PROJECT_REPORT.md" "$stage/答辩材料/项目介绍.md"
cp "$src_docs/CONTRIBUTIONS.md"  "$stage/答辩材料/团队贡献记录.md"
cp "$src_docs/DEMO_SCRIPT.md"    "$stage/答辩材料/演示脚本.md"
find "$src_docs/defense" -maxdepth 1 -name '*.pptx' -exec cp {} "$stage/答辩材料/" \;

# ---------------------------------------------------------------------------
# 3. 不入库的材料（演示视频等）
# ---------------------------------------------------------------------------

if [ -d delivery ] && [ -n "$(ls -A delivery 2>/dev/null)" ]; then
  cp -r delivery/. "$stage/答辩材料/"
  ok "已加入 delivery/ 下的材料：$(ls delivery | tr '\n' ' ')"
else
  echo "[WARN] delivery/ 为空：演示视频还没放进去（应为 delivery/ChainProof-演示视频.mp4）"
fi

ls "$stage/答辩材料"/*.pptx >/dev/null 2>&1 || echo "[WARN] 没有找到答辩 PPT（docs/defense/*.pptx）"

# ---------------------------------------------------------------------------
# 4. 压缩
# ---------------------------------------------------------------------------

(cd "$out_dir" && zip -qr "$name.zip" "$name")
rm -rf "$stage"

ok "交付包：dist-delivery/$name.zip（$(du -h "$out_dir/$name.zip" | cut -f1)）"
