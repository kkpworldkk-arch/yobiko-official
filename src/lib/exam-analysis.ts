import type {
  ExamUnitScore,
  ExamWeaknessReport,
  ProspectAssessmentInput,
} from "@/lib/types";

function toPercent(score: number, fullScore: number): number {
  if (fullScore <= 0) return 0;
  return Math.round((score / fullScore) * 1000) / 10;
}

const UNIT_FOLLOWUP: Record<string, string> = {
  数学: "公式を覚えていても、条件整理や場合分けの型が身についていないケースが多く、原因を切り分ければ比較的短期間で改善が見込めます。",
  英語: "単語・文法の知識よりも、文構造を素早く見抜く「型」が定着していないことが原因のことが多く、演習量よりも解き方の指導が効きます。",
  化学: "暗記量というより、反応や構造を筋道立てて考える手順が定着していないことが多く、思考の順序を型として身につけることで伸びやすい分野です。",
  生物: "知識は入っていても、計算問題やグラフ読解に落とし込む練習が不足していることが多く、演習と解説をセットで行うと定着が早まります。",
  物理: "公式の丸暗記に留まり、状況を図に起こして立式する練習が不足していることが多く、作図の型を身につけると一気に伸びる分野です。",
};

// AIキーがなくても使える、ルールベースの模試弱点診断。
// 実際の得点・偏差値・正答率から、具体的な数値を用いて文章を組み立てる。
export function generateExamWeaknessReport(
  input: ProspectAssessmentInput,
): ExamWeaknessReport {
  const subjectsWithScore = input.subjects.filter((s) => s.fullScore > 0);
  const ranked = [...subjectsWithScore].sort(
    (a, b) => toPercent(a.score, a.fullScore) - toPercent(b.score, b.fullScore),
  );
  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];

  const rankedUnits = [...input.units].sort(
    (a, b) => a.correctRate - b.correctRate,
  );
  const weakUnits = rankedUnits.slice(0, 3);

  const overviewParts: string[] = [];
  if (input.examName) {
    overviewParts.push(`「${input.examName}」の結果を拝見しました。`);
  }
  if (weakest && strongest && weakest.subject !== strongest.subject) {
    overviewParts.push(
      `教科別では、${strongest.subject}が得点率${toPercent(strongest.score, strongest.fullScore)}%と安定している一方、${weakest.subject}は${toPercent(weakest.score, weakest.fullScore)}%にとどまっており、${input.targetUniversity || "志望校"}合格に向けてはここが最初の伸びしろになります。`,
    );
  } else if (weakest) {
    overviewParts.push(
      `${weakest.subject}が得点率${toPercent(weakest.score, weakest.fullScore)}%となっており、今回の結果の中で最も伸びしろが大きい教科です。`,
    );
  } else {
    overviewParts.push(
      "今回は教科別の得点データが少ないため、分野別の正答率を中心に見立てをお伝えします。",
    );
  }
  if (weakest?.deviation != null) {
    overviewParts.push(
      `偏差値は${weakest.deviation}で、医学部合格の目安となる偏差値65前後まではあと一段階の伸びが必要な水準です。`,
    );
  }

  const weaknessDetailParts: string[] = [];
  if (weakUnits.length > 0) {
    const top = weakUnits[0];
    weaknessDetailParts.push(
      `特に「${top.unit}」の正答率が${top.correctRate}%と、他の分野と比べて大きく差が開いています。`,
    );
    const followUp = UNIT_FOLLOWUP[top.subject];
    if (followUp) {
      weaknessDetailParts.push(followUp);
    }
    if (weakUnits.length > 1) {
      const others = weakUnits
        .slice(1)
        .map((u: ExamUnitScore) => `「${u.unit}」(正答率${u.correctRate}%)`)
        .join("、");
      weaknessDetailParts.push(
        `続いて${others}も優先的に対策したい分野です。`,
      );
    }
  } else {
    weaknessDetailParts.push(
      "分野別の正答率データがあると、より具体的な弱点箇所までお伝えできます。次回はぜひ大問別の結果もご共有ください。",
    );
  }
  if (input.notes.trim()) {
    weaknessDetailParts.push(`ご共有いただいた所見: ${input.notes.trim()}`);
  }

  const outlookParts: string[] = [
    "医学部受験は総合力の戦いですが、伸びしろが大きい分野ほど、正しい手順で対策すれば偏差値は比較的早く動きます。",
    "滝原塾では、AIチューターによる24時間対応の質問対応と、専属講師による模試データの精密分析を組み合わせ、一人ひとりに合わせた復習計画を毎週組み立てています。",
    "まずは体験を通じて、実際の指導と個別最適化の効果を実感いただければと思います。",
  ];

  const priorityFocus = [
    ...weakUnits.map((u) => `${u.subject}: ${u.unit}（正答率${u.correctRate}%）`),
    ...(weakest && weakUnits.length === 0
      ? [`${weakest.subject}（得点率${toPercent(weakest.score, weakest.fullScore)}%）`]
      : []),
  ].slice(0, 4);

  return {
    overview: overviewParts.join(""),
    weaknessDetail: weaknessDetailParts.join(""),
    outlook: outlookParts.join(""),
    priorityFocus,
  };
}
