export type StudentHealth = "good" | "watch" | "urgent";

export interface SubjectBreakdown {
  subject: string;
  count: number;
}

export interface StumbleTag {
  label: string;
  count: number;
}

export interface PriorityAction {
  headline: string;
  detail: string;
}

export interface Student {
  id: string;
  name: string;
  initials: string;
  grade: string;
  targetUniversity: string;
  health: StudentHealth;
  pendingTeacherChecks: number;
  questionsLast14Days: number;
  totalQuestions: number;
  lastActivity: string;
  subjectBreakdown: SubjectBreakdown[];
  topStumbles: StumbleTag[];
  priorityAction: PriorityAction;
}
