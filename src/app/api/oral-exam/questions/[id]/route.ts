import { NextRequest, NextResponse } from "next/server";
import { deleteOralExamQuestion, getOralExamQuestion, updateOralExamQuestion } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const existing = getOralExamQuestion(id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { category?: string; prompt?: string; modelAnswer?: string }
    | null;
  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt は必須です" }, { status: 400 });
  }

  updateOralExamQuestion(id, {
    category: body?.category?.trim() ?? "",
    prompt,
    modelAnswer: body?.modelAnswer?.trim() ?? "",
  });
  return NextResponse.json({ question: getOralExamQuestion(id) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  deleteOralExamQuestion(id);
  return NextResponse.json({ ok: true });
}
