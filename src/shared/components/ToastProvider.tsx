import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, easing } from '../../theme/motion';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';

export type ToastOptions = {
  message: string;
  durationMs?: number;
  action?: { label: string; onPress: () => void };
  onClose?: (reason: 'timeout' | 'replace' | 'dismiss' | 'action') => void;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast requires ToastProvider');
  return value;
}

function ToastSurface({ toast, onAction }: { toast: ToastOptions; onAction: () => void }) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  useEffect(() => {
    opacity.set(withTiming(1, {
      duration: duration.base,
      easing: easing.enter,
      reduceMotion: ReduceMotion.Never,
    }));
  }, [opacity]);

  return (
    <Animated.View
      testID="global-toast"
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, space.base) + 72, backgroundColor: colors.surface, borderColor: colors.border },
        animatedStyle,
      ]}
    >
      <Text style={[styles.message, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
        {toast.message}
      </Text>
      {toast.action ? (
        <Pressable
          testID="global-toast-action"
          accessibilityRole="button"
          accessibilityLabel={toast.action.label}
          onPress={onAction}
          style={styles.action}
        >
          <Text style={[styles.actionText, { color: colors.accentText, fontFamily: fonts.bodySemiBold }]}>
            {toast.action.label}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; options: ToastOptions } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);
  const currentToast = useRef<{ id: number; options: ToastOptions } | null>(null);

  const closeToast = useCallback((reason: 'timeout' | 'replace' | 'dismiss' | 'action') => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const previous = currentToast.current;
    currentToast.current = null;
    setToast(null);
    previous?.options.onClose?.(reason);
    if (reason === 'action') previous?.options.action?.onPress();
  }, []);

  const dismissToast = useCallback(() => {
    closeToast('dismiss');
  }, [closeToast]);

  const showToast = useCallback((options: ToastOptions) => {
    if (currentToast.current) closeToast('replace');
    const id = ++nextId.current;
    const next = { id, options };
    currentToast.current = next;
    setToast(next);
    timer.current = setTimeout(() => {
      if (currentToast.current?.id === id) closeToast('timeout');
    }, Math.max(1000, options.durationMs ?? 4000));
  }, [closeToast]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);
  return (
    <ToastContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {toast ? <ToastSurface key={toast.id} toast={toast.options} onAction={() => closeToast('action')} /> : null}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    position: 'absolute',
    left: space.base,
    right: space.base,
    minHeight: 52,
    borderWidth: HAIRLINE,
    borderRadius: radius.lg,
    paddingLeft: space.base,
    paddingRight: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  message: { flex: 1, fontSize: 14, lineHeight: 20, paddingVertical: space.md },
  action: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.sm },
  actionText: { fontSize: 14 },
});
