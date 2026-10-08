import { demoStudent, students as mockStudents } from "@/lib/mock-data";
import {
  addStudent as dbAddStudent,
  type AddedStudentRecord,
  ensureSeeded,
  getAddedStudents,
  getLatestActivityIso,
  getQaHistoryCountSince,
  getQaHistoryTotalCount,
  getSubjectBreakdown,
  getTopStumbles,
  getUnresolvedTeacherCheckCount,
} from "@/lib/db";
import { formatRelativeTimeJa } from "@/lib/format";
import type { NewStudentInput, Student } from "@/lib/types";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 実際にDB上で質問実績がある生徒だけ、統計をライブ値で上書きする。
// まだ質問がない（登録直後の）生徒はモック/初期値のまま表示する。
function withLiveStats(student: Student): Student {
  const totalQuestions = getQaHistoryTotalCount(student.id);
  if (totalQuestions === 0) return student;

  const since = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();
  const lastActivityIso = getLatestActivityIso(student.id);

  return {
    ...student,
    pendingTeacherChecks: getUnresolvedTeacherCheckCount(student.id),
    questionsLast14Days: getQaHistoryCountSince(student.id, since),
    totalQuestions,
    lastActivity: lastActivityIso
      ? formatRelativeTimeJa(lastActivityIso)
      : student.lastActivity,
    subjectBreakdown: getSubjectBreakdown(student.id),
    topStumbles: getTopStumbles(student.id),
  };
}

function addedRecordToStudent(record: AddedStudentRecord): Student {
  return {
    id: record.id,
    name: record.name,
    initials: record.initials,
    grade: record.grade,
    targetUniversity: record.targetUniversity,
    health: "good",
    pendingTeacherChecks: 0,
    questionsLast14Days: 0,
    totalQuestions: 0,
    lastActivity: formatRelativeTimeJa(record.createdAt),
    subjectBreakdown: [],
    topStumbles: [],
    priorityAction: {
      headline: "まだ質問がありません",
      detail: "生徒が最初の質問を送ると、ここに優先アクションが表示されます。",
    },
  };
}

// キュレーション済みのモック生徒（デモ生徒本人を含む）は、俯瞰ダッシュボードの
// 見え方をそのまま保つため、実データで上書きしない。実データが反映されるのは
// /student 本人のページと、新しく追加された生徒（最初から実データしか持たない）のみ。
export function getRoster(): Student[] {
  ensureSeeded(demoStudent.id);
  const mockIds = new Set(mockStudents.map((student) => student.id));
  const added = getAddedStudents()
    .filter((student) => !mockIds.has(student.id))
    .map(addedRecordToStudent)
    .map(withLiveStats);
  return [...mockStudents, ...added];
}

export function addStudentToRoster(input: NewStudentInput): Student {
  const record = dbAddStudent(input);
  return addedRecordToStudent(record);
}

// ダッシュボードの「講師確認待ち」「直近14日の質問数」の合計は、キュレーション
// 済みモック生徒の凍結値をベースに、実データを持つデモ生徒の分だけ実数へ
// 差し替える。生徒カードの表示（凍結 or ライブ）と、集計の中身を一致させるため。
export function getLiveTotalPendingChecks(): number {
  const baseTotal = getRoster().reduce(
    (sum, s) => sum + s.pendingTeacherChecks,
    0,
  );
  const demoLive = getUnresolvedTeacherCheckCount(demoStudent.id);
  return baseTotal - demoStudent.pendingTeacherChecks + demoLive;
}

export function getLiveTotalQuestionsLast14Days(): number {
  const baseTotal = getRoster().reduce(
    (sum, s) => sum + s.questionsLast14Days,
    0,
  );
  const since = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();
  const demoLive = getQaHistoryCountSince(demoStudent.id, since);
  return baseTotal - demoStudent.questionsLast14Days + demoLive;
}

// 教科別・つまずき傾向の集計は、以前は固定の集計値定数を独自に持っていたため
// 生徒カードごとの内訳（subjectBreakdown/topStumbles）と合計が一致しない不整合があった。
// ここでは名簿の各生徒が持つ内訳をそのまま合算するため、カード表示と集計が常に一致し、
// 新しく追加された生徒（実データ）の内訳も自動的に反映される。
export function getLiveSubjectTotals(): { subject: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const student of getRoster()) {
    for (const item of student.subjectBreakdown) {
      totals.set(item.subject, (totals.get(item.subject) ?? 0) + item.count);
    }
  }
  return [...totals.entries()]
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);
}

export function getLiveStumbleTotals(): { label: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const student of getRoster()) {
    for (const item of student.topStumbles) {
      totals.set(item.label, (totals.get(item.label) ?? 0) + item.count);
    }
  }
  return [...totals.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// 「本日の新着質問」も同様に、以前は固定値(8件など)を常に表示していた。
// 名簿全生徒のqa_historyから直近24時間・その前の24時間を実際に数え、前日比を出す。
export function getLiveTodaysNewQuestions(): {
  count: number;
  deltaLabel: string;
} {
  const studentIds = getRoster().map((s) => s.id);
  const now = Date.now();
  const todayStart = new Date(now - DAY_MS).toISOString();
  const yesterdayStart = new Date(now - 2 * DAY_MS).toISOString();

  let today = 0;
  let yesterday = 0;
  for (const id of studentIds) {
    const sinceYesterday = getQaHistoryCountSince(id, yesterdayStart);
    const sinceToday = getQaHistoryCountSince(id, todayStart);
    today += sinceToday;
    yesterday += sinceYesterday - sinceToday;
  }

  const delta = today - yesterday;
  return { count: today, deltaLabel: delta >= 0 ? `+${delta}` : `${delta}` };
}
