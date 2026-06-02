#!/usr/bin/env bash
# ─── Mantle · 签名 + 公证 .dmg 一键构建 ──────────────────────────
# 复用 MarkFlow / claudio 同一套 Apple Developer ID 证书。
#
# 步骤:
#   1. 加载 .env.signing 凭据
#   2. 校验钥匙串里有 Developer ID 证书
#   3. npx tauri build (自动 codesign + 硬化运行时, 跳过内嵌公证)
#   4. 给 .dmg 信封单独 notarize + staple (xcrun notarytool, 稳)
#   5. 验证签名 / 公证 / Gatekeeper
#
# 用法:  bash scripts/build-signed-dmg.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

PRODUCT_NAME="Mantle"

# ─── 1. 加载凭据 ──────────────────────────────────────────────
if [[ ! -f .env.signing ]]; then
  echo "✗ 缺少 .env.signing（含 Apple Developer ID 凭据）"
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env.signing; set +a

# ─── 2. 校验环境 ──────────────────────────────────────────────
require() { [[ -n "${!1:-}" ]] || { echo "✗ 环境变量 $1 未设置 (.env.signing)"; exit 1; }; }
require APPLE_SIGNING_IDENTITY
require APPLE_ID
require APPLE_PASSWORD
require APPLE_TEAM_ID

if ! security find-identity -v -p codesigning | grep -q "$APPLE_SIGNING_IDENTITY"; then
  echo "✗ 钥匙串找不到 identity: $APPLE_SIGNING_IDENTITY"
  echo "  import .p12:"
  echo "    security import \"$APPLE_P12_PATH\" -P \"\$APPLE_P12_PASSWORD\" -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign"
  exit 1
fi
echo "✓ 找到证书: $APPLE_SIGNING_IDENTITY"

