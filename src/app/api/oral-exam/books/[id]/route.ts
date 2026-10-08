import { NextRequest, NextResponse } from "next/server";
import {
  deleteOralExamBook,
  getAssignedStudentIds,
  getOralExamBook,
  getOralExamQuestions,
  updateOralExamBook,
} from "@/lib/db";
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
  const book = getOralExamBook(id);
  if (!book) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    book,
    questions: getOralExamQuestions(id),
    assignedStudentIds: getAssignedStudentIds(id),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const book = getOralExamBook(id);
  if (!book) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { title?: string; subject?: string; description?: string }
    | null;
  const title = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title は必須です" }, { status: 400 });
  }

  updateOralExamBook(id, {
    title,
    subject: body?.subject?.trim() ?? "",
    description: body?.description?.trim() ?? "",
  });
  return NextResponse.json({ book: getOralExamBook(id) });
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
  deleteOralExamBook(id);
  return NextResponse.json({ ok: true });
}
