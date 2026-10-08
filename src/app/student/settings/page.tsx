import { KeyRound, MessageSquareText, UserCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StudentFeedbackForm } from "@/components/student-feedback-form";
import { StudentPasswordForm } from "@/components/student-password-form";
import { PasskeyButton } from "@/components/passkey-button";
import { getStudentFeedbackForUser } from "@/lib/db";
import { formatRelativeTimeJa } from "@/lib/format";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";

export const dynamic = "force-dynamic";

export default async function StudentSettingsPage() {
  const session = await getSession();
  const identity = resolveStudentIdentity(session);
  const pastFeedback = session ? getStudentFeedbackForUser(session.userId) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 text-ivory-100">設定</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          パスワードの変更や、講師への要望の送信ができます。
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="flex items-center gap-2 text-h3 text-ivory-100">
          <UserCircle className="size-4.5 text-slate-400" strokeWidth={1.75} />
          プロフィール
        </h2>
        <div className="mt-4 flex items-center gap-3">
          <Avatar className="size-12 border border-white/[0.06]">
            <AvatarFallback className="bg-navy-600 text-body font-medium text-gold-400">
              {identity.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-body font-medium text-ivory-100">{identity.name}</p>
            <p className="text-body-sm text-slate-400">{identity.grade}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="flex items-center gap-2 text-h3 text-ivory-100">
          <KeyRound className="size-4.5 text-slate-400" strokeWidth={1.75} />
          パスワードの変更
        </h2>
        <p className="mt-1 mb-5 text-body-sm text-slate-400">
          ご自身で好きなパスワードに変更できます。
        </p>
        <StudentPasswordForm />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">生体認証</h2>
        <p className="mt-1 mb-5 text-body-sm text-slate-400">
          Face ID、Touch ID、Windows Helloなどをこの端末のログインに使えます。
        </p>
        <PasskeyButton mode="register" />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="flex items-center gap-2 text-h3 text-ivory-100">
          <MessageSquareText className="size-4.5 text-slate-400" strokeWidth={1.75} />
          講師への要望
        </h2>
        <p className="mt-1 mb-5 text-body-sm text-slate-400">
          問題の誤りや使いにくい点など、気づいたことを気軽に送ってください。
        </p>
        <StudentFeedbackForm />

        {pastFeedback.length > 0 && (
          <div className="mt-6 flex flex-col divide-y divide-border border-t border-border pt-4">
            {pastFeedback.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption text-slate-500">
                    {formatRelativeTimeJa(item.createdAt)}
                  </span>
                  <span
                    className={
                      item.resolved
                        ? "text-caption text-sage-500"
                        : "text-caption text-gold-400/80"
                    }
                  >
                    {item.resolved ? "対応済み" : "送信済み・未対応"}
                  </span>
                </div>
                <p className="text-body-sm text-ivory-200">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