# updater 私钥可选 — 仅在启用 auto-update 时需要
if [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" && -f "${TAURI_SIGNING_PRIVATE_KEY}" ]]; then
  echo "✓ 找到 updater 私钥（如未配置 updater 将被忽略）"
fi

# ─── 3. tauri build ──────────────────────────────────────────
# 清理上一次构建残留的挂载卷, 否则 bundle_dmg.sh 会失败
for vol in "/Volumes/${PRODUCT_NAME}" /Volumes/dmg.*; do
  [[ -e "$vol" ]] || continue
  echo "→ 卸载残留挂载: $vol"
  hdiutil detach "$vol" -force >/dev/null 2>&1 || true
done

# Tauri 内嵌公证在 Apple notary S3 上传时易死锁。
# 解决: 构建时临时清空 Apple 凭据 → Tauri 只签名不公证;
# 公证留给下面的 xcrun notarytool 单独跑 .dmg (Apple 原生上传器, 稳)。
echo "→ tauri build (签名 .app + .dmg, 跳过 Tauri 内嵌公证)"
_BAK_APPLE_ID="$APPLE_ID"; _BAK_APPLE_PASSWORD="$APPLE_PASSWORD"; _BAK_APPLE_TEAM_ID="$APPLE_TEAM_ID"
unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID
npx tauri build
export APPLE_ID="$_BAK_APPLE_ID"; export APPLE_PASSWORD="$_BAK_APPLE_PASSWORD"; export APPLE_TEAM_ID="$_BAK_APPLE_TEAM_ID"

# ─── 4. 给 dmg 信封单独 notarize + staple ────────────────────
DMG=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" -print -quit 2>/dev/null || true)
if [[ -z "$DMG" || ! -f "$DMG" ]]; then
  echo "✗ 找不到产出 .dmg"
  exit 1
fi
echo "✓ 产出: $DMG"

echo "→ 给 dmg 信封申请公证 (1-3 分钟)"
NOTARY_OUT=$(xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait 2>&1)
echo "$NOTARY_OUT" | tail -8
if ! echo "$NOTARY_OUT" | grep -q "status: Accepted"; then
  echo "✗ dmg 公证未通过. 查 log:"
  SUB_ID=$(echo "$NOTARY_OUT" | grep -oE 'id: [a-f0-9-]+' | head -1 | awk '{print $2}')
  [[ -n "$SUB_ID" ]] && xcrun notarytool log "$SUB_ID" \
    --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID"
  exit 1
fi

echo "→ Staple 票据到 dmg"
xcrun stapler staple "$DMG"

echo "→ 验证签名"
codesign --verify --deep --strict --verbose=2 "$DMG" || true
echo "→ 验证公证 (stapled)"
xcrun stapler validate "$DMG"
echo "→ Gatekeeper assess (模拟用户首次打开)"
spctl --assess --type open --context context:primary-signature -vv "$DMG" || {
  echo "⚠ Gatekeeper 未通过"
  exit 1
}

echo ""
echo "════════════════════════════════════════════════"
echo " ✅ 完成（已签名 + 公证 + staple）: $DMG"
echo "════════════════════════════════════════════════"

# ─── 5. updater 产物 → latest.json (auto-update) ─────────────
TARGZ=$(find src-tauri/target/release/bundle/macos -name "*.app.tar.gz" -print -quit 2>/dev/null || true)
SIG_FILE=$(find src-tauri/target/release/bundle/macos -name "*.app.tar.gz.sig" -print -quit 2>/dev/null || true)
if [[ -n "$TARGZ" && -f "$TARGZ" && -n "$SIG_FILE" && -f "$SIG_FILE" ]]; then
  VERSION=$(grep -E '^version' src-tauri/Cargo.toml | head -1 | awk -F '"' '{print $2}')
  TAG="v${VERSION}"
  PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  ARCH=$(uname -m)
  if [[ "$ARCH" == "arm64" ]]; then PLATFORM="darwin-aarch64"; else PLATFORM="darwin-x86_64"; fi

  # ASCII filenames for GitHub upload (skip if already correctly named —
  # `cp x x` errors "identical" and would abort the script under `set -e`)
  TARGZ_ASCII="src-tauri/target/release/bundle/macos/Mantle.app.tar.gz"
  SIG_ASCII="src-tauri/target/release/bundle/macos/Mantle.app.tar.gz.sig"
  if [[ "$TARGZ" != "$TARGZ_ASCII" ]]; then cp -f "$TARGZ" "$TARGZ_ASCII"; fi
  if [[ "$SIG_FILE" != "$SIG_ASCII" ]]; then cp -f "$SIG_FILE" "$SIG_ASCII"; fi
  TARGZ="$TARGZ_ASCII"; SIG_FILE="$SIG_ASCII"

  RELEASE_URL="https://github.com/raypg-coder/Mantle/releases/download/${TAG}/Mantle.app.tar.gz"
  SIGNATURE=$(cat "$SIG_FILE")
  LATEST_JSON="src-tauri/target/release/bundle/latest.json"
  cat > "$LATEST_JSON" <<JSON
{
  "version": "${VERSION}",
  "notes": "See the release page for details.",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "${PLATFORM}": {
      "signature": "${SIGNATURE}",
      "url": "${RELEASE_URL}"
    }
  }
}
JSON
  echo ""
  echo "────────────────────────────────────────────────"
  echo " 🔄 Auto-update 产物 (上传到 GitHub release ${TAG}):"
  echo "    DMG:  $DMG"
  echo "    TGZ:  $TARGZ"
  echo "    SIG:  $SIG_FILE"
  echo "    JSON: $LATEST_JSON"
  echo ""
  echo " 一键发布:"
  echo "   gh release create $TAG \"$DMG\" \"$TARGZ\" \"$LATEST_JSON\" \\"
  echo "     --repo raypg-coder/Mantle --title \"Mantle $TAG\" --generate-notes"
  echo "────────────────────────────────────────────────"
else
  echo "⚠ 没找到 .app.tar.gz / .sig — 检查 tauri.conf.json#bundle.createUpdaterArtifacts + TAURI_SIGNING_PRIVATE_KEY"
fi
