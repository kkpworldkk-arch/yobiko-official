"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRing } from "lucide-react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Button } from "@/components/ui/button";
import { isNativeApp } from "@/lib/native-speech";

// iOSアプリでだけ表示する、毎日の復習リマインド通知の設定。通知は端末内で予約するだけで、
// サーバーには何も送らない。設定値は端末ごとの好みなので localStorage に置く。
const REMINDER_ID = 1001;
const STORAGE_KEY = "study-reminder";
const subscribeNothing = () => () => {};
const TIME_OPTIONS = ["07:00", "12:00", "17:00", "19:00", "20:00", "21:00", "22:00"];

interface ReminderPreference {
  enabled: boolean;
  time: string;
}

function readPreference(): ReminderPreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ReminderPreference;
  } catch {
    // 読めなければ既定値
  }
  return { enabled: false, time: "20:00" };
}

function writePreference(preference: ReminderPreference) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // 保存できなくても通知の予約自体は有効
  }
}

async function scheduleReminder(time: string): Promise<boolean> {
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return false;
  const [hour, minute] = time.split(":").map(Number);
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: "今日の口頭試問",
        body: "復習のタイミングです。数問だけでも答えて、記憶を定着させましょう。",
        schedule: { on: { hour, minute }, allowWhileIdle: true },
        extra: { path: "/student/oral-exam" },
      },
    ],
  });
  return true;
}

export function StudyReminderSettings() {
  // サーバー描画時は常に非表示にし、アプリ内で開いたときだけクライアント側で表示する
  const native = useSyncExternalStore(subscribeNothing, isNativeApp, () => false);
  const [preference, setPreference] = useState<ReminderPreference>(() =>
    typeof window === "undefined" ? { enabled: false, time: "20:00" } : readPreference(),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!native) return null;

  async function apply(next: ReminderPreference) {
    setIsSaving(true);
    setMessage(null);
    try {
      if (next.enabled) {
        const ok = await scheduleReminder(next.time);
        if (!ok) {
          setMessage("通知が許可されていません。iPhoneの「設定」→「滝原塾」→「通知」から許可してください。");
          next = { ...next, enabled: false };
        } else {
          setMessage(`毎日${next.time}にお知らせします。`);
        }
      } else {
        await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
        setMessage("リマインド通知をオフにしました。");
      }
      setPreference(next);
      writePreference(next);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
      <h2 className="flex items-center gap-2 text-h3 text-ivory-100">
        <BellRing className="size-4.5 text-slate-400" strokeWidth={1.75} />
        復習リマインド
      </h2>
      <p className="mt-1 mb-5 text-body-sm text-slate-400">
        毎日決まった時刻に、口頭試問の復習をお知らせします。
      </p>

      <div className="flex flex-wrap gap-2">
        {TIME_OPTIONS.map((time) => {
          const active = preference.enabled && preference.time === time;
          return (
            <button
              key={time}
              type="button"
              disabled={isSaving}
              onClick={() => apply({ enabled: true, time })}
              className={
                active
                  ? "rounded-lg border border-gold-500/50 bg-gold-500/15 px-3 py-1.5 text-body-sm text-gold-400"
                  : "rounded-lg border border-white/[0.08] px-3 py-1.5 text-body-sm text-slate-300 hover:border-white/20"
              }
            >
              {time}
            </button>
          );
        })}
      </div>

      {preference.enabled && (
        <Button
          type="button"
          variant="secondary"
          disabled={isSaving}
          onClick={() => apply({ ...preference, enabled: false })}
          className="mt-4 h-9 px-4 text-body-sm"
        >
          通知をオフにする
        </Button>
      )}

      {message && <p className="mt-3 text-caption text-slate-400">{message}</p>}
    </section>
  );
}
