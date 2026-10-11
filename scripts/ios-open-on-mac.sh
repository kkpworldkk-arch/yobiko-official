#!/bin/bash
# Macで1回実行するだけで、iOSアプリをXcodeで開ける状態にする。
#   使い方: ターミナルで  bash scripts/ios-open-on-mac.sh
set -e
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js が入っていません。https://nodejs.org から LTS 版をインストールしてから、もう一度実行してください。"
  exit 1
fi
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Xcode が入っていません。App Store から Xcode をインストールし、一度起動してから、もう一度実行してください。"
  exit 1
fi

npm ci
npx cap sync ios
open ios/App/App.xcodeproj
echo "Xcode が開きました。docs/ios-release.md の「3. Xcode での設定」に進んでください。"
