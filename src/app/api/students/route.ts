import { NextRequest, NextResponse } from "next/server";
import { addStudentToRoster, getRoster } from "@/lib/roster";
import { getSession } from "@/lib/session";
import type { NewStudentInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  return NextResponse.json({ students: getRoster() });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<NewStudentInput>
    | null;

  const name = body?.name?.trim();
  const grade = body?.grade?.trim();
  const targetUniversity = body?.targetUniversity?.trim();

  if (!name || !grade || !targetUniversity) {
    return NextResponse.json(
      { error: "name, grade, targetUniversity は必須です" },
      { status: 400 },
    );
  }

  const student = addStudentToRoster({ name, grade, targetUniversity });
  return NextResponse.json({ student });
}
