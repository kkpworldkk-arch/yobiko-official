import { getQaHistory, getTopStumbles } from "@/lib/db";
import { formatRelativeTimeJa } from "@/lib/format";

const RECENT_LIMIT = 5;
const TOP_STUMBLE_LIMIT = 3;

// 生徒ごとのモデルを別途学習させるのではなく、蓄積済みの質問履歴を
// 毎回のプロンプトに文脈として渡すことで個別最適化する。これにより
// 新しい質問をした瞬間から次の回答へ反映され、再学習も追加コストも不要になる。
export function buildPersonalizationContext(studentId: string): string {
  const history = getQaHistory(studentId);
  if (history.length === 0) return "";

  const topStumbles = getTopStumbles(studentId).slice(0, TOP_STUMBLE_LIMIT);
  const recent = history.slice(0, RECENT_LIMIT);

  const lines = [`総質問数: ${history.length}件`];

  if (topStumbles.length > 0) {
    lines.push(
      `よく見られるつまずき: ${topStumbles
        .map((s) => `${s.label}(${s.count}件)`)
        .join("、")}`,
    );
  }

  lines.push("直近の質問:");
  for (const entry of recent) {
    lines.push(
      `- [${entry.subject}/${entry.unit}] 弱点タグ: ${entry.weaknessTag}（${formatRelativeTimeJa(entry.askedAt)}）`,
    );
  }

  return lines.join("\n");
}
