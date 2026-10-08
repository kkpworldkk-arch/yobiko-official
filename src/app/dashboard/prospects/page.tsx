"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTimeJa } from "@/lib/format";
import type { ProspectAssessment } from "@/lib/types";

export default function ProspectsPage() {
  const [assessments, setAssessments] = useState<ProspectAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/prospects")
      .then((res) => res.json())
      .then((data) => setAssessments(data.assessments ?? []))
      .catch(() => setAssessments([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ivory-100">無料弱点診断</h1>
          <p className="mt-1 text-body-sm text-slate-400">
            入塾を検討中の生徒の模試結果から、弱点診断レポートを作成できます。
          </p>
        </div>
        <Button
          render={<Link href="/dashboard/prospects/new" />}
          nativeButton={false}
          className="h-9 gap-1.5 bg-gold-500 px-3 text-navy-950 hover:bg-gold-400"
        >
          <Plus className="size-4" strokeWidth={2} />
          新しい診断を作成
        </Button>
      </div>

      {isLoading && (
        <p className="py-8 text-center text-body-sm text-slate-500">
          読み込み中…
        </p>
      )}

      {!isLoading && assessments.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 bg-card py-16 text-center">
          <Stethoscope className="size-6 text-slate-500" strokeWidth={1.5} />
          <p className="text-body-sm text-slate-400">
            まだ診断がありません。模試結果を入力して、最初の診断レポートを作成しましょう。
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {assessments.map((a) => (
          <Link
            key={a.id}
            href={`/dashboard/prospects/${a.id}`}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-panel transition-all duration-400 ease-luxury hover:-translate-y-0.5 hover:border-gold-500/25 hover:shadow-panel-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-h3 text-ivory-100">{a.name}</h3>
                <p className="mt-0.5 text-caption text-slate-400">
                  {a.grade}・{a.targetUniversity}志望
                </p>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-slate-500 transition-colors group-hover:text-gold-400" />
            </div>

            <p className="text-caption text-slate-500">
              {a.examName}
              {a.examDate ? `（${a.examDate}）` : ""}
            </p>

            {a.report.priorityFocus.length > 0 && (
              <div className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-3">
                <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
                  優先対策分野
                </p>
                <p className="mt-1.5 text-body-sm text-ivory-100">
                  {a.report.priorityFocus[0]}
                </p>
              </div>
            )}

            <p className="text-caption text-slate-500">
              診断日: {formatRelativeTimeJa(a.createdAt)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
