"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Paperclip, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SUBJECTS, demoStudent } from "@/lib/mock-data";
import { formatRelativeTimeJa } from "@/lib/format";
import type { QaHistoryEntry } from "@/lib/types";

export default function DashboardHistoryPage() {
  const [history, setHistory] = useState<QaHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tutor?studentId=${demoStudent.id}`)
      .then((res) => res.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      await fetch("/api/tutor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, studentId: demoStudent.id }),
      });
      setHistory((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, teacherCheckResolved: true } : entry,
        ),
      );
    } finally {
      setResolvingId(null);
    }
  }

  const filtered = useMemo(() => {
    return history.filter((entry) => {
      if (subjectFilter && entry.subject !== subjectFilter) return false;
      if (!search.trim()) return true;
      const haystack = [
        entry.subject,
        entry.unit,
        entry.question,
        entry.weaknessTag,
        entry.university,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [history, search, subjectFilter]);

  const unresolvedCount = history.filter(
    (e) => e.teacherCheckNeeded && !e.teacherCheckResolved,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 text-ivory-100">質問履歴</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          {demoStudent.name}様の質問記録です（実データ）。講師確認が必要な質問は「対応済みにする」で処理できます。
          {unresolvedCount > 0 && (
            <span className="ml-1 text-crimson-500">
              未対応 {unresolvedCount}件
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="教科・単元・大学・タグで検索"
            className="h-10 w-72 rounded-lg border border-border bg-navy-800/60 pl-8 pr-3 text-body-sm text-ivory-100 placeholder:text-slate-500 outline-none transition-colors duration-300 focus:border-gold-500/40"
          />
        </div>
        <Select
          value={subjectFilter || "all"}
          onValueChange={(v) => setSubjectFilter(v === "all" ? "" : (v as string))}
        >
          <SelectTrigger className="h-10 w-36">
            <SelectValue placeholder="教科" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {SUBJECTS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-6 shadow-panel">
        {isLoading && (
          <p className="py-8 text-center text-body-sm text-slate-500">
            読み込み中…
          </p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="py-8 text-center text-body-sm text-slate-500">
            条件に一致する質問がありません。
          </p>
        )}
        {filtered.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-2 py-4 first:pt-5 last:pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-caption font-medium uppercase tracking-[0.1em] text-gold-400/80">
                {entry.subject}
                {entry.unit && entry.unit !== entry.subject ? ` ・ ${entry.unit}` : ""}
                {entry.university ? ` ・ ${entry.university}` : ""}
              </span>
              <span className="text-caption text-slate-500">
                {formatRelativeTimeJa(entry.askedAt)}
              </span>
            </div>
            <p className="text-body-sm text-ivory-200">{entry.question}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-slate-500">
              <span>解答状況: {entry.answerStatus}</span>
              <span>確信度: {entry.confidence}</span>
              <span>弱点タグ: {entry.weaknessTag}</span>
              {entry.attachments.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3" strokeWidth={1.75} />
                  添付{entry.attachments.length}件
                </span>
              )}
            </div>
            {entry.teacherCheckNeeded && (
              <div className="mt-1 flex items-center gap-2">
                {entry.teacherCheckResolved ? (
                  <span className="text-caption font-medium text-sage-500">
                    対応済み
                  </span>
                ) : (
                  <>
                    <span className="text-caption font-medium text-crimson-500">
                      講師確認が必要
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={resolvingId === entry.id}
                      onClick={() => handleResolve(entry.id)}
                      className="h-7 gap-1 px-2.5 text-caption"
                    >
                      <Check className="size-3" strokeWidth={2} />
                      対応済みにする
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
