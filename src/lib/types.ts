export type StudentHealth = "good" | "watch" | "urgent";

export interface SubjectBreakdown {
  subject: string;
  count: number;
}

export interface StumbleTag {
  label: string;
  count: number;
}

export interface PriorityAction {
  headline: string;
  detail: string;
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  initials: string;
  grade: string;
  targetUniversity: string;
  health: StudentHealth;
  pendingTeacherChecks: number;
  questionsLast14Days: number;
  totalQuestions: number;
  lastActivity: string;
  subjectBreakdown: SubjectBreakdown[];
  topStumbles: StumbleTag[];
  priorityAction: PriorityAction;
}

export interface TutorResponse {
  summary: string;
  steps: string[];
  weaknessTag: string;
  reviewSuggestion: string;
}

export type AnswerStatus =
  | "未着手"
  | "途中まで解いた"
  | "解いたが不正解"
  | "解けたが不安"
  | "復習完了";

export type Confidence = "低" | "中" | "高";
export type Difficulty = "基礎" | "標準" | "やや難" | "難";
export type QuestionFormat =
  | "普段の問題"
  | "過去問"
  | "予想問題"
  | "模試"
  | "教材";
export type InputType = "テキスト" | "写真" | "PDF";

export interface Attachment {
  name: string;
  dataUrl: string;
}

export interface QuestionMeta {
  university: string;
  year: string;
  difficulty: Difficulty;
  format: QuestionFormat;
  inputType: InputType;
  studentAttempt: string;
  answerStatus: AnswerStatus;
  confidence: Confidence;
  weaknessHint: string;
  teacherCheckNeeded: boolean;
}

export interface QaHistoryEntry extends TutorResponse, QuestionMeta {
  id: string;
  studentId: string;
  subject: string;
  unit: string;
  question: string;
  attachments: Attachment[];
  askedAt: string;
  teacherCheckResolved: boolean;
}

export interface NewStudentInput {
  name: string;
  grade: string;
  targetUniversity: string;
}

export interface ExamSubjectScore {
  subject: string;
  score: number;
  fullScore: number;
  deviation: number | null; // 偏差値（未入力可）
}

export interface ExamUnitScore {
  subject: string;
  unit: string;
  correctRate: number; // 正答率(%)
}

export interface ExamWeaknessReport {
  overview: string; // 現状把握
  weaknessDetail: string; // 具体的な弱点の深掘り
  outlook: string; // 前向きな見通しと提案
  priorityFocus: string[]; // 優先対策分野（2〜4件）
}

export interface ProspectAssessmentInput {
  name: string;
  grade: string;
  targetUniversity: string;
  examName: string;
  examDate: string;
  subjects: ExamSubjectScore[];
  units: ExamUnitScore[];
  notes: string;
}

export interface ProspectAssessment extends ProspectAssessmentInput {
  id: string;
  report: ExamWeaknessReport;
  source: "claude" | "rule-based";
  createdAt: string;
}

export type OralExamInputMode = "voice" | "handwriting" | "keyboard";

// --- 口頭試問（参考書を極めるドリル）---------------------------------------

export interface OralExamBook {
  id: string;
  title: string;
  subject: string;
  description: string;
  createdAt: string;
  questionCount: number;
  assignedStudentCount: number;
}

export interface OralExamFilterOptions {
  pages: number[];
  chapters: string[];
  questionCount: number;
}

export interface OralExamQuestionRecord {
  id: string;
  bookId: string;
  orderIndex: number;
  sourcePage: number | null;
  category: string;
  prompt: string;
  modelAnswer: string;
  createdAt: string;
  reviewedAt: string | null;
  blocked: boolean;
}

export interface OralExamAssignment {
  id: string;
  studentId: string;
  bookId: string;
  assignedAt: string;
}

export type MasteryResult = "correct" | "incorrect";

export interface OralExamMastery {
  studentId: string;
  questionId: string;
  level: number; // 0(未着手)〜5(完全習得・無意識レベル)
  correctStreak: number;
  totalAttempts: number;
  lastResult: MasteryResult | null;
  lastResponseTimeMs: number | null;
  lastAttemptAt: string | null;
  nextReviewAt: string | null;
}

export interface OralExamSession {
  id: string;
  studentId: string;
  bookId: string;
  startedAt: string;
  endedAt: string | null;
  questionCount: number;
  correctCount: number;
}

export interface OralExamAttempt {
  id: string;
  sessionId: string;
  studentId: string;
  questionId: string;
  bookId: string;
  bookTitle: string;
  category: string;
  questionPrompt: string;
  inputMode: OralExamInputMode;
  answerText: string;
  answerImageDataUrl: string;
  responseTimeMs: number;
  isCorrect: boolean;
  evaluation: string;
  strengths: string[];
  improvements: string[];
  masteryLevel: number;
  feedbackSource: "claude" | "demo";
  teacherComment: string;
  createdAt: string;
}

export interface OralExamQueueItem {
  question: OralExamQuestionRecord;
  mastery: OralExamMastery | null;
}
