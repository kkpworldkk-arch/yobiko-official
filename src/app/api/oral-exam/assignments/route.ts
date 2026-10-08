import { NextRequest, NextResponse } from "next/server";
import { assignOralExamBook, unassignOralExamBook } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

interface AssignmentBody {
  studentId?: string;
  bookId?: string;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as AssignmentBody | null;
  if (!body?.studentId || !body?.bookId) {
    return NextResponse.json(
      { error: "studentId, bookId は必須です" },
      { status: 400 },
    );
  }

  const assignment = assignOralExamBook(body.studentId, body.bookId);
  return NextResponse.json({ assignment });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as AssignmentBody | null;
  if (!body?.studentId || !body?.bookId) {
    return NextResponse.json(
      { error: "studentId, bookId は必須です" },
      { status: 400 },
    );
  }

  unassignOralExamBook(body.studentId, body.bookId);
  return NextResponse.json({ ok: true });
}
