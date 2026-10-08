import { ChevronRight, MessagesSquare, Sparkles, UsersRound } from "lucide-react";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";
import { MagnitudeBarList } from "@/components/magnitude-bar-list";
import { StudentCard } from "@/components/student-card";
import {
  getLiveStumbleTotals,
  getLiveSubjectTotals,
  getLiveTodaysNewQuestions,
  getLiveTotalPendingChecks,
  getLiveTotalQuestionsLast14Days,
  getRoster,
} from "@/lib/roster";

const HEALTH_RANK: Record<string, number> = { urgent: 0, watch: 1, good: 2 };

// SQLiteから毎回最新の名簿を読むため、静的レンダリングのキャッシュを無効化する
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const students = getRoster();
  const totalPendingChecks = getLiveTotalPendingChecks();
  const totalQuestionsLast14Days = getLiveTotalQuestionsLast14Days();
  const { count: todaysNewQuestions, deltaLabel: todaysNewQuestionsDelta } =
    getLiveTodaysNewQuestions();
  const subjectTotals = getLiveSubjectTotals();
  const stumbleTotals = getLiveStumbleTotals();
  const priorityQueue = [...students]
    .sort((a, b) => {
      if (HEALTH_RANK[a.health] !== HEALTH_RANK[b.health]) {
        return HEALTH_RANK[a.health] - HEALTH_RANK[b.health];
      }
      return b.pendingTeacherChecks - a.pendingTeacherChecks;
    })
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      {/* KPI row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="担当生徒数"
          value={`${students.length}`}
          icon={UsersRound}
        />
        <StatTile
          label="本日の新着質問"
          value={`${todaysNewQuestions}`}
          icon={MessagesSquare}
          delta={{
            value: `${todaysNewQuestionsDelta}件 前日比`,
            direction: todaysNewQuestionsDelta.startsWith("-") ? "down" : "up",
            isPositive: !todaysNewQuestionsDelta.startsWith("-"),
          }}
        />
        <StatTile
          label="講師確認待ち"
          value={`${totalPendingChecks}`}
          icon={Sparkles}
          emphasis={totalPendingChecks > 0}
        />
        <StatTile
          label="直近14日の質問数"
          value={`${totalQuestionsLast14Days}`}
          icon={MessagesSquare}
        />
      </section>

      {/* Priority queue — 俯瞰して最初に見るべきもの */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-h2 text-ivory-100">本日の優先アクション</h2>
            <p className="mt-1 text-body-sm text-slate-400">
              状態と講師確認の滞留から、対応すべき生徒を自動で並び替えています。
            </p>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {priorityQueue.map((student) => (
            <div
              key={student.id}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <StatusBadge health={student.health} />
                <div>
                  <p className="text-body font-medium text-ivory-100">
                    {student.name}
                    <span className="ml-2 text-caption font-normal text-slate-500">
                      {student.targetUniversity}
                    </span>
                  </p>
                  <p className="mt-0.5 text-body-sm text-slate-300">
                    {student.priorityAction.headline}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="flex shrink-0 items-center gap-1 self-start text-body-sm font-medium text-gold-400 transition-colors duration-300 hover:text-gold-300 sm:self-center"
              >
                詳細を確認
                <ChevronRight className="size-4" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Weakness analysis */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-h3 text-ivory-100">教科別の質問件数</h2>
          <p className="mt-1 mb-5 text-body-sm text-slate-400">
            全生徒・直近14日の合計
          </p>
          <MagnitudeBarList items={subjectTotals.map((s) => ({ label: s.subject, value: s.count }))} variant="uniform" />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-h3 text-ivory-100">全体のつまずき傾向</h2>
          <p className="mt-1 mb-5 text-body-sm text-slate-400">
            もっとも件数の多いタグを優先課題として提示
          </p>
          <MagnitudeBarList items={stumbleTotals.map((s) => ({ label: s.label, value: s.count }))} variant="emphasis" />
        </div>
      </section>

      {/* Student roster */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-h2 text-ivory-100">担当生徒</h2>
          <span className="text-caption text-slate-500">
            {students.length}名を表示中
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      </section>
    </div>
  );
}
