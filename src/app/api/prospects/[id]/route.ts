import { NextResponse } from "next/server";
import { getProspectAssessment } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const assessment = getProspectAssessment(id);

  if (!assessment) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ assessment });
}
