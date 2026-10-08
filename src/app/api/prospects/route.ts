import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getProspectAssessments, insertProspectAssessment } from "@/lib/db";
import { generateExamWeaknessReport } from "@/lib/exam-analysis";
import { getSession } from "@/lib/session";
import type {
  ExamSubjectScore,
  ExamUnitScore,
  ExamWeaknessReport,
  ProspectAssessmentInput,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const ExamReportSchema = z.object({
  overview: z.string().describe("模試結果の現状把握を2〜3文で、具体的な数値を用いて"),
  weaknessDetail: z
    .string()
    .describe("最も優先度の高い弱点分野の深掘りを2〜3文で、数値と原因の見立てを含めて"),
  outlook: z
    .string()
    .describe(
      "前向きな見通しと、滝原塾のAIチューター・専属講師によるサポート内容の提案を2〜3文で",
    ),
  priorityFocus: z
    .array(z.string())
    .describe("優先的に対策すべき分野を2〜4件。教科名と分野名を含める"),
});

const SYSTEM_PROMPT = `あなたは医学部受験専門の個別指導塾「滝原塾」の教務責任者です。入塾を検討している家庭に向けて、提出された模試結果をもとに専門家としての「弱点診断レポート」を作成してください。

方針:
- まだ入塾していない生徒・保護者に向けた文章です。専門性と説得力を持ちつつ、不安を過度に煽らない、誠実で温かみのある文章にしてください。
- 提出されたスコア・偏差値・正答率の具体的な数値を必ず使い、一般論で終わらせないでください。
- 弱点を指摘するだけでなく、「なぜ起きているか」の見立てと、「対策すれば十分伸びる」という前向きな見通しを必ず含めてください。
- outlookの最後には、滝原塾のAIチューター（24時間対応）と専属講師による個別分析・週次復習計画という強みに自然に触れ、入塾を前向きに検討してもらえる流れにしてください。
- 誇張した表現や断定的な合格保証はしないでください。`;

function formatSubjectLine(s: ExamSubjectScore): string {
  const percent = s.fullScore > 0 ? Math.round((s.score / s.fullScore) * 1000) / 10 : 0;
  const deviation = s.deviation != null ? `　偏差値${s.deviation}` : "";
  return `- ${s.subject}: ${s.score}/${s.fullScore}点（${percent}%）${deviation}`;
}

function formatUnitLine(u: ExamUnitScore): string {
  return `- ${u.subject}/${u.unit}: 正答率${u.correctRate}%`;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  return NextResponse.json({ assessments: getProspectAssessments() });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<ProspectAssessmentInput>
    | null;

  const name = body?.name?.trim();
  const grade = body?.grade?.trim();
  const targetUniversity = body?.targetUniversity?.trim();
  const examName = body?.examName?.trim();
  const examDate = body?.examDate?.trim() ?? "";
  const subjects = (Array.isArray(body?.subjects) ? body.subjects : []).filter(
    (s): s is ExamSubjectScore =>
      Number.isFinite(s?.score) &&
      Number.isFinite(s?.fullScore) &&
      (s.deviation == null || Number.isFinite(s.deviation)),
  );
  const units = (Array.isArray(body?.units) ? body.units : []).filter(
    (u): u is ExamUnitScore => Number.isFinite(u?.correctRate),
  );
  const notes = body?.notes?.trim() ?? "";

  if (!name || !grade || !targetUniversity || !examName) {
    return NextResponse.json(
      { error: "name, grade, targetUniversity, examName は必須です" },
      { status: 400 },
    );
  }
  if (subjects.length === 0 && units.length === 0) {
    return NextResponse.json(
      { error: "教科別得点または分野別正答率のいずれかを入力してください" },
      { status: 400 },
    );
  }

  const input: ProspectAssessmentInput = {
    name,
    grade,
    targetUniversity,
    examName,
    examDate,
    subjects,
    units,
    notes,
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let report: ExamWeaknessReport | null = null;
  let source: "claude" | "rule-based" = "rule-based";

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const contextLines = [
        `生徒名: ${name}（${grade}）`,
        `志望大学: ${targetUniversity}`,
        `模試名: ${examName}`,
        examDate && `受験日: ${examDate}`,
        subjects.length > 0 && `教科別得点:\n${subjects.map(formatSubjectLine).join("\n")}`,
        units.length > 0 && `分野別正答率:\n${units.map(formatUnitLine).join("\n")}`,
        notes && `講師からの所見: ${notes}`,
      ].filter(Boolean);

      const message = await client.messages.parse({
        model: "claude-opus-4-8",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        output_config: {
          format: zodOutputFormat(ExamReportSchema),
          effort: "high",
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contextLines.join("\n") }],
      });

      if (message.parsed_output) {
        report = message.parsed_output;
        source = "claude";
      }
    } catch (error) {
      console.error("Claude API error in /api/prospects:", error);
    }
  }

  if (!report) {
    report = generateExamWeaknessReport(input);
  }

  const assessment = insertProspectAssessment(input, report, source);
  return NextResponse.json({ assessment, source });
}
