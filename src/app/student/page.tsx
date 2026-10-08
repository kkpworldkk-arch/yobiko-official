import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";
import { StudentTutorClient } from "./tutor-client";

export default async function StudentPage() {
  const session = await getSession();
  const identity = resolveStudentIdentity(session);

  return (
    <StudentTutorClient
      studentId={identity.id}
      studentName={identity.name}
      studentGrade={identity.grade}
      studentTargetUniversity={identity.targetUniversity}
      isDemo={identity.isDemo}
    />
  );
}
