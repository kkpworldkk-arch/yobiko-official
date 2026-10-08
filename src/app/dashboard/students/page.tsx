"use client";

import { useEffect, useState } from "react";
import { StudentCard } from "@/components/student-card";
import { AddStudentDialog } from "@/components/add-student-dialog";
import type { Student } from "@/lib/types";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/students")
      .then((res) => res.json())
      .then((data) => setStudents(data.students ?? []))
      .catch(() => setStudents([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ivory-100">生徒一覧</h1>
          <p className="mt-1 text-body-sm text-slate-400">
            担当する全生徒を表示しています。{students.length}名。
          </p>
        </div>
        <AddStudentDialog
          onAdded={(student) => setStudents((prev) => [...prev, student])}
        />
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-body-sm text-slate-500">
          読み込み中…
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      )}
    </div>
  );
}
