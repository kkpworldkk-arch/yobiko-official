"use server";

import { revalidatePath } from "next/cache";
import { insertAnnouncement, setAnnouncementActive, type AnnouncementAudience } from "@/lib/db";
import { getSession } from "@/lib/session";

async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("権限がありません");
  }
}

function revalidateAnnouncementPages() {
  revalidatePath("/admin");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/student", "layout");
}

// 管理者が、講師・生徒・全員のいずれかに向けて出すお知らせ。相手がアプリを開くと画面の上に出る。
export async function createAdminAnnouncement(formData: FormData): Promise<void> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "");
  if (!title || !body || title.length > 100 || body.length > 2000) return;
  if (audience !== "teacher" && audience !== "student" && audience !== "all") return;
  insertAnnouncement({ title, body, bookId: null, audience: audience as AnnouncementAudience });
  revalidateAnnouncementPages();
}

export async function toggleAdminAnnouncementActive(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  setAnnouncementActive(id, active);
  revalidateAnnouncementPages();
}
