"use client";

import { useState, useTransition } from "react";
import { toggleAnnouncementActive } from "@/app/actions/teacher-settings";

export function AnnouncementActiveToggle({
  id,
  initialActive,
}: {
  id: string;
  initialActive: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const next = !active;
        setActive(next);
        startTransition(() => {
          toggleAnnouncementActive(id, next);
        });
      }}
      className={
        active
          ? "inline-flex items-center rounded-full border border-sage-500/30 bg-sage-500/10 px-2.5 py-1 text-caption font-medium text-sage-500 disabled:opacity-60"
          : "inline-flex items-center rounded-full border border-border px-2.5 py-1 text-caption font-medium text-slate-400 hover:text-ivory-200 disabled:opacity-60"
      }
    >
      {active ? "公開中（押すと取り下げ）" : "取り下げ済み（押すと再公開）"}
    </button>
  );
}
