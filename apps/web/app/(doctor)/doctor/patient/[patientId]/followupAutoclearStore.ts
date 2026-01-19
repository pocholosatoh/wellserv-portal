"use client";

import { useCallback, useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
const state = new Map<string, boolean>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function getFollowupAutoclearSkip(consultationId?: string | null): boolean {
  if (!consultationId) return false;
  return state.get(consultationId) ?? false;
}

export function setFollowupAutoclearSkip(
  consultationId: string | null | undefined,
  skip: boolean,
) {
  if (!consultationId) return;
  if (skip) state.set(consultationId, true);
  else state.delete(consultationId);
  notify();
}

export function useFollowupAutoclearSkip(consultationId?: string | null) {
  const skip = useSyncExternalStore(
    subscribe,
    () => getFollowupAutoclearSkip(consultationId),
    () => false,
  );

  const setSkip = useCallback(
    (value: boolean) => setFollowupAutoclearSkip(consultationId, value),
    [consultationId],
  );

  return [skip, setSkip] as const;
}
