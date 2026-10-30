import type { Metadata } from "next";
// フォントは npm パッケージに同梱されたファイルを使う。next/font/google はビルド中に
// Google Fonts へ取りに行くため、その通信が失敗すると Render のビルドが止まっていた。
import "@fontsource-variable/inter";
import "@fontsource-variable/noto-sans-jp";
import "@fontsource-variable/geist-mono";
import { SplashScreen } from "@/components/splash-screen";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "滝原塾 コンシェルジュ・プラットフォーム",
  description: "医学部受験生のための専属コンシェルジュ・ダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider delay={200}>{children}</TooltipProvider>
        <SplashScreen />
      </body>
    </html>
  );
}
