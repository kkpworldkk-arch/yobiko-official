export interface ParsedOralExamQuestion {
  category: string;
  prompt: string;
  modelAnswer: string;
}

/**
 * 参考書の問題をまとめて貼り付けて登録するための簡易パーサー。
 * 対応フォーマット:
 *   [カテゴリ名]
 *   Q: 質問文（複数行可）
 *   A: 模範解答（省略可、複数行可）
 *
 * 空行区切りのブロックごとに1問として扱う。Q:/A: の指定がないブロックは
 * 1行=1問の単純リストとして扱う（模範解答は空）。
 */
export function parseOralExamBulkText(text: string): ParsedOralExamQuestion[] {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  const results: ParsedOralExamQuestion[] = [];
  let currentCategory = "";

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    const lines = block.split("\n");
    const categoryLineIndex = lines.findIndex((line) =>
      /^\[.+\]$/.test(line.trim()),
    );
    if (categoryLineIndex !== -1) {
      currentCategory = lines[categoryLineIndex].trim().slice(1, -1).trim();
      lines.splice(categoryLineIndex, 1);
    }

    const remaining = lines.join("\n").trim();
    if (!remaining) continue;

    const qIndex = remaining.search(/^Q[:：]/m);
    if (qIndex === -1) {
      for (const line of remaining.split("\n")) {
        const prompt = line.trim();
        if (!prompt) continue;
        results.push({ category: currentCategory, prompt, modelAnswer: "" });
      }
      continue;
    }

    const aMatch = remaining.match(/^A[:：]/m);
    const promptRaw = aMatch
      ? remaining.slice(qIndex, remaining.indexOf(aMatch[0]))
      : remaining.slice(qIndex);
    const prompt = promptRaw.replace(/^Q[:：]\s*/, "").trim();

    let modelAnswer = "";
    if (aMatch && aMatch.index !== undefined) {
      modelAnswer = remaining
        .slice(aMatch.index)
        .replace(/^A[:：]\s*/, "")
        .trim();
    }

    if (prompt) {
      results.push({ category: currentCategory, prompt, modelAnswer });
    }
  }

  return results;
}
