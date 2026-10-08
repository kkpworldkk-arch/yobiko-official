"use server";

import { revalidatePath } from "next/cache";
import { setStudentFeedbackResolved } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function toggleStudentFeedbackResolved(
  id: string,
  resolved: boolean,
): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    throw new Error("権限がありません");
  }
  setStudentFeedbackResolved(id, resolved);
  revalidatePath("/dashboard/settings");
}
