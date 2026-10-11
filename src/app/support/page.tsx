import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

export const metadata = {
  title: "お問い合わせ・サポート | 滝原塾",
};

const FAQ = [
  {
    q: "アカウントを作りたい",
    a: "このアプリは滝原塾の塾生・保護者・講師専用です。アカウントは塾から発行しますので、担当講師にお申し出ください。",
  },
  {
    q: "パスワードを忘れた",
    a: "担当講師、または下記のお問い合わせ先までご連絡ください。本人確認のうえ、新しいパスワードを発行します。",
  },
  {
    q: "アカウントを削除したい",
    a: "ログイン後、「設定」→「アカウントの削除」からご自身で削除できます。ログインできない場合は下記までご連絡ください。",
  },
  {
    q: "AIへのデータ送信をやめたい",
    a: "「設定」→「AI機能へのデータ送信」から、いつでも同意を取り消せます。",
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-navy-950 px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 shadow-panel">
        <h1 className="text-h1 text-ivory-100">お問い合わせ・サポート</h1>
        <p className="mt-2 text-body-sm text-slate-400">
          {OPERATOR.serviceName}（運営: {OPERATOR.tradeName}）のサポート窓口です。
        </p>

        <section className="mt-8">
          <h2 className="text-h3 text-ivory-100">お問い合わせ先</h2>
          <p className="mt-2 text-body-sm text-slate-300">
            メール:{" "}
            <a href={`mailto:${OPERATOR.contactEmail}`} className="text-gold-400 underline-offset-2 hover:underline">
              {OPERATOR.contactEmail}
            </a>
          </p>
          <p className="mt-1 text-caption text-slate-500">通常2営業日以内にご返信します。</p>
        </section>

        <section className="mt-8">
          <h2 className="text-h3 text-ivory-100">よくあるご質問</h2>
          <dl className="mt-3 flex flex-col gap-4">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="text-body-sm font-medium text-ivory-200">{item.q}</dt>
                <dd className="mt-1 text-body-sm leading-relaxed text-slate-400">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-10 flex gap-4 text-caption text-slate-500">
          <Link href="/privacy" className="hover:text-gold-400">
            プライバシーポリシー
          </Link>
          <Link href="/login" className="hover:text-gold-400">
            ログイン画面へ
          </Link>
        </div>
      </div>
    </main>
  );
}
