import { useEffect } from "react";

export type DashboardRefreshReason = "mount" | "tabPress" | "pull";
type DashboardRefreshListener = (reason: DashboardRefreshReason) => void;

const listeners = new Set<DashboardRefreshListener>();

export function emitDashboardRefresh(reason: DashboardRefreshReason) {
  listeners.forEach((listener) => listener(reason));
}

export function useDashboardRefreshListener(listener: DashboardRefreshListener) {
  useEffect(() => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listener]);
}
