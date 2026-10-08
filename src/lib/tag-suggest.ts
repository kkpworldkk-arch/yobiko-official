const STUMBLE_KEYWORDS: Record<string, { pattern: RegExp; label: string }[]> = {
  数学: [
    { pattern: /(条件|場合分け)/, label: "条件整理" },
    { pattern: /(計算|桁|符号|約分)/, label: "計算処理" },
    { pattern: /(公式|定理)/, label: "公式適用" },
    { pattern: /(図形|グラフ)/, label: "図形把握" },
  ],
  英語: [
    { pattern: /(構文|関係詞|文型|SVOC)/, label: "構文解析" },
    { pattern: /(時制)/, label: "時制" },
    { pattern: /(単語|語彙|熟語)/, label: "語彙" },
    { pattern: /(リスニング|発音)/, label: "リスニング" },
  ],
  化学: [
    { pattern: /(構造|決定)/, label: "構造決定" },
    { pattern: /(反応|経路)/, label: "反応経路" },
    { pattern: /(量|モル|計算)/, label: "量的関係" },
  ],
  生物: [
    { pattern: /(計算|遺伝)/, label: "計算処理" },
    { pattern: /(用語|語句)/, label: "用語理解" },
    { pattern: /(図|グラフ)/, label: "図表読解" },
  ],
  物理: [
    { pattern: /(力|運動)/, label: "作図" },
    { pattern: /(公式)/, label: "公式適用" },
    { pattern: /(計算)/, label: "計算処理" },
  ],
};

const GENERIC_LABELS = ["条件整理", "計算処理", "理解不足"];

// AIキー不要のルールベース候補生成。質問文のキーワードに一致するタグ形式を返す。
export function suggestWeaknessTags(
  subject: string,
  unit: string,
  question: string,
): string[] {
  const rules = STUMBLE_KEYWORDS[subject] ?? [];
  const matched = rules
    .filter((rule) => rule.pattern.test(question))
    .map((rule) => rule.label);

  const labels = matched.length > 0 ? matched : GENERIC_LABELS;
  const base = unit.trim() || subject;
  return Array.from(new Set(labels))
    .slice(0, 3)
    .map((label) => `${base}-${label}`);
}
