import { getStudentById, getStudentIdForUser } from "@/lib/db";
import { demoStudent } from "@/lib/mock-data";
import type { SessionPayload } from "@/lib/session";

export interface StudentIdentity {
  id: string;
  name: string;
  initials: string;
  grade: string;
  targetUniversity: string;
  isDemo: boolean;
}

const DEMO_IDENTITY: StudentIdentity = {
  id: demoStudent.id,
  name: demoStudent.name,
  initials: demoStudent.initials,
  grade: demoStudent.grade,
  targetUniversity: demoStudent.targetUniversity,
  isDemo: true,
};

/**
 * familyロールのセッションを、実際に紐付けられた生徒台帳(students)の本人情報に解決する。
 * 生徒アカウントがまだどの生徒とも紐付いていない場合は、従来通りデモ生徒にフォールバックする。
 */
export function resolveStudentIdentity(
  session: SessionPayload | null,
): StudentIdentity {
  if (session?.role === "family") {
    const linkedId = getStudentIdForUser(session.userId);
    if (linkedId) {
      const record = getStudentById(linkedId);
      if (record) {
        return {
          id: record.id,
          name: record.name,
          initials: record.initials,
          grade: record.grade,
          targetUniversity: record.targetUniversity,
          isDemo: false,
        };
      }
    }
  }
  return DEMO_IDENTITY;
}
