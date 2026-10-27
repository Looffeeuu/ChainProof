#!/usr/bin/env bash
# 课程最终交付打包（Issue #7）
#
# 用法（仓库根目录）：
#   bash scripts/package-delivery.sh            # 正式打包：材料不齐直接失败
#   bash scripts/package-delivery.sh --draft    # 预演：材料不齐只警告
#
# 按作业要求的 5 项材料整理目录，每位组员各生成一个压缩包，
# 命名规范「组名-组长/组员-姓名-小程序名称」：
#
#   dist-delivery/ChainProof-组长-全书阅-ChainProof.zip
#   └── ChainProof-组长-全书阅-ChainProof/
#       ├── 1-项目源代码/              git archive HEAD（前端、后端、链码、网络脚本）
#       ├── 2-答辩PPT/
#       ├── 3-项目介绍文档/
#       ├── 4-演示讲解视频/            来自 delivery/（视频不入库）
#       └── 5-成员分工与贡献打分/
#
# 上传截止：10-31 23:59（学在浙大），每人上传自己那一份。

set -euo pipefail

command -v python3 >/dev/null || { echo "[FAIL] 需要 python3 生成压缩包" >&2; exit 1; }

GROUP="ChainProof"
APP="ChainProof"
MEMBERS=("组长:全书阅" "组员:杨宇" "组员:黄铭谦")
VIDEO="delivery/ChainProof-演示视频.mp4"

DRAFT=0
[ "${1:-}" = "--draft" ] && DRAFT=1

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

fail() { echo "[FAIL] $*" >&2; exit 1; }
ok()   { echo "[ OK ] $*"; }
problems=()
need() { problems+=("$1"); echo "[MISS] $1"; }

# ---------------------------------------------------------------------------
# 1. 敏感信息检查
# ---------------------------------------------------------------------------

echo "==> 敏感信息检查"

if [ -n "$(git status --porcelain)" ]; then
  echo "[WARN] 工作区有未提交改动；源码与文档只取已提交的 HEAD。"
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
# 2. 材料齐全检查
# ---------------------------------------------------------------------------

echo "==> 材料检查"

head_has() { git cat-file -e "HEAD:$1" 2>/dev/null; }

for f in "docs/defense/ChainProof-答辩.pptx" \
         "docs/defense/ChainProof-项目介绍.docx" \
         "docs/defense/ChainProof-成员分工与贡献打分.docx"; do
  if head_has "$f"; then ok "$f"; else need "HEAD 中缺少 $f"; fi
done

if [ -s "$VIDEO" ]; then ok "$VIDEO（$(du -h "$VIDEO" | cut -f1)）"; else need "缺少演示讲解视频 $VIDEO"; fi

if head_has docs/TEAM_SCORES.md && git show HEAD:docs/TEAM_SCORES.md | grep -q '参考分'; then
  need "TEAM_SCORES.md 仍是参考稿：组长确认分数、删掉「参考分」说明后重新生成 docx"
fi

if [ ${#problems[@]} -gt 0 ] && [ $DRAFT -eq 0 ]; then
  fail "材料不齐（${#problems[@]} 项），补齐后再打包；只想预演请加 --draft"
fi

# ---------------------------------------------------------------------------
# 3. 整理目录并为每位组员打包
# ---------------------------------------------------------------------------

out_dir="$REPO_DIR/dist-delivery"
mkdir -p "$out_dir"
stage="$(mktemp -d "$out_dir/.stage.XXXXXX")"
trap 'rm -rf "$stage"' EXIT

echo "==> 导出 HEAD $(git rev-parse --short HEAD)"
tpl="$stage/template"
mkdir -p "$tpl/1-项目源代码" "$tpl/2-答辩PPT" "$tpl/3-项目介绍文档" "$tpl/4-演示讲解视频" "$tpl/5-成员分工与贡献打分"
git archive --format=tar HEAD | tar -x -C "$tpl/1-项目源代码"

src="$tpl/1-项目源代码/docs/defense"
cp_if() { [ -f "$1" ] && cp "$1" "$2" || true; }
cp_if "$src/ChainProof-答辩.pptx"               "$tpl/2-答辩PPT/"
cp_if "$src/ChainProof-项目介绍.docx"           "$tpl/3-项目介绍文档/"
cp_if "$src/ChainProof-成员分工与贡献打分.docx" "$tpl/5-成员分工与贡献打分/"
cp_if "$VIDEO"                                  "$tpl/4-演示讲解视频/"

for m in "${MEMBERS[@]}"; do
  name="${GROUP}-${m%%:*}-${m#*:}-${APP}"
  rm -f "$out_dir/$name.zip"
  cp -r "$tpl" "$stage/$name"
  # 不用 Info-ZIP：在非 UTF-8 locale 下它不给中文路径设 UTF-8 标记（EFS），
  # Windows 解压后目录名会是乱码。Python zipfile 遇到非 ASCII 名会自动设置。
  python3 - "$stage" "$name" "$out_dir/$name.zip" <<'PY'
import os, sys, zipfile
stage, name, out = sys.argv[1:]
stored = ('.mp4', '.pptx', '.docx', '.png', '.jpg', '.zip', '.woff2')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(os.path.join(stage, name)):
        dirs.sort()
        rel = os.path.relpath(root, stage)
        z.write(root, rel + '/')
        for f in sorted(files):
            path = os.path.join(root, f)
            method = zipfile.ZIP_STORED if f.lower().endswith(stored) else zipfile.ZIP_DEFLATED
            z.write(path, os.path.join(rel, f), compress_type=method)
PY
  ok "dist-delivery/$name.zip（$(du -h "$out_dir/$name.zip" | cut -f1)）"
done

if [ ${#problems[@]} -gt 0 ]; then
  echo "[WARN] 预演模式：以上压缩包缺少 ${#problems[@]} 项材料，不能直接上传。"
fi
