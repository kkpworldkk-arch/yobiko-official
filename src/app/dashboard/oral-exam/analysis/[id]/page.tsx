import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOralExamAnalyses } from "@/lib/db";
import {
  ANALYSIS_INTERVAL,
  liveStatsForStudent,
  type AnalysisNarrative,
  type AnalysisStats,
  type GroupStat,
} from "@/lib/oral-exam-analysis";
import { getRoster } from "@/lib/roster";

export const dynamic = "force-dynamic";

const pct = (value: number) => `${Math.round(value * 100)}%`;
const sec = (ms: number) => `${Math.round(ms / 100) / 10}秒`;

function GroupTable({ title, groups }: { title: string; groups: GroupStat[] }) {
  if (groups.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-body-sm font-medium text-ivory-200">{title}</h3>
      <div className="flex flex-col gap-1.5">
        {groups.map((group) => (
          <div key={group.label} className="flex items-center gap-3 text-caption">
            <span className="w-40 shrink-0 truncate text-slate-300">{group.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-700">
              <div
                className={group.accuracy >= 0.8 ? "h-full bg-sage-500" : group.accuracy >= 0.5 ? "h-full bg-gold-500" : "h-full bg-crimson-500"}
                style={{ width: `${Math.round(group.accuracy * 100)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right tabular-nums text-slate-400">
              {pct(group.accuracy)} ({group.correct}/{group.total}) {sec(group.avgResponseTimeMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsBlock({ stats }: { stats: AnalysisStats }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["回答数", `${stats.total}問`],
          ["正答率", pct(stats.accuracy)],
          ["平均反応時間", sec(stats.avgResponseTimeMs)],
          ["正解でも遅い問題", `${stats.slowCorrectCount}問`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-navy-800/60 p-3">
            <p className="text-caption text-slate-500">{label}</p>
            <p className="mt-0.5 text-h3 tabular-nums text-ivory-100">{value}</p>
          </div>
        ))}
      </div>
      <GroupTable title="教科別" groups={stats.bySubject} />
      <GroupTable title="参考書別" groups={stats.byBook} />
      <GroupTable title="分野別" groups={stats.byCategory} />
      <GroupTable title="回答方法別" groups={stats.byInputMode} />
      <GroupTable title="問題の種類別" groups={stats.byQuestionKind} />
      <GroupTable title="出題元別" groups={stats.bySessionKind} />
      <GroupTable title="取り組んだ時間帯別" groups={stats.byTimeBand} />
      {stats.repeatMisses.length > 0 && (
        <div>
          <h3 className="mb-2 text-body-sm font-medium text-ivory-200">繰り返し間違えている問題</h3>
          <ul className="flex flex-col gap-1 text-caption text-slate-300">
            {stats.repeatMisses.map((miss) => (
              <li key={miss.prompt}>
                {miss.missCount}回 — [{miss.bookTitle}] {miss.prompt}
              </li>
            ))}
          </ul>
        </div>
      )}
      {stats.topImprovements.length > 0 && (
        <div>
          <h3 className="mb-2 text-body-sm font-medium text-ivory-200">不正解のとき多く出た改善点</h3>
          <ul className="flex flex-col gap-1 text-caption text-slate-300">
            {stats.topImprovements.map((item) => (
              <li key={item.text}>
                {item.count}回 — {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body-sm leading-relaxed text-ivory-200">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default async function StudentAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = getRoster().find((s) => s.id === id);
  if (!student) notFound();

  const analyses = getOralExamAnalyses(id);
  const latest = analyses[0] ?? null;
  const narrative = latest ? (JSON.parse(latest.analysisJson) as AnalysisNarrative) : null;
  const live = liveStatsForStudent(id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/oral-exam/analysis"
        className="flex w-fit items-center gap-1.5 text-body-sm text-slate-400 transition-colors hover:text-ivory-200"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        データ分析に戻る
      </Link>

      <div>
        <h1 className="text-h1 text-ivory-100">{student.name} 様のデータ分析</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          {live
            ? `全${live.stats.total}回答の記録があります。${ANALYSIS_INTERVAL}回答ごとに分析を自動で更新します。`
            : "まだ回答の記録がありません。"}
        </p>
      </div>

      {latest && narrative && (
        <section className="rounded-xl border border-gold-400/30 bg-card p-5 shadow-panel">
          <h2 className="text-caption font-medium tracking-[0.04em] text-gold-400/80">
            分析(第{analyses.length}回・{latest.periodFrom}〜{latest.periodTo}・{latest.attemptCount}回答時点
            {latest.source === "rule" ? "・簡易版" : ""})
          </h2>
          <p className="mt-2 whitespace-pre-line text-body-sm leading-relaxed text-ivory-200">{narrative.summary}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <h3 className="mb-1.5 text-body-sm font-medium text-ivory-100">考えられる原因</h3>
              <List items={narrative.causes} />
            </div>
            <div>
              <h3 className="mb-1.5 text-body-sm font-medium text-ivory-100">講師の働きかけ</h3>
              <List items={narrative.teacherActions} />
            </div>
            <div>
              <h3 className="mb-1.5 text-body-sm font-medium text-ivory-100">生徒へのアドバイス</h3>
              <List items={narrative.studentAdvice} />
            </div>
          </div>
        </section>
      )}

      {live && (
        <>
          <section className="rounded-xl border border-border bg-card p-5 shadow-panel">
            <h2 className="mb-3 text-h3 text-ivory-100">特徴(全回答から)</h2>
            <List items={live.features} />
          </section>
          <section className="rounded-xl border border-border bg-card p-5 shadow-panel">
            <h2 className="mb-3 text-h3 text-ivory-100">データ(全回答の集計)</h2>
            <StatsBlock stats={live.stats} />
          </section>
        </>
      )}

      {analyses.length > 1 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-panel">
          <h2 className="mb-3 text-h3 text-ivory-100">過去の分析</h2>
          <div className="flex flex-col gap-3">
            {analyses.slice(1).map((analysis, index) => {
              const past = JSON.parse(analysis.analysisJson) as AnalysisNarrative;
              const stats = JSON.parse(analysis.statsJson) as AnalysisStats;
              return (
                <details key={analysis.id} className="rounded-lg border border-border bg-navy-800/60 p-3">
                  <summary className="cursor-pointer text-body-sm text-ivory-200">
                    第{analyses.length - 1 - index}回 {analysis.periodFrom}〜{analysis.periodTo}(正答率{pct(stats.accuracy)})
                  </summary>
                  <p className="mt-2 text-body-sm leading-relaxed text-slate-300">{past.summary}</p>
                </details>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
