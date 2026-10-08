import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // VPSへの本番デプロイ用。.next/standalone に実行に必要な最小限のnode_modulesだけが
  // コピーされるため、サーバー上でのnpm installが不要になり、デプロイが軽くなる。
  output: "standalone",
};

export default nextConfig;
