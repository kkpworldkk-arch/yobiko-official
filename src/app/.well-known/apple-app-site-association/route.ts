import { NextResponse } from "next/server";

// iOSアプリ内でこのドメインのパスキー（Face ID / Touch ID ログイン）を使うための紐付けファイル。
// 値は「チームID.バンドルID」。チームIDは秘密情報ではない（このファイル自体が公開される）ので既定値として
// 直接書いている。アプリを別のチームやバンドルIDで出し直すときだけ、環境変数 APPLE_APP_ID で上書きする。
const DEFAULT_APPLE_APP_ID = "8XQPA6UJ83.jp.takiharajuku.app";

export function GET() {
  const appId = process.env.APPLE_APP_ID || DEFAULT_APPLE_APP_ID;
  return NextResponse.json({
    webcredentials: { apps: [appId] },
  });
}
