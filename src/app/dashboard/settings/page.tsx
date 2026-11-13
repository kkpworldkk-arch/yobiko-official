import { CheckCircle2, CircleAlert, Database, KeyRound, Megaphone, MessageSquareText } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AnnouncementActiveToggle } from "@/components/announcement-active-toggle";
import { StudentFeedbackResolveToggle } from "@/components/student-feedback-resolve-toggle";
import { PasskeyButton } from "@/components/passkey-button";
import { createAnnouncement } from "@/app/actions/teacher-settings";
import { Button } from "@/components/ui/button";
import { getAllAnnouncements, getAllStudentFeedback, getOralExamBooks } from "@/lib/db";
import { formatRelativeTimeJa } from "@/lib/format";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const session = await getSession();
  const teacherName = session?.name ?? "講師";
  const feedback = getAllStudentFeedback();
  const announcements = getAllAnnouncements();
  const books = getOralExamBooks();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 text-ivory-100">設定</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          アカウント情報とシステムの稼働状況を確認できます。
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">プロフィール</h2>
        <div className="mt-4 flex items-center gap-3">
          <Avatar className="size-12 border border-white/[0.06]">
            <AvatarFallback className="bg-navy-600 text-body font-medium text-gold-400">
              {teacherName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-body font-medium text-ivory-100">{teacherName}</p>
            <p className="text-body-sm text-slate-400">講師</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">システム状態</h2>
        <div className="mt-4 flex flex-col divide-y divide-border">
          <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
            <div className="flex items-center gap-3">
              <KeyRound className="size-4 text-slate-400" strokeWidth={1.75} />
              <div>
                <p className="text-body-sm font-medium text-ivory-100">
                  AIチューター（Claude API）
                </p>
                <p className="text-caption text-slate-500">
                  {hasApiKey
                    ? "Claude Opus 4.8 による実回答が有効です。"
                    : "未設定のため、テンプレートによるデモ応答で動作しています。"}
                </p>
              </div>
            </div>
            {hasApiKey ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sage-500/30 bg-sage-500/10 px-2.5 py-1 text-caption font-medium text-sage-500">
                <CheckCircle2 className="size-3.5" strokeWidth={2} />
                設定済み
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rust-500/30 bg-rust-500/10 px-2.5 py-1 text-caption font-medium text-rust-500">
                <CircleAlert className="size-3.5" strokeWidth={2} />
                未設定
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 py-3 last:pb-0">
            <div className="flex items-center gap-3">
              <Database className="size-4 text-slate-400" strokeWidth={1.75} />
              <div>
                <p className="text-body-sm font-medium text-ivory-100">
                  質問データの保存先
                </p>
                <p className="text-caption text-slate-500">
                  ローカルSQLite（data/app.db）に質問・回答・生徒登録情報を保存しています。
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sage-500/30 bg-sage-500/10 px-2.5 py-1 text-caption font-medium text-sage-500">
              <CheckCircle2 className="size-3.5" strokeWidth={2} />
              稼働中
            </span>
          </div>
        </div>

        {!hasApiKey && (
          <p className="mt-4 text-caption leading-relaxed text-slate-500">
            .env.local に ANTHROPIC_API_KEY を設定し、開発サーバーを再起動すると、
            テンプレート応答から実際のAI回答に自動的に切り替わります。
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">生体認証</h2>
        <p className="mt-1 mb-5 text-body-sm text-slate-400">
          Face ID、Touch ID、Windows Helloなどをこの端末のログインに使えます。
        </p>
        <PasskeyButton mode="register" />
      </section>

      <section id="announcements" className="scroll-mt-6 rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="flex items-center gap-2 text-h3 text-ivory-100">
          <Megaphone className="size-4.5 text-slate-400" strokeWidth={1.75} />
          事務所からのお知らせ
        </h2>
        <p className="mt-1 mb-4 text-body-sm text-slate-400">
          生徒がアプリを開くと、画面の上に出ます。生徒が「確認しました」を押すと、その生徒には二度と出ません。
        </p>
        <form action={createAnnouncement} className="flex flex-col gap-3">
          <input
            name="title"
            required
            maxLength={100}
            placeholder="タイトル（例：生物基礎の口頭試問について）"
            className="h-10 rounded-lg border border-border bg-navy-800/60 px-3 text-body-sm text-ivory-100 placeholder:text-slate-500 outline-none focus:border-gold-500/40"
          />
          <textarea
            name="body"
            required
            maxLength={2000}
            rows={5}
            placeholder="本文"
            className="rounded-lg border border-border bg-navy-800/60 px-3 py-2 text-body-sm text-ivory-100 placeholder:text-slate-500 outline-none focus:border-gold-500/40"
          />
          <label className="flex flex-col gap-1.5 text-caption text-slate-400">
            出す相手
            <select
              name="bookId"
              defaultValue=""
              className="h-10 rounded-lg border border-border bg-navy-800/60 px-3 text-body-sm text-ivory-100 outline-none focus:border-gold-500/40"
            >
              <option value="">全員</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  「{book.title}」が割り当てられた生徒だけ
                </option>
              ))}
            </select>
          </label>
          <div>
            <Button
              type="submit"
              className="h-10 bg-gold-500 px-5 text-body-sm font-medium text-navy-950 hover:bg-gold-400"
            >
              お知らせを出す
            </Button>
          </div>
        </form>

        {announcements.length > 0 && (
          <div className="mt-6 flex flex-col divide-y divide-border border-t border-border">
            {announcements.map((item) => (
              <div key={item.id} className="flex flex-col gap-1.5 py-4 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-body-sm font-medium text-ivory-100">{item.title}</span>
                  <AnnouncementActiveToggle id={item.id} initialActive={item.active} />
                </div>
                <p className="text-caption text-slate-500">
                  {formatRelativeTimeJa(item.createdAt)}・
                  {item.bookTitle ? `対象：${item.bookTitle}` : "対象：全員"}・確認済み {item.readCount}人
                </p>
                <p className="whitespace-pre-line text-body-sm text-ivory-200">{item.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="feedback" className="scroll-mt-6 rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="flex items-center gap-2 text-h3 text-ivory-100">
          <MessageSquareText className="size-4.5 text-slate-400" strokeWidth={1.75} />
          生徒からの要望
        </h2>
        <p className="mt-1 mb-4 text-body-sm text-slate-400">
          生徒が設定画面から送信した要望です。対応したら「未対応」をクリックして切り替えられます。
        </p>
        <div className="flex flex-col divide-y divide-border">
          {feedback.length === 0 && (
            <p className="py-6 text-center text-body-sm text-slate-500">
              まだ要望はありません。
            </p>
          )}
          {feedback.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-caption font-medium uppercase tracking-[0.1em] text-gold-400/80">
                  {item.studentName}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-caption text-slate-500">
                    {formatRelativeTimeJa(item.createdAt)}
                  </span>
                  <StudentFeedbackResolveToggle id={item.id} initialResolved={item.resolved} />
                </div>
              </div>
              <p className="whitespace-pre-line text-body-sm text-ivory-200">{item.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
