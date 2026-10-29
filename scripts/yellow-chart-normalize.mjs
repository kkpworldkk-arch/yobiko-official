// 黄チャートの問題文・答えに残っている取り込み時の記法（[a]/[b]、x^[2]、√[x]、a_[n]）を、
// 画面で読める普通の数式表記に直す。DB の内容は変えず、作業用 JSON を書き出すだけ。
// 使い方: node scripts/yellow-chart-normalize.mjs   → data/yellow-chart/questions.json
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", n: "ⁿ", "-": "⁻", "−": "⁻", "+": "⁺" };
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", n: "ₙ", k: "ₖ", "+": "₊", "-": "₋", "−": "₋" };
const isAtom = (s) => /^[\p{L}\p{N}.πθαβγ′']+$/u.test(s) || /^\(.*\)$/.test(s) || /^√[\p{L}\p{N}]+$/u.test(s);
const wrap = (s) => (isAtom(s) ? s : `(${s})`);
const script = (s, table, fallback) => ([...s].every((c) => c in table) ? [...s].map((c) => table[c]).join("") : fallback);

export function normalizeMath(text) {
  let prev;
  let out = text;
  do {
    prev = out;
    // 内側（中に [ ] を含まない）から順に置き換える
    out = out.replace(/\[([^[\]]*)\]\/\[([^[\]]*)\]/g, (_, a, b) => `${wrap(a)}/${wrap(b)}`);
    out = out.replace(/\^\[([^[\]]*)\]/g, (_, k) => script(k, SUP, `^(${k})`));
    out = out.replace(/_\[([^[\]]*)\]/g, (_, k) => script(k, SUB, `_(${k})`));
    out = out.replace(/√\[([^[\]]*)\]/g, (_, x) => `√${wrap(x)}`);
  } while (out !== prev);
  return out
    .replace(/^\s*問題\s+/, "")
    .replace(/[ \t\u3000]{2,}/g, " ")
    .trim();
}

if (process.argv[1]?.endsWith("yellow-chart-normalize.mjs")) {
  const map = JSON.parse(readFileSync("src/lib/oral-exam-problem-numbers.json", "utf8"));
  const db = new DatabaseSync("data/app.db", { readOnly: true });
  const rows = db
    .prepare(
      `SELECT q.id, b.title, q.order_index, q.category, q.prompt, q.model_answer
       FROM oral_exam_questions q JOIN oral_exam_books b ON b.id = q.book_id
       WHERE b.title LIKE '黄チャート%' ORDER BY b.title, q.order_index`,
    )
    .all();
  const out = rows.map((r) => {
    const [number, sub, part] = map[r.id] ?? [null, "", ""];
    return {
      id: r.id, book: r.title, part, number, sub, category: r.category,
      prompt: normalizeMath(r.prompt), answer: normalizeMath(r.model_answer),
      changed: normalizeMath(r.prompt) !== r.prompt || normalizeMath(r.model_answer) !== r.model_answer,
    };
  });
  mkdirSync("data/yellow-chart", { recursive: true });
  writeFileSync("data/yellow-chart/questions.json", JSON.stringify(out, null, 1));
  const left = out.filter((q) => /\[[^\]]*\]/.test(q.prompt + q.answer)).length;
  console.log(`${out.length}問 / 書き換え ${out.filter((q) => q.changed).length}問 / まだ [ ] が残る ${left}問`);
}
