import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { demoStudent, demoStudentQaHistory, students } from "@/lib/mock-data";
import { demoOralExamBookSeed } from "@/lib/oral-exam-mock";
import { isDue } from "@/lib/oral-exam-mastery";
import { REFERENCE_BOOK_CATALOG } from "@/lib/reference-book-catalog";
import type {
  Attachment,
  ExamWeaknessReport,
  NewStudentInput,
  OralExamAssignment,
  OralExamAttempt,
  OralExamBook,
  OralExamFilterOptions,
  OralExamInputMode,
  OralExamMastery,
  OralExamQuestionRecord,
  OralExamQueueItem,
  OralExamSession,
  MasteryResult,
  ProspectAssessment,
  ProspectAssessmentInput,
  QaHistoryEntry,
  QuestionMeta,
  StumbleTag,
  SubjectBreakdown,
  TutorResponse,
} from "@/lib/types";

// 本番では DATA_DIR を明示的に指定し、デプロイ先のディレクトリ(process.cwd())から
// 独立した永続ボリュームに置く。指定が無ければ開発時と同じ挙動(プロジェクト直下の
// data/)にフォールバックする。これにより、standalone ビルドの出力に開発用DBが
// 紛れ込んだり、再デプロイでデータディレクトリの場所が変わったりすることを防ぐ。
//
// ただし `next build` 中(NEXT_PHASE=phase-production-build)は、Renderなどの
// 永続ディスクがまだマウントされておらず、本来のDATA_DIR(例: /var/data)への
// アクセスが失敗する。さらに、ビルドのページデータ収集は複数ワーカー
// プロセスが並列にこのモジュールを読み込むため、同じ場所にフォールバック
// すると各プロセスが同じSQLiteファイルを同時に開こうとして
// "database is locked" で失敗する。そのためビルド中はプロセスごとに
// 完全に独立した使い捨てディレクトリ(OSの一時フォルダ配下)を使う。
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
const DATA_DIR = isProductionBuild
  ? path.join(os.tmpdir(), `takihara-build-${process.pid}`)
  : process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

