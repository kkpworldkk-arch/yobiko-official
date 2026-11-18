"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acknowledgeFeedbackResolved } from "@/app/actions/student-settings";

// 生徒が送った要望を講師が「対応済み」にしたときに出す知らせ。「確認しました」を押すと消える。
export function FeedbackResolvedBanner({ notices }: { notices: { id: string; message: string }[] }) {
  const [isPending, startTransition] = useTransition();

  if (notices.length === 0) return null;

  return (
    <div className="mb-8 flex flex-col gap-4">
      {notices.map((notice) => (
        <section
          key={notice.id}
          className="rounded-xl border border-sage-500/30 bg-sage-500/[0.06] p-5 shadow-panel sm:p-6"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-sage-500" strokeWidth={1.75} />
            <p className="text-caption font-medium tracking-[0.1em] text-sage-500">ご要望に対応しました</p>
          </div>
          <p className="mt-3 text-body-sm leading-relaxed text-slate-300">
            いただいたご要望について、対応を行いました。ご意見をありがとうございました。
          </p>
          <p className="mt-2 line-clamp-3 whitespace-pre-line rounded-lg border border-white/[0.05] bg-navy-800/60 p-3 text-caption text-slate-400">
            {notice.message}
          </p>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => acknowledgeFeedbackResolved(notice.id))}
            className="mt-4 h-10 bg-gold-500 px-5 text-body-sm font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-70"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : "確認しました"}
          </Button>
        </section>
      ))}
    </div>
  );
}
