import { Clock3, GraduationCap, MessageCircleQuestion } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { Student } from "@/lib/types";

export function StudentCard({ student }: { student: Student }) {
  const hasPendingChecks = student.pendingTeacherChecks > 0;

  return (
    <article
      className={cn(
        "group flex flex-col gap-5 rounded-xl border border-border bg-card p-5",
        "shadow-panel transition-all duration-400 ease-luxury",
        "hover:-translate-y-0.5 hover:border-gold-500/25 hover:shadow-panel-lg",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-11 border border-white/[0.06]">
            <AvatarFallback className="bg-navy-600 text-body-sm font-medium text-gold-400">
              {student.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-h3 text-ivory-100">{student.name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-caption text-slate-400">
              <span>{student.grade}</span>
              <span className="text-slate-500">・</span>
              <GraduationCap className="size-3.5" strokeWidth={1.75} />
              <span>{student.targetUniversity}</span>
            </div>
          </div>
        </div>
        <StatusBadge health={student.health} />
      </header>

      <div className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-3.5">
        <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
          この生徒をどう伸ばすか
        </p>
        <p className="mt-1.5 text-body-sm font-medium text-ivory-100">
          {student.priorityAction.headline}
        </p>
        <p className="mt-1 text-body-sm leading-relaxed text-slate-300">
          {student.priorityAction.detail}
        </p>
      </div>

      <footer className="flex items-center justify-between gap-3 text-caption text-slate-400">
        <div className="flex items-center gap-4">
          <span className="tabular-nums">
            直近14日
            <span className="ml-1.5 font-medium text-ivory-200">
              {student.questionsLast14Days}件
            </span>
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <Clock3 className="size-3.5" strokeWidth={1.75} />
            {student.lastActivity}
          </span>
        </div>
        {hasPendingChecks && (
          <span className="flex items-center gap-1 rounded-full border border-crimson-500/25 bg-crimson-500/10 px-2 py-0.5 font-medium text-crimson-500">
            <MessageCircleQuestion className="size-3.5" strokeWidth={2} />
            <span className="text-ivory-200">
              講師確認 {student.pendingTeacherChecks}件
            </span>
          </span>
        )}
      </footer>
    </article>
  );
}
