"use client";

import { useTransition } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acknowledgeAnnouncement } from "@/app/actions/student-settings";

// 事務所からのお知らせ。「確認しました」を押すと記録され、その生徒には二度と出ない。
export function AnnouncementBanner({
  announcements,
}: {
  announcements: { id: string; title: string; body: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  if (announcements.length === 0) return null;

  return (
    <div className="mb-8 flex flex-col gap-4">
      {announcements.map((item) => (
        <section
          key={item.id}
          className="rounded-xl border border-gold-500/30 bg-gold-500/[0.06] p-5 shadow-panel sm:p-6"
        >
          <div className="flex items-center gap-2.5">
            <Megaphone className="size-4 text-gold-400" strokeWidth={1.75} />
            <p className="text-caption font-medium tracking-[0.1em] text-gold-400">
              事務所からのお知らせ
            </p>
          </div>
          <h2 className="mt-3 text-h3 text-ivory-100">{item.title}</h2>
          <p className="mt-2 whitespace-pre-line text-body-sm leading-relaxed text-slate-300">
            {item.body}
          </p>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => acknowledgeAnnouncement(item.id))}
            className="mt-4 h-10 bg-gold-500 px-5 text-body-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-70"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : "確認しました"}
          </Button>
        </section>
      ))}
    </div>
  );
}