// node:sqlite is built into Node — no native addon / node-gyp build step,
// unlike better-sqlite3. Fine for this app's single-writer local usage.
const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS qa_history (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    unit TEXT NOT NULL,
    question TEXT NOT NULL,
    summary TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    weakness_tag TEXT NOT NULL,
    review_suggestion TEXT NOT NULL,
    university TEXT NOT NULL DEFAULT '',
    year TEXT NOT NULL DEFAULT '',
    difficulty TEXT NOT NULL DEFAULT '標準',
    format TEXT NOT NULL DEFAULT '普段の問題',
    input_type TEXT NOT NULL DEFAULT 'テキスト',
    student_attempt TEXT NOT NULL DEFAULT '',
    answer_status TEXT NOT NULL DEFAULT '未着手',
    confidence TEXT NOT NULL DEFAULT '中',
    weakness_hint TEXT NOT NULL DEFAULT '',
    teacher_check_needed INTEGER NOT NULL DEFAULT 0,
    teacher_check_resolved INTEGER NOT NULL DEFAULT 0,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    asked_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    grade TEXT NOT NULL,
    target_university TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// student.user_id は後発の列。既存のapp.dbには無い場合があるため安全に追加する。
const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
function ensureColumn(table: string, column: string, ddl: string) {
  if (!SQL_IDENTIFIER_RE.test(table) || !SQL_IDENTIFIER_RE.test(column)) {
    throw new Error(`ensureColumn: invalid identifier "${table}"."${column}"`);
  }
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("students", "user_id", "user_id TEXT");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS prospect_assessments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    target_university TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    subjects_json TEXT NOT NULL,
    units_json TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    report_json TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

function ensureStudentAccounts(): void {
  // 以前はここで初期パスワードを data/student-initial-credentials.json に平文保存していたが、
  // ディスク上に恒久的な平文パスワードを残すのはセキュリティ上望ましくないため廃止した。
  // 新規発行時のみ、その場でコンソールに一度だけ表示する（Djangoのcreatesuperuser等と同様の方式）。
  const legacyCredentialsPath = path.join(DATA_DIR, "student-initial-credentials.json");
  if (fs.existsSync(legacyCredentialsPath)) {
    fs.rmSync(legacyCredentialsPath);
    console.warn(
      `[起動時セキュリティクリーンアップ] ${legacyCredentialsPath} を削除しました（平文パスワードの恒久保存を廃止したため）。`,
    );
  }

  const newlyCreated: { email: string; name: string; password: string }[] = [];

  for (const student of demoStudentsWithAccounts()) {
    if (!student.email) continue;
    const existingStudent = db
      .prepare("SELECT id FROM students WHERE id = ?")
      .get(student.id) as { id: string } | undefined;
    if (!existingStudent) {
      db.prepare(
        "INSERT INTO students (id, name, initials, grade, target_university, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        student.id,
        student.name,
        student.initials,
        student.grade,
        student.targetUniversity,
        new Date().toISOString(),
      );
    }

    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(student.email) as
      | { id: string }
      | undefined;
    let userId = user?.id;
    if (!userId) {
      const password = createInitialPassword(student.email);
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(password, salt, 64).toString("hex");
      userId = randomUUID();
      db.prepare(
        "INSERT INTO users (id, email, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(userId, student.email, `${salt}:${hash}`, "family", student.name, new Date().toISOString());
      newlyCreated.push({ email: student.email, name: student.name, password });
    }
    db.prepare("UPDATE students SET user_id = ? WHERE id = ?").run(userId, student.id);
  }

  if (newlyCreated.length > 0) {
    console.log(
      "\n[初回セットアップ] デモ生徒アカウントを作成しました。パスワードは今この場でのみ表示されます。必要な場合は今すぐ控えてください:",
    );
    for (const { email, name, password } of newlyCreated) {
      console.log(`  ${name} <${email}> : ${password}`);
    }
    console.log(
      "次回以降のログでは再表示されません。忘れた場合は `node scripts/create-user.mjs` で作り直してください。\n",
    );
  }
}

function createInitialPassword(email: string): string {
  const suffix = randomBytes(9).toString("base64url").slice(0, 12);
  const prefix = createHash("sha256").update(email).digest("hex").slice(0, 4);
  return `${prefix}${suffix}A1!`;
}

function demoStudentsWithAccounts() {
  return students;
}

if (process.env.NEXT_PHASE !== "phase-production-build") {
  ensureStudentAccounts();
}

db.exec(`
  CREATE TABLE IF NOT EXISTS oral_exam_books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS oral_exam_questions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL,
    model_answer TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )
`);
// 生徒に出題する直前にAIで内容を点検し、直せるものは直し、直せないものは出題対象から
// 外す(blocked)ための列。reviewed_at が null のままなら未点検＝出題前に点検が必要。
ensureColumn("oral_exam_questions", "reviewed_at", "reviewed_at TEXT");
ensureColumn("oral_exam_questions", "blocked", "blocked INTEGER NOT NULL DEFAULT 0");
ensureColumn("oral_exam_questions", "source_page", "source_page INTEGER");

db.exec(`
  CREATE TABLE IF NOT EXISTS oral_exam_assignments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL,
    UNIQUE(student_id, book_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS oral_exam_sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    question_count INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS oral_exam_attempts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    book_title TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    question_prompt TEXT NOT NULL DEFAULT '',
    input_mode TEXT NOT NULL DEFAULT 'keyboard',
    answer_text TEXT NOT NULL DEFAULT '',
    answer_image_data_url TEXT NOT NULL DEFAULT '',
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    is_correct INTEGER NOT NULL DEFAULT 0,
    evaluation TEXT NOT NULL DEFAULT '',
    strengths_json TEXT NOT NULL DEFAULT '[]',
    improvements_json TEXT NOT NULL DEFAULT '[]',
    mastery_level INTEGER NOT NULL DEFAULT 0,
    feedback_source TEXT NOT NULL DEFAULT 'demo',
    teacher_comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS oral_exam_mastery (
    student_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    correct_streak INTEGER NOT NULL DEFAULT 0,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    last_result TEXT,
    last_response_time_ms INTEGER,
    last_attempt_at TEXT,
    next_review_at TEXT,
    PRIMARY KEY (student_id, question_id)
  )
`);

interface QaRow {
  id: string;
  student_id: string;
  subject: string;
  unit: string;
  question: string;
  summary: string;
  steps_json: string;
  weakness_tag: string;
  review_suggestion: string;
  university: string;
  year: string;
  difficulty: string;
  format: string;
  input_type: string;
  student_attempt: string;
  answer_status: string;
  confidence: string;
  weakness_hint: string;
  teacher_check_needed: number;
  teacher_check_resolved: number;
  attachments_json: string;
  asked_at: string;
}

function rowToEntry(row: QaRow): QaHistoryEntry {
  return {
    id: row.id,
    studentId: row.student_id,
    subject: row.subject,
    unit: row.unit,
    question: row.question,
    summary: row.summary,
    steps: JSON.parse(row.steps_json),
    weaknessTag: row.weakness_tag,
    reviewSuggestion: row.review_suggestion,
    university: row.university,
    year: row.year,
    difficulty: row.difficulty as QuestionMeta["difficulty"],
    format: row.format as QuestionMeta["format"],
    inputType: row.input_type as QuestionMeta["inputType"],
    studentAttempt: row.student_attempt,
    answerStatus: row.answer_status as QuestionMeta["answerStatus"],
    confidence: row.confidence as QuestionMeta["confidence"],
    weaknessHint: row.weakness_hint,
    teacherCheckNeeded: row.teacher_check_needed === 1,
    teacherCheckResolved: row.teacher_check_resolved === 1,
    attachments: JSON.parse(row.attachments_json),
    askedAt: row.asked_at,
  };
}

export function ensureSeeded(studentId: string) {
  for (const entry of demoStudentQaHistory) {
    const alreadySeeded = db
      .prepare("SELECT 1 FROM qa_history WHERE student_id = ? AND id = ?")
      .get(studentId, entry.id);
    if (alreadySeeded) continue;

    const conflictingId = db
      .prepare("SELECT 1 FROM qa_history WHERE id = ?")
      .get(entry.id);
    const seedId = conflictingId ? randomUUID() : entry.id;
    insertQaHistory(
      studentId,
      { subject: entry.subject, unit: entry.unit, question: entry.question },
      entry,
      {
        university: entry.university,
        year: entry.year,
        difficulty: entry.difficulty,
        format: entry.format,
        inputType: entry.inputType,
        studentAttempt: entry.studentAttempt,
        answerStatus: entry.answerStatus,
        confidence: entry.confidence,
        weaknessHint: entry.weaknessHint,
        teacherCheckNeeded: entry.teacherCheckNeeded,
      },
      entry.attachments,
      seedId,
      entry.askedAt,
    );
  }
}

export function getQaHistory(studentId: string): QaHistoryEntry[] {
  if (studentId === demoStudent.id) {
    ensureSeeded(studentId);
  }
  const rows = db
    .prepare(
      "SELECT * FROM qa_history WHERE student_id = ? ORDER BY asked_at DESC",
    )
    .all(studentId) as unknown as QaRow[];
  return rows.map(rowToEntry);
}

export function insertQaHistory(
  studentId: string,
  question: { subject: string; unit: string; question: string },
  response: TutorResponse,
  meta: QuestionMeta,
  attachments: Attachment[] = [],
  id: string = randomUUID(),
  askedAt: string = new Date().toISOString(),
): QaHistoryEntry {
  const entry: QaHistoryEntry = {
    id,
    studentId,
    subject: question.subject,
    unit: question.unit,
    question: question.question,
    askedAt,
    teacherCheckResolved: false,
    attachments,
    ...meta,
    ...response,
  };

  db.prepare(`
    INSERT OR IGNORE INTO qa_history
      (id, student_id, subject, unit, question, summary, steps_json, weakness_tag, review_suggestion,
       university, year, difficulty, format, input_type, student_attempt, answer_status, confidence,
       weakness_hint, teacher_check_needed, teacher_check_resolved, attachments_json, asked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.studentId,
    entry.subject,
    entry.unit,
    entry.question,
    entry.summary,
    JSON.stringify(entry.steps),
    entry.weaknessTag,
    entry.reviewSuggestion,
    entry.university,
    entry.year,
    entry.difficulty,
    entry.format,
    entry.inputType,
    entry.studentAttempt,
    entry.answerStatus,
    entry.confidence,
    entry.weaknessHint,
    entry.teacherCheckNeeded ? 1 : 0,
    entry.teacherCheckResolved ? 1 : 0,
    JSON.stringify(entry.attachments),
    entry.askedAt,
  );

  return entry;
}

export function resolveTeacherCheck(id: string, studentId: string): void {
  db.prepare(
    "UPDATE qa_history SET teacher_check_resolved = 1 WHERE id = ? AND student_id = ?",
  ).run(id, studentId);
}

export function getUnresolvedTeacherCheckCount(studentId: string): number {
  const { count } = db
    .prepare(
      "SELECT COUNT(*) as count FROM qa_history WHERE student_id = ? AND teacher_check_needed = 1 AND teacher_check_resolved = 0",
    )
    .get(studentId) as { count: number };
  return count;
}

export function getQaHistoryTotalCount(studentId: string): number {
  const { count } = db
    .prepare("SELECT COUNT(*) as count FROM qa_history WHERE student_id = ?")
    .get(studentId) as { count: number };
  return count;
}

export function getQaHistoryCountSince(
  studentId: string,
  sinceIso: string,
): number {
  const { count } = db
    .prepare(
      "SELECT COUNT(*) as count FROM qa_history WHERE student_id = ? AND asked_at >= ?",
    )
    .get(studentId, sinceIso) as { count: number };
  return count;
}

export function getLatestActivityIso(studentId: string): string | null {
  const row = db
    .prepare(
      "SELECT asked_at FROM qa_history WHERE student_id = ? ORDER BY asked_at DESC LIMIT 1",
    )
    .get(studentId) as { asked_at: string } | undefined;
  return row?.asked_at ?? null;
}

export function getSubjectBreakdown(studentId: string): SubjectBreakdown[] {
  const rows = db
    .prepare(
      "SELECT subject, COUNT(*) as count FROM qa_history WHERE student_id = ? GROUP BY subject ORDER BY count DESC",
    )
    .all(studentId) as unknown as { subject: string; count: number }[];
  return rows;
}

export function getTopStumbles(studentId: string): StumbleTag[] {
  const rows = db
    .prepare(
      "SELECT weakness_tag as label, COUNT(*) as count FROM qa_history WHERE student_id = ? GROUP BY weakness_tag ORDER BY count DESC LIMIT 5",
    )
    .all(studentId) as unknown as { label: string; count: number }[];
  return rows;
}

interface StudentRow {
  id: string;
  name: string;
  initials: string;
  grade: string;
  target_university: string;
  created_at: string;
}

export interface AddedStudentRecord {
  id: string;
  name: string;
  initials: string;
  grade: string;
  targetUniversity: string;
  createdAt: string;
}

function studentRowToRecord(row: StudentRow): AddedStudentRecord {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    grade: row.grade,
    targetUniversity: row.target_university,
    createdAt: row.created_at,
  };
}

export function getAddedStudents(): AddedStudentRecord[] {
  const rows = db
    .prepare("SELECT * FROM students ORDER BY created_at DESC")
    .all() as unknown as StudentRow[];
  return rows.map(studentRowToRecord);
}

export function getStudentById(studentId: string): AddedStudentRecord | null {
  const row = db
    .prepare("SELECT * FROM students WHERE id = ?")
    .get(studentId) as StudentRow | undefined;
  return row ? studentRowToRecord(row) : null;
}

// 生徒・保護者ログインアカウント(users)と生徒台帳(students)を紐付ける。
// 講師が生徒を追加した後、その生徒本人のログインアカウントを発行する運用を想定。
export function linkStudentToUser(studentId: string, userId: string): void {
  db.prepare("UPDATE students SET user_id = ? WHERE id = ?").run(
    userId,
    studentId,
  );
}

export function getStudentIdForUser(userId: string): string | null {
  const row = db
    .prepare("SELECT id FROM students WHERE user_id = ?")
    .get(userId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function addStudent(input: NewStudentInput): AddedStudentRecord {
  const record: AddedStudentRecord = {
    id: randomUUID(),
    name: input.name,
    initials: input.name.replace(/\s+/g, "").slice(0, 2),
    grade: input.grade,
    targetUniversity: input.targetUniversity,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO students (id, name, initials, grade, target_university, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.name,
    record.initials,
    record.grade,
    record.targetUniversity,
    record.createdAt,
  );

  return record;
}

interface ProspectRow {
  id: string;
  name: string;
  grade: string;
  target_university: string;
  exam_name: string;
  exam_date: string;
  subjects_json: string;
  units_json: string;
  notes: string;
  report_json: string;
  source: string;
  created_at: string;
}

function prospectRowToRecord(row: ProspectRow): ProspectAssessment {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    targetUniversity: row.target_university,
    examName: row.exam_name,
    examDate: row.exam_date,
    subjects: JSON.parse(row.subjects_json),
    units: JSON.parse(row.units_json),
    notes: row.notes,
    report: JSON.parse(row.report_json),
    source: row.source as ProspectAssessment["source"],
    createdAt: row.created_at,
  };
}

export function getProspectAssessments(): ProspectAssessment[] {
  const rows = db
    .prepare("SELECT * FROM prospect_assessments ORDER BY created_at DESC")
    .all() as unknown as ProspectRow[];
  return rows.map(prospectRowToRecord);
}

export function getProspectAssessment(id: string): ProspectAssessment | null {
  const row = db
    .prepare("SELECT * FROM prospect_assessments WHERE id = ?")
    .get(id) as ProspectRow | undefined;
  return row ? prospectRowToRecord(row) : null;
}

export function insertProspectAssessment(
  input: ProspectAssessmentInput,
  report: ExamWeaknessReport,
  source: ProspectAssessment["source"],
): ProspectAssessment {
  const record: ProspectAssessment = {
    id: randomUUID(),
    ...input,
    report,
    source,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO prospect_assessments
      (id, name, grade, target_university, exam_name, exam_date, subjects_json, units_json, notes, report_json, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.name,
    record.grade,
    record.targetUniversity,
    record.examName,
    record.examDate,
    JSON.stringify(record.subjects),
    JSON.stringify(record.units),
    record.notes,
    JSON.stringify(record.report),
    record.source,
    record.createdAt,
  );

  return record;
}

export type UserRole = "teacher" | "family";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  name: string;
  created_at: string;
}

function userRowToRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function getUserByEmail(email: string): UserRecord | null {
  const row = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;
  return row ? userRowToRecord(row) : null;
}

export function getUserById(id: string): UserRecord | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
  return row ? userRowToRecord(row) : null;
}

export function updateUserPassword(id: string, passwordHash: string): void {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

export function createUser(input: {
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
}): UserRecord {
  const record: UserRecord = {
    id: randomUUID(),
    email: input.email,
    passwordHash: input.passwordHash,
    role: input.role,
    name: input.name,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.email,
    record.passwordHash,
    record.role,
    record.name,
    record.createdAt,
  );

  return record;
}

export interface WebAuthnCredentialRecord {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  createdAt: string;
}

interface WebAuthnCredentialRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports_json: string;
  created_at: string;
}

function webAuthnCredentialRowToRecord(row: WebAuthnCredentialRow): WebAuthnCredentialRecord {
  return {
    id: row.id,
    userId: row.user_id,
    credentialId: row.credential_id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: JSON.parse(row.transports_json) as string[],
    createdAt: row.created_at,
  };
}

export function getWebAuthnCredentialsForUser(userId: string): WebAuthnCredentialRecord[] {
  const rows = db
    .prepare("SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at ASC")
    .all(userId) as unknown as WebAuthnCredentialRow[];
  return rows.map(webAuthnCredentialRowToRecord);
}

export function getWebAuthnCredentialByCredentialId(
  credentialId: string,
): WebAuthnCredentialRecord | null {
  const row = db
    .prepare("SELECT * FROM webauthn_credentials WHERE credential_id = ?")
    .get(credentialId) as WebAuthnCredentialRow | undefined;
  return row ? webAuthnCredentialRowToRecord(row) : null;
}

export function saveWebAuthnCredential(input: {
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
}): WebAuthnCredentialRecord {
  const record = {
    id: randomUUID(),
    userId: input.userId,
    credentialId: input.credentialId,
    publicKey: input.publicKey,
    counter: input.counter,
    transports: input.transports,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO webauthn_credentials
      (id, user_id, credential_id, public_key, counter, transports_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    record.userId,
    record.credentialId,
    record.publicKey,
    record.counter,
    JSON.stringify(record.transports),
    record.createdAt,
  );
  return record;
}

export function updateWebAuthnCredentialCounter(credentialId: string, counter: number): void {
  db.prepare("UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?").run(
    counter,
    credentialId,
  );
}

// --- 口頭試問（参考書を極めるドリル）---------------------------------------

interface OralExamBookRow {
  id: string;
  title: string;
  subject: string;
  description: string;
  created_at: string;
}

function countRow(sql: string, ...args: (string | number)[]): number {
  const { count } = db.prepare(sql).get(...args) as { count: number };
  return count;
}

function oralExamBookRowToRecord(row: OralExamBookRow): OralExamBook {
  const questionCount = countRow(
    "SELECT COUNT(*) as count FROM oral_exam_questions WHERE book_id = ?",
    row.id,
  );
  const assignedStudentCount = countRow(
    "SELECT COUNT(*) as count FROM oral_exam_assignments WHERE book_id = ?",
    row.id,
  );
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    description: row.description,
    createdAt: row.created_at,
    questionCount,
    assignedStudentCount,
  };
}

export function createOralExamBook(input: {
  title: string;
  subject: string;
  description: string;
}): OralExamBook {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO oral_exam_books (id, title, subject, description, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, input.title, input.subject, input.description, createdAt);
  return { id, title: input.title, subject: input.subject, description: input.description, createdAt, questionCount: 0, assignedStudentCount: 0 };
}

export function getOralExamBooks(): OralExamBook[] {
  const rows = db
    .prepare("SELECT * FROM oral_exam_books ORDER BY created_at DESC")
    .all() as unknown as OralExamBookRow[];
  return rows.map(oralExamBookRowToRecord);
}

export function getOralExamBook(id: string): OralExamBook | null {
  const row = db.prepare("SELECT * FROM oral_exam_books WHERE id = ?").get(id) as
    | OralExamBookRow
    | undefined;
  return row ? oralExamBookRowToRecord(row) : null;
}

export function updateOralExamBook(
  id: string,
  input: { title: string; subject: string; description: string },
): void {
  db.prepare(
    "UPDATE oral_exam_books SET title = ?, subject = ?, description = ? WHERE id = ?",
  ).run(input.title, input.subject, input.description, id);
}

export function deleteOralExamBook(id: string): void {
  const questionIds = (
    db
      .prepare("SELECT id FROM oral_exam_questions WHERE book_id = ?")
      .all(id) as unknown as { id: string }[]
  ).map((r) => r.id);
  for (const questionId of questionIds) {
    db.prepare("DELETE FROM oral_exam_mastery WHERE question_id = ?").run(questionId);
  }
  db.prepare("DELETE FROM oral_exam_questions WHERE book_id = ?").run(id);
  db.prepare("DELETE FROM oral_exam_assignments WHERE book_id = ?").run(id);
  db.prepare("DELETE FROM oral_exam_books WHERE id = ?").run(id);
}

interface OralExamQuestionRow {
  id: string;
  book_id: string;
  order_index: number;
  source_page: number | null;
  category: string;
  prompt: string;
  model_answer: string;
  created_at: string;
  reviewed_at: string | null;
  blocked: number;
}

function questionRowToRecord(row: OralExamQuestionRow): OralExamQuestionRecord {
  return {
    id: row.id,
    bookId: row.book_id,
    orderIndex: row.order_index,
    sourcePage: row.source_page,
    category: row.category,
    prompt: row.prompt,
    modelAnswer: row.model_answer,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    blocked: Boolean(row.blocked),
  };
}

export function getOralExamQuestions(bookId: string): OralExamQuestionRecord[] {
  const rows = db
    .prepare(
      "SELECT * FROM oral_exam_questions WHERE book_id = ? ORDER BY order_index ASC, created_at ASC",
    )
    .all(bookId) as unknown as OralExamQuestionRow[];
  return rows.map(questionRowToRecord);
}

export function getOralExamFilterOptions(bookId: string): OralExamFilterOptions {
  const questions = getOralExamQuestions(bookId);
  const pages = new Set<number>();
  // 章は五十音順ではなく参考書の掲載順（最初に出てくる問題の順）で並べる。範囲指定の「〜」が本の順序と一致するように。
  const chapters = new Set<string>();
  for (const question of questions) {
    if (question.sourcePage) pages.add(question.sourcePage);
    const pageMatch = /(?:p\.?|ページ)\s*(\d+)/i.exec(question.category);
    if (pageMatch) pages.add(Number(pageMatch[1]));
    if (question.category.trim()) chapters.add(question.category.trim());
  }
  return {
    pages: [...pages].sort((a, b) => a - b),
    chapters: [...chapters],
    questionCount: questions.length,
  };
}

export function getOralExamQuestion(id: string): OralExamQuestionRecord | null {
  const row = db.prepare("SELECT * FROM oral_exam_questions WHERE id = ?").get(id) as
    | OralExamQuestionRow
    | undefined;
  return row ? questionRowToRecord(row) : null;
}

function nextOralExamOrderIndex(bookId: string): number {
  const { maxIndex } = db
    .prepare(
      "SELECT COALESCE(MAX(order_index), -1) as maxIndex FROM oral_exam_questions WHERE book_id = ?",
    )
    .get(bookId) as { maxIndex: number };
  return maxIndex + 1;
}

export function addOralExamQuestion(
  bookId: string,
  input: { category: string; prompt: string; modelAnswer: string; sourcePage?: number | null },
): OralExamQuestionRecord {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const orderIndex = nextOralExamOrderIndex(bookId);
  db.prepare(
     `INSERT INTO oral_exam_questions (id, book_id, order_index, category, prompt, model_answer, created_at, source_page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, bookId, orderIndex, input.category, input.prompt, input.modelAnswer, createdAt, input.sourcePage ?? null);
  return {
    id,
    bookId,
    orderIndex,
    sourcePage: input.sourcePage ?? null,
    category: input.category,
    prompt: input.prompt,
    modelAnswer: input.modelAnswer,
    createdAt,
    reviewedAt: null,
    blocked: false,
  };
}

export function bulkAddOralExamQuestions(
  bookId: string,
  items: { category: string; prompt: string; modelAnswer: string }[],
): OralExamQuestionRecord[] {
  return items.map((item) => addOralExamQuestion(bookId, item));
}

export function updateOralExamQuestion(
  id: string,
  input: { category: string; prompt: string; modelAnswer: string },
): void {
  db.prepare(
    "UPDATE oral_exam_questions SET category = ?, prompt = ?, model_answer = ? WHERE id = ?",
  ).run(input.category, input.prompt, input.modelAnswer, id);
}

export function deleteOralExamQuestion(id: string): void {
  db.prepare("DELETE FROM oral_exam_mastery WHERE question_id = ?").run(id);
  db.prepare("DELETE FROM oral_exam_questions WHERE id = ?").run(id);
}

export function assignOralExamBook(studentId: string, bookId: string): OralExamAssignment {
  const existing = db
    .prepare("SELECT * FROM oral_exam_assignments WHERE student_id = ? AND book_id = ?")
    .get(studentId, bookId) as
    | { id: string; student_id: string; book_id: string; assigned_at: string }
    | undefined;
  if (existing) {
    return {
      id: existing.id,
      studentId: existing.student_id,
      bookId: existing.book_id,
      assignedAt: existing.assigned_at,
    };
  }
  const id = randomUUID();
  const assignedAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO oral_exam_assignments (id, student_id, book_id, assigned_at) VALUES (?, ?, ?, ?)",
  ).run(id, studentId, bookId, assignedAt);
  return { id, studentId, bookId, assignedAt };
}

export function unassignOralExamBook(studentId: string, bookId: string): void {
  db.prepare(
    "DELETE FROM oral_exam_assignments WHERE student_id = ? AND book_id = ?",
  ).run(studentId, bookId);
}

export function isBookAssignedToStudent(studentId: string, bookId: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM oral_exam_assignments WHERE student_id = ? AND book_id = ?")
    .get(studentId, bookId);
  return Boolean(row);
}

export function getAssignedStudentIds(bookId: string): string[] {
  const rows = db
    .prepare("SELECT student_id FROM oral_exam_assignments WHERE book_id = ?")
    .all(bookId) as unknown as { student_id: string }[];
  return rows.map((r) => r.student_id);
}

export function getAssignedBooksForStudent(studentId: string): OralExamBook[] {
  const rows = db
    .prepare(
      `SELECT b.* FROM oral_exam_books b
       INNER JOIN oral_exam_assignments a ON a.book_id = b.id
       WHERE a.student_id = ?
       ORDER BY a.assigned_at DESC`,
    )
    .all(studentId) as unknown as OralExamBookRow[];
  return rows.map(oralExamBookRowToRecord);
}

interface OralExamMasteryRow {
  student_id: string;
  question_id: string;
  level: number;
  correct_streak: number;
  total_attempts: number;
  last_result: string | null;
  last_response_time_ms: number | null;
  last_attempt_at: string | null;
  next_review_at: string | null;
}

function masteryRowToRecord(row: OralExamMasteryRow): OralExamMastery {
  return {
    studentId: row.student_id,
    questionId: row.question_id,
    level: row.level,
    correctStreak: row.correct_streak,
    totalAttempts: row.total_attempts,
    lastResult: row.last_result as MasteryResult | null,
    lastResponseTimeMs: row.last_response_time_ms,
    lastAttemptAt: row.last_attempt_at,
    nextReviewAt: row.next_review_at,
  };
}

export function getMastery(studentId: string, questionId: string): OralExamMastery | null {
  const row = db
    .prepare("SELECT * FROM oral_exam_mastery WHERE student_id = ? AND question_id = ?")
    .get(studentId, questionId) as OralExamMasteryRow | undefined;
  return row ? masteryRowToRecord(row) : null;
}

export function getMasteryForBook(studentId: string, bookId: string): OralExamMastery[] {
  const rows = db
    .prepare(
      `SELECT m.* FROM oral_exam_mastery m
       INNER JOIN oral_exam_questions q ON q.id = m.question_id
       WHERE m.student_id = ? AND q.book_id = ?`,
    )
    .all(studentId, bookId) as unknown as OralExamMasteryRow[];
  return rows.map(masteryRowToRecord);
}

export function upsertMastery(mastery: OralExamMastery): void {
  db.prepare(
    `INSERT INTO oral_exam_mastery
       (student_id, question_id, level, correct_streak, total_attempts, last_result, last_response_time_ms, last_attempt_at, next_review_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, question_id) DO UPDATE SET
       level = excluded.level,
       correct_streak = excluded.correct_streak,
       total_attempts = excluded.total_attempts,
       last_result = excluded.last_result,
       last_response_time_ms = excluded.last_response_time_ms,
       last_attempt_at = excluded.last_attempt_at,
       next_review_at = excluded.next_review_at`,
  ).run(
    mastery.studentId,
    mastery.questionId,
    mastery.level,
    mastery.correctStreak,
    mastery.totalAttempts,
    mastery.lastResult,
    mastery.lastResponseTimeMs,
    mastery.lastAttemptAt,
    mastery.nextReviewAt,
  );
}

function shuffledQueueItems(studentId: string, bookId: string): OralExamQueueItem[] {
  const questions = getOralExamQuestions(bookId).filter((q) => !q.blocked);
  const masteryRows = getMasteryForBook(studentId, bookId);
  const masteryByQuestion = new Map(masteryRows.map((m) => [m.questionId, m]));

  const items: OralExamQueueItem[] = questions.map((question) => ({
    question,
    mastery: masteryByQuestion.get(question.id) ?? null,
  }));

  // 生徒が教材を自由に選ぶ運用では、毎回同じ問題を固定順で出さず、
  // 習熟度情報を添えた全問題からランダムに選ぶ。
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

export function getOralExamQueue(
  studentId: string,
  bookId: string,
  limit: number = 10,
): OralExamQueueItem[] {
  return shuffledQueueItems(studentId, bookId).slice(0, limit);
}

// 出題前点検(未点検の問題をAIでチェック・修正する)のために、最終的な出題数より
// 多めの候補プールを返す。点検の結果ブロックされた問題が出ても、プール内の
// 残りから補充できるようにするため。
export function getOralExamReviewPool(
  studentId: string,
  bookId: string,
  poolSize: number,
  filters: OralExamQuestionFilters = {},
): OralExamQueueItem[] {
  const items = shuffledQueueItems(studentId, bookId).filter((item) => matchesOralExamFilters(item, filters));
  return items.slice(0, poolSize);
}

export interface OralExamQuestionFilters {
  pageStart?: number;
  pageEnd?: number;
  questionStart?: number;
  questionEnd?: number;
  // 出題対象の章・カテゴリ名（完全一致）。範囲指定は画面側で章リストを切り出して渡す。
  chapters?: string[];
}

function pageFromQuestion(item: OralExamQueueItem): number | null {
  if (item.question.sourcePage) return item.question.sourcePage;
  const match = /(?:p\.?|ページ)\s*(\d+)/i.exec(item.question.category);
  return match ? Number(match[1]) : null;
}

function matchesOralExamFilters(item: OralExamQueueItem, filters: OralExamQuestionFilters): boolean {
  const questionNumber = item.question.orderIndex + 1;
  if (filters.questionStart && questionNumber < filters.questionStart) return false;
  if (filters.questionEnd && questionNumber > filters.questionEnd) return false;
  if (filters.chapters && filters.chapters.length > 0 && !filters.chapters.includes(item.question.category.trim())) {
    return false;
  }
  if (filters.pageStart || filters.pageEnd) {
    const page = pageFromQuestion(item);
    if (page === null) return false;
    if (filters.pageStart && page < filters.pageStart) return false;
    if (filters.pageEnd && page > filters.pageEnd) return false;
  }
  return true;
}

export function markQuestionReviewed(
  id: string,
  input: { blocked: true } | { blocked: false; prompt: string; modelAnswer: string },
): void {
  const reviewedAt = new Date().toISOString();
  if (input.blocked) {
    db.prepare("UPDATE oral_exam_questions SET reviewed_at = ?, blocked = 1 WHERE id = ?").run(
      reviewedAt,
      id,
    );
  } else {
    db.prepare(
      "UPDATE oral_exam_questions SET reviewed_at = ?, blocked = 0, prompt = ?, model_answer = ? WHERE id = ?",
    ).run(reviewedAt, input.prompt, input.modelAnswer, id);
  }
}

interface OralExamSessionRow {
  id: string;
  student_id: string;
  book_id: string;
  started_at: string;
  ended_at: string | null;
  question_count: number;
  correct_count: number;
}

function sessionRowToRecord(row: OralExamSessionRow): OralExamSession {
  return {
    id: row.id,
    studentId: row.student_id,
    bookId: row.book_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    questionCount: row.question_count,
    correctCount: row.correct_count,
  };
}

export function createOralExamSession(studentId: string, bookId: string): OralExamSession {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO oral_exam_sessions (id, student_id, book_id, started_at) VALUES (?, ?, ?, ?)",
  ).run(id, studentId, bookId, startedAt);
  return { id, studentId, bookId, startedAt, endedAt: null, questionCount: 0, correctCount: 0 };
}

export function touchOralExamSession(id: string, isCorrect: boolean): void {
  db.prepare(
    `UPDATE oral_exam_sessions
     SET ended_at = ?, question_count = question_count + 1, correct_count = correct_count + ?
     WHERE id = ?`,
  ).run(new Date().toISOString(), isCorrect ? 1 : 0, id);
}

export function getOralExamSession(id: string): OralExamSession | null {
  const row = db.prepare("SELECT * FROM oral_exam_sessions WHERE id = ?").get(id) as
    | OralExamSessionRow
    | undefined;
  return row ? sessionRowToRecord(row) : null;
}

export function getOralExamSessionsForStudent(studentId: string): OralExamSession[] {
  const rows = db
    .prepare("SELECT * FROM oral_exam_sessions WHERE student_id = ? ORDER BY started_at DESC")
    .all(studentId) as unknown as OralExamSessionRow[];
  return rows.map(sessionRowToRecord);
}

interface OralExamAttemptRow {
  id: string;
  session_id: string;
  student_id: string;
  question_id: string;
  book_id: string;
  book_title: string;
  category: string;
  question_prompt: string;
  input_mode: string;
  answer_text: string;
  answer_image_data_url: string;
  response_time_ms: number;
  is_correct: number;
  evaluation: string;
  strengths_json: string;
  improvements_json: string;
  mastery_level: number;
  feedback_source: string;
  teacher_comment: string;
  created_at: string;
}

function attemptRowToRecord(row: OralExamAttemptRow): OralExamAttempt {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    questionId: row.question_id,
    bookId: row.book_id,
    bookTitle: row.book_title,
    category: row.category,
    questionPrompt: row.question_prompt,
    inputMode: row.input_mode as OralExamInputMode,
    answerText: row.answer_text,
    answerImageDataUrl: row.answer_image_data_url,
    responseTimeMs: row.response_time_ms,
    isCorrect: row.is_correct === 1,
    evaluation: row.evaluation,
    strengths: JSON.parse(row.strengths_json),
    improvements: JSON.parse(row.improvements_json),
    masteryLevel: row.mastery_level,
    feedbackSource: row.feedback_source as "claude" | "demo",
    teacherComment: row.teacher_comment,
    createdAt: row.created_at,
  };
}

export function insertOralExamAttempt(
  input: Omit<OralExamAttempt, "id" | "createdAt" | "teacherComment">,
): OralExamAttempt {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO oral_exam_attempts
       (id, session_id, student_id, question_id, book_id, book_title, category, question_prompt,
        input_mode, answer_text, answer_image_data_url, response_time_ms, is_correct, evaluation,
        strengths_json, improvements_json, mastery_level, feedback_source, teacher_comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.sessionId,
    input.studentId,
    input.questionId,
    input.bookId,
    input.bookTitle,
    input.category,
    input.questionPrompt,
    input.inputMode,
    input.answerText,
    input.answerImageDataUrl,
    input.responseTimeMs,
    input.isCorrect ? 1 : 0,
    input.evaluation,
    JSON.stringify(input.strengths),
    JSON.stringify(input.improvements),
    input.masteryLevel,
    input.feedbackSource,
    "",
    createdAt,
  );
  return { ...input, id, teacherComment: "", createdAt };
}

export function getOralExamAttempts(
  studentId: string,
  options: { bookId?: string; limit?: number } = {},
): OralExamAttempt[] {
  const clauses = ["student_id = ?"];
  const args: (string | number)[] = [studentId];
  if (options.bookId) {
    clauses.push("book_id = ?");
    args.push(options.bookId);
  }
  const hasLimit = Boolean(options.limit && Number.isFinite(options.limit));
  if (hasLimit) {
    args.push(Math.max(1, Math.floor(options.limit!)));
  }
  const rows = db
    .prepare(
      `SELECT * FROM oral_exam_attempts WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC${hasLimit ? " LIMIT ?" : ""}`,
    )
    .all(...args) as unknown as OralExamAttemptRow[];
  return rows.map(attemptRowToRecord);
}

export function updateOralExamAttemptComment(id: string, comment: string): void {
  db.prepare("UPDATE oral_exam_attempts SET teacher_comment = ? WHERE id = ?").run(
    comment,
    id,
  );
}

export interface OralExamStudentSummary {
  totalQuestions: number;
  masteredCount: number;
  dueCount: number;
  avgResponseTimeMs: number | null;
  totalAttempts: number;
  lastAttemptAt: string | null;
}

export function getOralExamStudentSummary(studentId: string): OralExamStudentSummary {
  const books = getAssignedBooksForStudent(studentId);
  let totalQuestions = 0;
  let masteredCount = 0;
  let dueCount = 0;

  for (const book of books) {
    const questions = getOralExamQuestions(book.id);
    const masteryRows = getMasteryForBook(studentId, book.id);
    const masteryByQuestion = new Map(masteryRows.map((m) => [m.questionId, m]));
    totalQuestions += questions.length;
    for (const question of questions) {
      const mastery = masteryByQuestion.get(question.id) ?? null;
      if (mastery && mastery.level >= 4) masteredCount += 1;
      if (isDue(mastery)) dueCount += 1;
    }
  }

  const { avg, count, lastAt } = db
    .prepare(
      `SELECT AVG(response_time_ms) as avg, COUNT(*) as count, MAX(created_at) as lastAt
       FROM oral_exam_attempts WHERE student_id = ?`,
    )
    .get(studentId) as { avg: number | null; count: number; lastAt: string | null };

  return {
    totalQuestions,
    masteredCount,
    dueCount,
    avgResponseTimeMs: avg,
    totalAttempts: count,
    lastAttemptAt: lastAt,
  };
}

db.exec(`
  CREATE TABLE IF NOT EXISTS oral_exam_insights (
    student_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    attempt_count INTEGER NOT NULL
  )
`);

export interface OralExamInsight {
  summary: string;
  generatedAt: string;
  attemptCount: number;
}

// 新しい回答が増えていない限りAIを再度呼ばず、キャッシュした要約をそのまま返す
// (講師がページを開くたびに課金が発生しないようにするため)。
export function getOralExamInsight(studentId: string): OralExamInsight | null {
  const row = db
    .prepare("SELECT summary, generated_at, attempt_count FROM oral_exam_insights WHERE student_id = ?")
    .get(studentId) as { summary: string; generated_at: string; attempt_count: number } | undefined;
  if (!row) return null;
  return { summary: row.summary, generatedAt: row.generated_at, attemptCount: row.attempt_count };
}

export function saveOralExamInsight(studentId: string, summary: string, attemptCount: number): void {
  const generatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO oral_exam_insights (student_id, summary, generated_at, attempt_count)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET summary = excluded.summary,
       generated_at = excluded.generated_at, attempt_count = excluded.attempt_count`,
  ).run(studentId, summary, generatedAt, attemptCount);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS student_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0
  )
`);
ensureColumn("student_feedback", "question_id", "question_id TEXT");
ensureColumn("student_feedback", "question_label", "question_label TEXT");

export interface StudentFeedback {
  id: string;
  userId: string;
  studentName: string;
  message: string;
  createdAt: string;
  resolved: boolean;
  questionId: string | null;
  questionLabel: string | null;
}

interface StudentFeedbackRow {
  id: string;
  user_id: string;
  student_name: string;
  message: string;
  created_at: string;
  resolved: number;
  question_id: string | null;
  question_label: string | null;
}

function feedbackRowToRecord(row: StudentFeedbackRow): StudentFeedback {
  return {
    id: row.id,
    userId: row.user_id,
    studentName: row.student_name,
    message: row.message,
    createdAt: row.created_at,
    resolved: Boolean(row.resolved),
    questionId: row.question_id,
    questionLabel: row.question_label,
  };
}

export function insertStudentFeedback(input: {
  userId: string;
  studentName: string;
  message: string;
  questionId?: string;
  questionLabel?: string;
}): StudentFeedback {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO student_feedback
     (id, user_id, student_name, message, created_at, resolved, question_id, question_label)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    id,
    input.userId,
    input.studentName,
    input.message,
    createdAt,
    input.questionId ?? null,
    input.questionLabel ?? null,
  );
  return {
    id,
    userId: input.userId,
    studentName: input.studentName,
    message: input.message,
    createdAt,
    resolved: false,
    questionId: input.questionId ?? null,
    questionLabel: input.questionLabel ?? null,
  };
}

export function getAllStudentFeedback(): StudentFeedback[] {
  const rows = db
    .prepare("SELECT * FROM student_feedback ORDER BY resolved ASC, created_at DESC")
    .all() as unknown as StudentFeedbackRow[];
  return rows.map(feedbackRowToRecord);
}

export function getStudentFeedbackForUser(userId: string): StudentFeedback[] {
  const rows = db
    .prepare("SELECT * FROM student_feedback WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as unknown as StudentFeedbackRow[];
  return rows.map(feedbackRowToRecord);
}

export function setStudentFeedbackResolved(id: string, resolved: boolean): void {
  db.prepare("UPDATE student_feedback SET resolved = ? WHERE id = ?").run(resolved ? 1 : 0, id);
}

function ensureReferenceBookCataloged(): void {
  const findBook = db.prepare("SELECT id FROM oral_exam_books WHERE title = ?");
  for (const entry of REFERENCE_BOOK_CATALOG) {
    const existing = findBook.get(entry.title) as { id: string } | undefined;
    if (existing) continue;
    createOralExamBook({
      title: entry.title,
      subject: entry.subject,
      description: entry.description,
    });
  }
}

// sankosho の資料台帳は既存DBにも追登録する。問題本文は抽出結果を確認してから
// 登録するため、誤読した設問を自動生成せず、各参考書を問題数0の状態で表示する。
export function ensureOralExamSeeded(): void {
  ensureReferenceBookCataloged();
  const bookCount = countRow("SELECT COUNT(*) as count FROM oral_exam_books");
  if (bookCount > 0) {
    assignChemistryBookToAllStudents();
    return;
  }

  const book = createOralExamBook(demoOralExamBookSeed.book);
  bulkAddOralExamQuestions(book.id, demoOralExamBookSeed.questions);
  assignOralExamBook(demoStudent.id, book.id);
}

function assignChemistryBookToAllStudents(): void {
  const book = db
    .prepare("SELECT id FROM oral_exam_books WHERE title = ?")
    .get("化学頻出スタンダード問題230選") as { id: string } | undefined;
  if (!book) return;

  const questionCount = countRow(
    "SELECT COUNT(*) as count FROM oral_exam_questions WHERE book_id = ?",
    book.id,
  );
  if (questionCount === 0) return;

  const students = db.prepare("SELECT id FROM students").all() as { id: string }[];
  for (const student of students) {
    assignOralExamBook(student.id, book.id);
  }
}
