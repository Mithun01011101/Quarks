import { useCallback, useEffect, useState } from "react";

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission as NotificationPermissionState;
  });

  useEffect(() => {
    if (!("Notification" in window)) return;
    const sync = () => setPermission(Notification.permission as NotificationPermissionState);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const request = useCallback(async () => {
    if (!("Notification" in window)) return "unsupported" as const;
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermissionState);
    return result;
  }, []);

  return { permission, request, supported: permission !== "unsupported" };
}

/** Fire a local notification right now (no-op without permission). */
export function notify(title: string, body: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    new Notification(title, { body, icon: "/icons/icon-192.png", silent: false });
  } catch {
    // notifications are best-effort
  }
}
