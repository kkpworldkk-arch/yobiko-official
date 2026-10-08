import { NextRequest, NextResponse } from "next/server";
import {
  createOralExamBook,
  ensureOralExamSeeded,
  getAssignedBooksForStudent,
  getOralExamBooks,
  getOralExamFilterOptions,
} from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  ensureOralExamSeeded();

  const books = session.role === "teacher"
    ? getOralExamBooks()
    : getAssignedBooksForStudent(resolveStudentIdentity(session).id).filter(
        (book) => book.questionCount > 0,
      );
  const filterOptions = Object.fromEntries(
    books.map((book) => [book.id, getOralExamFilterOptions(book.id)]),
  );
  return NextResponse.json({ books, filterOptions });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { title?: string; subject?: string; description?: string }
    | null;
  const title = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title は必須です" }, { status: 400 });
  }

  const book = createOralExamBook({
    title,
    subject: body?.subject?.trim() ?? "",
    description: body?.description?.trim() ?? "",
  });
  return NextResponse.json({ book });
}
