import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { MagnitudeBarList } from "@/components/magnitude-bar-list";
import { StatusBadge } from "@/components/status-badge";
import {
  getAssignedBooksForStudent,
  getOralExamAttempts,
  getOralExamStudentSummary,
  getQaHistory,
  getStudentFeedbackForStudent,
} from "@/lib/db";
import { formatRelativeTimeJa } from "@/lib/format";
import { getRoster } from "@/lib/roster";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = getRoster().find((item) => item.id === id);
  if (!student) {
    return <div className="py-16 text-center text-body-sm text-slate-400">生徒が見つかりません。</div>;
  }

  const history = getQaHistory(id);
  const feedback = getStudentFeedbackForStudent(id);
  const oralSummary = getOralExamStudentSummary(id);
  const oralAttempts = getOralExamAttempts(id, { limit: 8 });
  const assignedBooks = getAssignedBooksForStudent(id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/students"
        className="flex w-fit items-center gap-1.5 text-body-sm text-slate-400 hover:text-ivory-200"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        生徒一覧に戻る
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full border border-white/[0.06] bg-navy-600 text-body font-medium text-gold-400">
              {student.initials}
            </div>
            <div>
              <h1 className="text-h1 text-ivory-100">{student.name}</h1>
              <p className="mt-1 text-body-sm text-slate-400">
                {student.grade} ・ 志望校 {student.targetUniversity}
              </p>
            </div>
          </div>
        </div>
        <StatusBadge health={student.health} />
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="質問総数" value={`${history.length}件`} />
        <Metric label="直近14日" value={`${student.questionsLast14Days}件`} />
        <Metric label="講師確認待ち" value={`${student.pendingTeacherChecks}件`} alert={student.pendingTeacherChecks > 0} />
        <Metric label="最終活動" value={student.lastActivity} />
      </section>

      <section className="rounded-xl border border-gold-500/20 bg-card p-6 shadow-panel">
        <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">優先アクション</p>
        <h2 className="mt-1 text-h3 text-ivory-100">{student.priorityAction.headline}</h2>
        <p className="mt-1 text-body-sm leading-relaxed text-slate-300">{student.priorityAction.detail}</p>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-h3 text-ivory-100">教科別の質問</h2>
          <div className="mt-5">
            <MagnitudeBarList items={student.subjectBreakdown.map((item) => ({ label: item.subject, value: item.count }))} variant="uniform" />
            {student.subjectBreakdown.length === 0 && <p className="text-body-sm text-slate-500">まだ質問がありません。</p>}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-h3 text-ivory-100">つまずき傾向</h2>
          <div className="mt-5">
            <MagnitudeBarList items={student.topStumbles.map((item) => ({ label: item.label, value: item.count }))} variant="emphasis" />
            {student.topStumbles.length === 0 && <p className="text-body-sm text-slate-500">まだ質問がありません。</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-h3 text-ivory-100">質問履歴</h2>
            <p className="mt-1 text-body-sm text-slate-400">生徒から届いた質問とAI回答を確認できます。</p>
          </div>
          <Link href={`/dashboard/history?studentId=${encodeURIComponent(id)}`} className="text-body-sm text-gold-400 hover:text-gold-300">すべて見る</Link>
        </div>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {history.length === 0 && <p className="py-6 text-center text-body-sm text-slate-500">まだ質問がありません。</p>}
          {history.slice(0, 8).map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-caption font-medium text-gold-400/80">{entry.subject} ・ {entry.unit}</span>
                <span className="text-caption text-slate-500">{formatRelativeTimeJa(entry.askedAt)}</span>
              </div>
              <p className="text-body-sm text-ivory-200">{entry.question}</p>
              <div className="flex flex-wrap items-center gap-3 text-caption text-slate-500">
                <span>解答状況: {entry.answerStatus}</span><span>確信度: {entry.confidence}</span>
                {entry.teacherCheckNeeded && <span className={entry.teacherCheckResolved ? "text-sage-500" : "text-crimson-500"}>講師確認: {entry.teacherCheckResolved ? "対応済み" : "未対応"}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-h3 text-ivory-100">口頭試問</h2>
          <p className="mt-1 text-body-sm text-slate-400">{assignedBooks.length > 0 ? `割当参考書: ${assignedBooks.map((book) => book.title).join("、")}` : "参考書は未割当です。"}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-caption text-slate-400">
            <span>習得済み <strong className="text-ivory-100">{oralSummary.masteredCount}/{oralSummary.totalQuestions}</strong></span>
            <span>復習待ち <strong className="text-gold-400">{oralSummary.dueCount}</strong></span>
            <span>回答数 <strong className="text-ivory-100">{oralSummary.totalAttempts}</strong></span>
            <span>平均反応 <strong className="text-ivory-100">{oralSummary.avgResponseTimeMs == null ? "—" : `${Math.round(oralSummary.avgResponseTimeMs / 100) / 10}秒`}</strong></span>
          </div>
          {oralAttempts.length > 0 && <p className="mt-4 text-caption text-slate-500">最新回答: {formatRelativeTimeJa(oralAttempts[0].createdAt)}</p>}
          <Link href={`/dashboard/oral-exam/students/${id}`} className="mt-4 inline-block text-body-sm text-gold-400 hover:text-gold-300">口頭試問の詳細を見る</Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-h3 text-ivory-100">生徒からの要望</h2>
          <div className="mt-4 flex flex-col divide-y divide-border">
            {feedback.length === 0 && <p className="py-4 text-body-sm text-slate-500">まだ要望はありません。</p>}
            {feedback.slice(0, 5).map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-caption text-slate-500"><span>{formatRelativeTimeJa(item.createdAt)}</span><span className={item.resolved ? "text-sage-500" : "text-crimson-500"}>{item.resolved ? "対応済み" : "未対応"}</span></div>
                <p className="mt-1 whitespace-pre-line text-body-sm text-ivory-200">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-panel"><p className="text-caption text-slate-500">{label}</p><p className={`mt-1 flex items-center gap-1 text-h2 tabular-nums ${alert ? "text-crimson-500" : "text-ivory-100"}`}><Clock3 className="size-4 text-slate-500" strokeWidth={1.75} />{value}</p></div>;
}
