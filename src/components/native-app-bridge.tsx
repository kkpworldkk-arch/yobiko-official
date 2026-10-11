"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNativeApp } from "@/lib/native-speech";

// iOSアプリで、リマインド通知をタップしたときに口頭試問の画面を開く。
export function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    const handle = LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
      const path = action.notification.extra?.path;
      if (typeof path === "string" && path.startsWith("/student")) {
        router.push(path);
      }
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [router]);

  return null;
}
