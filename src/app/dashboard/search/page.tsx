import Form from "next/form";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { searchQaHistory } from "@/lib/db";
import { formatRelativeTimeJa } from "@/lib/format";
import { getRoster } from "@/lib/roster";

export const dynamic = "force-dynamic";

// 講師画面上部の検索欄の結果。生徒（名前・学年・志望校・教科・つまずき）と、全生徒の質問履歴をまとめて探す。
export default async function DashboardSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";

  const roster = getRoster();
  const studentNames = new Map(roster.map((student) => [student.id, student.name]));
  const needle = query.toLowerCase();
  const students = query
    ? roster.filter((student) =>
        [
          student.name,
          student.grade,
          student.targetUniversity,
          ...student.subjectBreakdown.map((item) => item.subject),
          ...student.topStumbles.map((item) => item.label),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : [];
  const questions = query ? searchQaHistory(query) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 text-ivory-100">検索</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          生徒の名前・志望校・つまずき、質問の教科・単元・本文から探せます。
        </p>
      </div>

      <Form action="/dashboard/search" className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <input
          key={query}
          type="search"
          name="q"
          defaultValue={query}
          placeholder="生徒・教科・単元を検索"
          className="h-11 w-full rounded-lg border border-border bg-navy-800/60 pl-9 pr-3 text-body text-ivory-100 placeholder:text-slate-500 outline-none transition-colors duration-300 focus:border-gold-500/40"
        />
      </Form>

      {query && (
        <>
          <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
            <h2 className="text-h3 text-ivory-100">
              生徒
              <span className="ml-2 text-caption font-normal text-slate-500">{students.length}名</span>
            </h2>
            {students.length === 0 ? (
              <p className="mt-4 text-body-sm text-slate-500">該当する生徒はいません。</p>
            ) : (
              <div className="mt-4 flex flex-col divide-y divide-border">
                {students.map((student) => (
                  <Link
                    key={student.id}
                    href={`/dashboard/students/${encodeURIComponent(student.id)}`}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <StatusBadge health={student.health} />
                      <p className="truncate text-body font-medium text-ivory-100">
                        {student.name}
                        <span className="ml-2 text-caption font-normal text-slate-500">
                          {student.grade}・{student.targetUniversity}
                        </span>
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-gold-400" strokeWidth={2} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
            <h2 className="text-h3 text-ivory-100">
              質問履歴
              <span className="ml-2 text-caption font-normal text-slate-500">
                {questions.length >= 30 ? "新しい順に30件" : `${questions.length}件`}
              </span>
            </h2>
            {questions.length === 0 ? (
              <p className="mt-4 text-body-sm text-slate-500">該当する質問はありません。</p>
            ) : (
              <div className="mt-4 flex flex-col divide-y divide-border">
                {questions.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/dashboard/students/${encodeURIComponent(entry.studentId)}`}
                    className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                  >
                    <p className="text-caption text-slate-500">
                      {studentNames.get(entry.studentId) ?? "生徒"}・{entry.subject}・{entry.unit}・
                      {formatRelativeTimeJa(entry.askedAt)}
                    </p>
                    <p className="line-clamp-2 text-body-sm text-ivory-100">{entry.question}</p>
                    {entry.weaknessTag && (
                      <p className="text-caption text-gold-400">{entry.weaknessTag}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
