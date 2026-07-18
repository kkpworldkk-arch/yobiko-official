import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { demoStudent, demoStudentQaHistory } from "@/lib/mock-data";
import type { QaHistoryEntry, TutorResponse } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
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
    asked_at TEXT NOT NULL
  )
`);

interface QaRow {
  id: string;
  subject: string;
  unit: string;
  question: string;
  summary: string;
  steps_json: string;
  weakness_tag: string;
  review_suggestion: string;
  asked_at: string;
}

function rowToEntry(row: QaRow): QaHistoryEntry {
  return {
    id: row.id,
    subject: row.subject,
    unit: row.unit,
    question: row.question,
    summary: row.summary,
    steps: JSON.parse(row.steps_json),
    weaknessTag: row.weakness_tag,
    reviewSuggestion: row.review_suggestion,
    askedAt: row.asked_at,
  };
}

function seedIfEmpty(studentId: string) {
  const { count } = db
    .prepare("SELECT COUNT(*) as count FROM qa_history WHERE student_id = ?")
    .get(studentId) as { count: number };
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO qa_history
      (id, student_id, subject, unit, question, summary, steps_json, weakness_tag, review_suggestion, asked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const entry of demoStudentQaHistory) {
    insert.run(
      entry.id,
      studentId,
      entry.subject,
      entry.unit,
      entry.question,
      entry.summary,
      JSON.stringify(entry.steps),
      entry.weaknessTag,
      entry.reviewSuggestion,
      entry.askedAt,
    );
  }
}

export function getQaHistory(studentId: string): QaHistoryEntry[] {
  if (studentId === demoStudent.id) {
    seedIfEmpty(studentId);
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
): QaHistoryEntry {
  const entry: QaHistoryEntry = {
    id: randomUUID(),
    subject: question.subject,
    unit: question.unit,
    question: question.question,
    askedAt: new Date().toISOString(),
    ...response,
  };

  db.prepare(`
    INSERT INTO qa_history
      (id, student_id, subject, unit, question, summary, steps_json, weakness_tag, review_suggestion, asked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    studentId,
    entry.subject,
    entry.unit,
    entry.question,
    entry.summary,
    JSON.stringify(entry.steps),
    entry.weaknessTag,
    entry.reviewSuggestion,
    entry.askedAt,
  );

  return entry;
}
