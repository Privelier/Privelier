import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * One app-wide Reduce Transparency subscription shared by every glass
 * surface. Glass now lives on many components (cards, chat bubbles, chips),
 * so a per-component AccessibilityInfo listener would multiply with every
 * list row; this store subscribes once and fans the value out.
 */
let enabled = false;
let started = false;
const listeners = new Set<() => void>();

function publish(next: boolean) {
  if (next === enabled) return;
  enabled = next;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;
  // react-native-web has no Reduce Transparency API; calling it throws.
  if (Platform.OS === 'web') return;
  void AccessibilityInfo.isReduceTransparencyEnabled().then(publish).catch(() => {});
  AccessibilityInfo.addEventListener('reduceTransparencyChanged', publish);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const snapshot = () => enabled;

export function useReduceTransparency(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Test hook: forget the cached preference so each test can mock its own. */
export function resetReduceTransparencyForTests() {
  enabled = false;
  started = false;
  listeners.clear();
}
