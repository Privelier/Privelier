/**
 * A number that counts up to its value (and glides between later values),
 * for dashboard metrics and stats. Ease-out over ~700 ms so it settles
 * softly; tabular digits so the width never jitters while counting.
 *
 * Accessibility: screen readers get the final formatted value only, never
 * the intermediate frames. Reduced motion shows the final value instantly.
 */
import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { numericText } from '../../theme/typography';
import { useReducedMotionPreference } from './useReducedMotionPreference';

interface Props {
  value: number;
  format?: (value: number) => string;
  durationMs?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function AnimatedNumber({ value, format = (v) => String(Math.round(v)), durationMs = 700, style, testID }: Props) {
  const reduceMotion = useReducedMotionPreference();
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  const from = useRef(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion || !Number.isFinite(value)) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const start = Date.now();
    const origin = from.current;
    let raf = requestAnimationFrame(function step() {
      const k = Math.min(1, (Date.now() - start) / durationMs);
      const next = origin + (value - origin) * easeOutCubic(k);
      from.current = next;
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, reduceMotion]);

  return (
    // numericText last, as everywhere else: digits stay lining + tabular.
    <Text style={[style, numericText]} accessibilityLabel={format(value)} testID={testID}>
      {format(shown)}
    </Text>
  );
}
