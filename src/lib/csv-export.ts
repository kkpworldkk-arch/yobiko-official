import type { QaHistoryEntry } from "@/lib/types";

function escapeCsvField(value: string): string {
  // Excel等で開いた際に先頭が =+-@ の値が数式として実行される「CSVインジェクション」を防ぐため、
  // 該当する場合は先頭にシングルクォートを付けて文字列として扱わせる。
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function historyToCsv(history: QaHistoryEntry[]): string {
  const headers = [
    "日時",
    "教科",
    "単元",
    "質問",
    "解答状況",
    "確信度",
    "弱点タグ",
    "講師確認",
  ];

  const rows = history.map((entry) => [
    new Date(entry.askedAt).toLocaleString("ja-JP"),
    entry.subject,
    entry.unit,
    entry.question.replace(/\r?\n/g, " "),
    entry.answerStatus,
    entry.confidence,
    entry.weaknessTag,
    entry.teacherCheckNeeded
      ? entry.teacherCheckResolved
        ? "対応済み"
        : "未対応"
      : "不要",
  ]);

  // 先頭にBOMを付けてExcelで開いたときの文字化けを防ぐ
  return (
    "﻿" +
    [headers, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n")
  );
}

export function downloadHistoryCsv(history: QaHistoryEntry[], fileName: string) {
  const blob = new Blob([historyToCsv(history)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
