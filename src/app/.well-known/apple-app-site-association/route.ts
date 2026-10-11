import { NextResponse } from "next/server";

// iOSアプリ内でこのドメインのパスキー（Face ID / Touch ID ログイン）を使うための紐付けファイル。
// APPLE_APP_ID は「チームID.バンドルID」（例: ABCDE12345.jp.takihara.app）。Apple Developer登録後に
// Renderの環境変数へ設定する。未設定なら空の紐付けを返す（アプリ以外の動作には影響しない）。
export function GET() {
  const appId = process.env.APPLE_APP_ID;
  return NextResponse.json({
    webcredentials: { apps: appId ? [appId] : [] },
  });
}
