import { NextRequest, NextResponse } from "next/server";
import { addOralExamQuestion, bulkAddOralExamQuestions, getOralExamQuestions } from "@/lib/db";
import { parseOralExamBulkText } from "@/lib/oral-exam-import";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  const { id } = await params;
  return NextResponse.json({ questions: getOralExamQuestions(id) });
}

interface QuestionRequestBody {
  category?: string;
  prompt?: string;
  modelAnswer?: string;
  bulkText?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as QuestionRequestBody | null;

  if (body?.bulkText?.trim()) {
    const parsed = parseOralExamBulkText(body.bulkText);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "貼り付けたテキストから問題を読み取れませんでした" },
        { status: 400 },
      );
    }
    const questions = bulkAddOralExamQuestions(id, parsed);
    return NextResponse.json({ questions });
  }

  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "prompt または bulkText は必須です" },
      { status: 400 },
    );
  }

  const question = addOralExamQuestion(id, {
    category: body?.category?.trim() ?? "",
    prompt,
    modelAnswer: body?.modelAnswer?.trim() ?? "",
  });
  return NextResponse.json({ question });
}
