import type { NextConfig } from "next";

// 他サイトへの埋め込み(クリックジャッキング)やMIME誤判定などを防ぐ共通ヘッダー。
// scriptの制限(script-src)は、Next.jsのインラインスクリプトと両立させるのに
// nonceが要るため、ここでは入れていない。マイク・カメラは口頭試問の音声回答と
// 写真回答で自サイトだけが使う。
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  // VPSへの本番デプロイ用。.next/standalone に実行に必要な最小限のnode_modulesだけが
  // コピーされるため、サーバー上でのnpm installが不要になり、デプロイが軽くなる。
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
