import { Megaphone } from "lucide-react";
import { AdminAnnouncementToggle } from "@/components/admin-announcement-toggle";
import { Button } from "@/components/ui/button";
import { createAdminAnnouncement } from "@/app/actions/admin";
import { getAllAnnouncements, type AnnouncementAudience } from "@/lib/db";
import { formatRelativeTimeJa } from "@/lib/format";

export const dynamic = "force-dynamic";

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  teacher: "講師",
  student: "生徒・保護者",
  all: "講師・生徒・保護者の全員",
};

const FIELD =
  "rounded-lg border border-border bg-navy-800/60 px-3 text-body-sm text-ivory-100 placeholder:text-slate-500 outline-none focus:border-gold-500/40";

export default function AdminPage() {
  const announcements = getAllAnnouncements();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 text-ivory-100">お知らせの管理</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          講師や生徒へのお知らせを出せます。相手がアプリを開くと、画面の上に出ます。「確認しました」を押した人には、二度と出ません。
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="flex items-center gap-2 text-h3 text-ivory-100">
          <Megaphone className="size-4.5 text-slate-400" strokeWidth={1.75} />
          新しいお知らせ
        </h2>
        <form action={createAdminAnnouncement} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-caption text-slate-400">
            出す相手
            <select name="audience" defaultValue="teacher" className={`h-10 ${FIELD}`}>
              <option value="teacher">講師</option>
              <option value="student">生徒・保護者</option>
              <option value="all">全員（講師・生徒・保護者）</option>
            </select>
          </label>
          <input name="title" required maxLength={100} placeholder="タイトル" className={`h-10 ${FIELD}`} />
          <textarea name="body" required maxLength={2000} rows={6} placeholder="本文" className={`py-2 ${FIELD}`} />
          <div>
            <Button
              type="submit"
              className="h-10 bg-gold-500 px-5 text-body-sm font-medium text-white hover:bg-gold-400"
            >
              お知らせを出す
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">出したお知らせ</h2>
        {announcements.length === 0 ? (
          <p className="mt-3 text-body-sm text-slate-500">まだお知らせはありません。</p>
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-border">
            {announcements.map((item) => (
              <div key={item.id} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-body-sm font-medium text-ivory-100">{item.title}</span>
                  <AdminAnnouncementToggle id={item.id} initialActive={item.active} />
                </div>
                <p className="text-caption text-slate-500">
                  {formatRelativeTimeJa(item.createdAt)}・対象：{AUDIENCE_LABEL[item.audience]}
                  {item.bookTitle ? `（${item.bookTitle}が割り当てられた生徒）` : ""}・確認済み {item.readCount}人
                </p>
                <p className="whitespace-pre-line text-body-sm text-ivory-200">{item.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
