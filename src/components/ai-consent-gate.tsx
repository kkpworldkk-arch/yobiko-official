"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptAiConsent } from "@/app/actions/student-settings";

// AI採点・AIチューターは回答を外部AI（Anthropic）に送るため、初回に同意を得てから使えるようにする。
// 設定画面（ログアウト・アカウント削除）だけは同意前でも開けるようにしておく。
export function AiConsentGate({
  consented,
  children,
}: {
  consented: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  if (consented || pathname.startsWith("/student/settings")) {
    return <>{children}</>;
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-panel sm:p-8">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/[0.08]">
          <ShieldCheck className="size-4 text-gold-400" strokeWidth={1.5} />
        </div>
        <h1 className="text-h2 text-ivory-100">AI機能のご利用について</h1>
      </div>

      <div className="mt-5 flex flex-col gap-4 text-body-sm leading-relaxed text-slate-300">
        <p>
          このアプリのAI口頭試問・AIチューターでは、採点やアドバイスを作成するために、
          あなたの入力内容を外部のAIサービスに送信します。ご利用の前に内容をご確認ください。
        </p>
        <dl className="flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-navy-800/60 p-4">
          <div>
            <dt className="text-caption text-gold-400/90">送信先</dt>
            <dd className="mt-0.5">Anthropic, PBC（米国）が提供するAI「Claude」</dd>
          </div>
          <div>
            <dt className="text-caption text-gold-400/90">送信する内容</dt>
            <dd className="mt-0.5">
              問題文・模範解答と、あなたの回答（キーボード入力の文章、音声入力を文字にしたもの、手書き回答の画像）、
              AIチューターへの質問内容
            </dd>
          </div>
          <div>
            <dt className="text-caption text-gold-400/90">利用目的</dt>
            <dd className="mt-0.5">回答の採点、フィードバック・学習アドバイスの作成のみ</dd>
          </div>
          <div>
            <dt className="text-caption text-gold-400/90">送信しないもの</dt>
            <dd className="mt-0.5">メールアドレス・パスワードなどのアカウント情報</dd>
          </div>
        </dl>
        <p className="text-caption text-slate-400">
          Anthropic社の商用API規約により、送信内容がAIモデルの学習に使われることはありません。
          同意はあとから設定画面で取り消せます。詳しくは
          <Link href="/privacy" className="mx-0.5 text-gold-400 underline-offset-2 hover:underline">
            プライバシーポリシー
          </Link>
          をご覧ください。
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => acceptAiConsent())}
          className="h-11 bg-gold-500 px-6 text-body-sm font-medium text-navy-950 shadow-gold-glow hover:bg-gold-400 disabled:opacity-70"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "同意してAI機能を使う"}
        </Button>
        <Link
          href="/student/settings"
          className="text-caption text-slate-400 transition-colors hover:text-ivory-200"
        >
          同意しない（設定へ）
        </Link>
      </div>
    </section>
  );
}
