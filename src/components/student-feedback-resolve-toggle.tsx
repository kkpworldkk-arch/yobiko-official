"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { toggleStudentFeedbackResolved } from "@/app/actions/teacher-settings";

export function StudentFeedbackResolveToggle({
  id,
  initialResolved,
}: {
  id: string;
  initialResolved: boolean;
}) {
  const [resolved, setResolved] = useState(initialResolved);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const next = !resolved;
        setResolved(next);
        startTransition(() => {
          toggleStudentFeedbackResolved(id, next);
        });
      }}
      className={
        resolved
          ? "inline-flex items-center gap-1.5 rounded-full border border-sage-500/30 bg-sage-500/10 px-2.5 py-1 text-caption font-medium text-sage-500 disabled:opacity-60"
          : "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-caption font-medium text-slate-400 hover:text-ivory-200 disabled:opacity-60"
      }
    >
      {resolved ? (
        <CheckCircle2 className="size-3.5" strokeWidth={2} />
      ) : (
        <Circle className="size-3.5" strokeWidth={1.75} />
      )}
      {resolved ? "対応済み" : "未対応"}
    </button>
  );
}
