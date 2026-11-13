"use server";

import { revalidatePath } from "next/cache";
import { insertAnnouncement, setAnnouncementActive, setStudentFeedbackResolved } from "@/lib/db";
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

export async function createAnnouncement(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    throw new Error("権限がありません");
  }
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const bookId = String(formData.get("bookId") ?? "").trim();
  if (!title || !body || title.length > 100 || body.length > 2000) return;
  insertAnnouncement({ title, body, bookId: bookId || null });
  revalidatePath("/dashboard/settings");
  revalidatePath("/student", "layout");
}

export async function toggleAnnouncementActive(id: string, active: boolean): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    throw new Error("権限がありません");
  }
  setAnnouncementActive(id, active);
  revalidatePath("/dashboard/settings");
  revalidatePath("/student", "layout");
}
