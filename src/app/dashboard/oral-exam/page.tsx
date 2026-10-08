import Link from "next/link";
import { BookOpen, BookMarked, Clock3, Mic, ScanLine, Users } from "lucide-react";
import { CreateBookDialog } from "@/components/oral-exam/create-book-dialog";
import {
  ensureOralExamSeeded,
  getAssignedBooksForStudent,
  getOralExamBooks,
  getOralExamStudentSummary,
} from "@/lib/db";
import { getRoster } from "@/lib/roster";
import { masteryLevelLabel } from "@/lib/oral-exam-mastery";
import { formatRelativeTimeJa } from "@/lib/format";
import { REFERENCE_BOOK_CATALOG } from "@/lib/reference-book-catalog";

// SQLiteから毎回最新の参考書・進捗データを読むため、静的レンダリングのキャッシュを無効化する
export const dynamic = "force-dynamic";

export default function DashboardOralExamPage() {
  ensureOralExamSeeded();
  const books = getOralExamBooks();
  const roster = getRoster();
  const catalogTitles = new Set(REFERENCE_BOOK_CATALOG.map((entry) => entry.title));
  const catalogBooks = books.filter((book) => catalogTitles.has(book.title));
  const catalogQuestionCount = catalogBooks.reduce((total, book) => total + book.questionCount, 0);

  const studentRows = roster.map((student) => {
    const assignedBooks = getAssignedBooksForStudent(student.id);
    const summary = getOralExamStudentSummary(student.id);
    return { student, assignedBooks, summary };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ivory-100">口頭試問</h1>
          <p className="mt-1 text-body-sm text-slate-400">
            参考書ごとの問題を管理し、生徒に割り当てて習熟度・反応速度を追跡します。
          </p>
        </div>
        <CreateBookDialog />
      </div>

      <section className="rounded-xl border border-gold-500/20 bg-gold-500/[0.05] p-6 shadow-panel">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-gold-400">
              <BookMarked className="size-5" strokeWidth={1.75} />
              <h2 className="text-h2 text-ivory-100">このアプリの概要</h2>
            </div>
            <p className="mt-2 text-body-sm leading-6 text-slate-300">
              参考書の内容を一問一答に分解し、生徒が音声で答え、考えずに即答できるまで反復する口頭試問ドリルです。
              講師は参考書を割り当て、正誤・反応時間・習熟度を確認できます。
            </p>
            <p className="mt-2 flex items-start gap-2 text-caption leading-5 text-slate-400">
              <ScanLine className="mt-0.5 size-3.5 shrink-0 text-gold-400" strokeWidth={1.75} />
              sankosho のPDFは資料台帳への登録まで完了しています。問題本文は抽出結果を確認してから登録します。
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-3 lg:min-w-[310px]">
            <div className="border-l border-white/10 pl-3">
              <p className="text-caption text-slate-500">資料冊数</p>
              <p className="mt-1 text-h2 tabular-nums text-ivory-100">{catalogBooks.length}</p>
            </div>
            <div className="border-l border-white/10 pl-3">
              <p className="text-caption text-slate-500">問題登録</p>
              <p className="mt-1 text-h2 tabular-nums text-ivory-100">{catalogQuestionCount}</p>
            </div>
            <div className="border-l border-white/10 pl-3">
              <p className="text-caption text-slate-500">問題化待ち</p>
              <p className="mt-1 text-h2 tabular-nums text-gold-400">{catalogBooks.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h3 text-ivory-100">参考書一覧</h2>
        {books.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-card py-10 text-center">
            <p className="text-body-sm text-slate-400">
              まだ参考書がありません。「参考書を追加」から登録してください。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {books.map((book) => (
              <Link
                key={book.id}
                href={`/dashboard/oral-exam/books/${book.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-panel transition-all duration-400 ease-luxury hover:-translate-y-0.5 hover:border-gold-500/25 hover:shadow-panel-lg"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-gold-400" strokeWidth={1.75} />
                  <h3 className="text-h3 text-ivory-100">{book.title}</h3>
                </div>
                {book.subject && (
                  <p className="text-caption text-slate-500">{book.subject}</p>
                )}
                {book.description && (
                  <p className="line-clamp-2 text-body-sm text-slate-300">
                    {book.description}
                  </p>
                )}
                <div className="mt-auto flex items-center gap-4 pt-2 text-caption text-slate-400">
                  <span className="tabular-nums">問題数 {book.questionCount}</span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <Users className="size-3.5" strokeWidth={1.75} />
                    {book.assignedStudentCount}名に割当
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-h3 text-ivory-100">生徒別の進捗</h2>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-6 shadow-panel">
          {studentRows.map(({ student, assignedBooks, summary }) => (
            <Link
              key={student.id}
              href={`/dashboard/oral-exam/students/${student.id}`}
              className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-5 last:pb-5 transition-colors duration-300 hover:bg-navy-800/40"
            >
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ivory-100">{student.name}</p>
                <p className="mt-0.5 truncate text-caption text-slate-500">
                  {assignedBooks.length > 0
                    ? assignedBooks.map((b) => b.title).join("、")
                    : "参考書が未割当"}
                </p>
              </div>
              <div className="flex items-center gap-4 text-caption text-slate-400">
                <span className="tabular-nums">
                  習得 {summary.masteredCount}/{summary.totalQuestions}
                </span>
                {summary.dueCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-gold-500/25 bg-gold-500/[0.08] px-2 py-0.5 text-gold-400">
                    <Mic className="size-3 shrink-0" strokeWidth={1.75} />
                    復習待ち {summary.dueCount}
                  </span>
                )}
                {summary.avgResponseTimeMs != null && (
                  <span className="flex items-center gap-1 tabular-nums">
                    <Clock3 className="size-3.5" strokeWidth={1.75} />
                    平均{Math.round(summary.avgResponseTimeMs / 100) / 10}秒
                  </span>
                )}
                <span className="tabular-nums text-slate-500">
                  {summary.lastAttemptAt
                    ? formatRelativeTimeJa(summary.lastAttemptAt)
                    : "未実施"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-caption text-slate-500">
        習熟度ラベルの目安: {masteryLevelLabel(0)} → {masteryLevelLabel(2)} → {masteryLevelLabel(5)}
        （正解が続くほど復習間隔が伸び、無意識に答えられるレベルへ近づきます）
      </p>
    </div>
  );
}
