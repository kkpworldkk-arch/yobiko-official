import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, ListChecks, Mic, Users, XCircle } from "lucide-react";
import { StatTile } from "@/components/stat-tile";
import { getTodayOralExamResults } from "@/lib/db";
import { getRoster } from "@/lib/roster";
import { formatRelativeTimeJa } from "@/lib/format";

// 今日の回答を毎回DBから集計するため、静的レンダリングのキャッシュを無効化する
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "long",
  day: "numeric",
  weekday: "short",
});

function seconds(ms: number): string {
  return `${Math.round(ms / 100) / 10}秒`;
}

export default function TodayOralExamPage() {
  const now = new Date();
  const results = getTodayOralExamResults(now);
  const roster = getRoster();
  const nameOf = new Map(roster.map((student) => [student.id, student.name]));
  const done = new Set(results.map((result) => result.studentId));
  const notYet = roster.filter((student) => !done.has(student.id));

  const total = results.reduce((sum, r) => sum + r.total, 0);
  const correct = results.reduce((sum, r) => sum + r.correct, 0);
  const weightedTime = results.reduce((sum, r) => sum + r.avgResponseTimeMs * r.total, 0);
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/oral-exam"
        className="flex w-fit items-center gap-1.5 text-body-sm text-slate-400 transition-colors hover:text-ivory-200"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        口頭試問トップに戻る
      </Link>

      <div>
        <h1 className="text-h1 text-ivory-100">今日の口頭試問</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          {dateFormatter.format(now)}に生徒が答えた結果です。口頭試問とデイリーテストの合計です。
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="取り組んだ生徒" value={`${results.length} / ${roster.length}名`} icon={Users} />
        <StatTile label="回答数" value={`${total}問`} icon={Mic} />
        <StatTile label="正答率" value={accuracy === null ? "—" : `${accuracy}%`} icon={CheckCircle2} />
        <StatTile label="平均反応時間" value={total > 0 ? seconds(weightedTime / total) : "—"} icon={Clock3} />
      </section>

      <section>
        <h2 className="mb-3 text-h3 text-ivory-100">生徒別の結果</h2>
        {results.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-card py-12 text-center text-body-sm text-slate-400">
            今日はまだ口頭試問に取り組んだ生徒がいません。
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {results.map((result) => {
              const rate = Math.round((result.correct / result.total) * 100);
              return (
                <div key={result.studentId} className="rounded-xl border border-border bg-card p-5 shadow-panel">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/oral-exam/students/${result.studentId}`}
                        className="text-body font-medium text-ivory-100 hover:text-gold-400"
                      >
                        {nameOf.get(result.studentId) ?? "（不明な生徒）"}
                      </Link>
                      <p className="mt-0.5 truncate text-caption text-slate-500">{result.bookTitles.join("、")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-caption tabular-nums text-slate-400">
                      {result.dailyTestCount > 0 && (
                        <span className="flex items-center gap-1 rounded-full border border-gold-500/25 bg-gold-500/[0.08] px-2 py-0.5 text-gold-400">
                          <ListChecks className="size-3 shrink-0" strokeWidth={1.75} />
                          デイリーテスト {result.dailyTestCount}問
                        </span>
                      )}
                      <span>平均{seconds(result.avgResponseTimeMs)}</span>
                      <span>{formatRelativeTimeJa(result.lastAt)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-700">
                      <div
                        className={rate >= 80 ? "h-full bg-sage-500" : rate >= 50 ? "h-full bg-gold-500" : "h-full bg-crimson-500"}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-body-sm tabular-nums text-ivory-100">
                      {result.correct} / {result.total}問 ({rate}%)
                    </span>
                  </div>

                  {result.missed.length > 0 && (
                    <details className="mt-3">
                      <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-caption text-crimson-500">
                        <XCircle className="size-3.5" strokeWidth={1.75} />
                        間違えた問題 {result.missed.length}件を見る
                      </summary>
                      <ul className="mt-2 flex flex-col gap-2">
                        {result.missed.map((item) => (
                          <li key={item.id} className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-3">
                            <p className="text-caption text-slate-500">{item.bookTitle}</p>
                            <p className="mt-0.5 text-body-sm text-ivory-200">{item.prompt}</p>
                            {item.answerText && (
                              <p className="mt-1 text-caption text-slate-400">生徒の回答: {item.answerText}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {result.handwritingCorrected > 0 && (
                    <p className="mt-2 text-caption text-amber-300">
                      手書きの読み取りを生徒が{result.handwritingCorrected}件訂正しています（詳細は生徒ページで確認できます）。
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {results.length > 0 && notYet.length > 0 && (
        <section>
          <h2 className="mb-3 text-h3 text-ivory-100">今日まだ取り組んでいない生徒</h2>
          <div className="flex flex-wrap gap-2">
            {notYet.map((student) => (
              <Link
                key={student.id}
                href={`/dashboard/oral-exam/students/${student.id}`}
                className="rounded-full border border-border px-3 py-1 text-body-sm text-slate-300 transition-colors hover:text-ivory-100"
              >
                {student.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
