import * as Haptics from 'expo-haptics';

type HapticOperation = () => Promise<void>;

async function safelyPerform(operation: HapticOperation): Promise<void> {
  try {
    await operation();
  } catch {
    // Haptics are progressive feedback and must never block the user action.
  }
}

export const haptics = Object.freeze({
  selection: () =>
    safelyPerform(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  confirm: () =>
    safelyPerform(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () =>
    safelyPerform(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () =>
    safelyPerform(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
});
