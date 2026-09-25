import { ReduceMotion } from 'react-native-reanimated';
import {
  duration,
  easing,
  pressOpacity,
  pressScale,
  reducedMotion,
  spring,
} from '../motion';

jest.mock('react-native-reanimated', () => ({
  Easing: { bezier: () => (value: number) => value },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));

describe('motion tokens', () => {
  it('keeps durations ordered and press feedback restrained', () => {
    expect(duration.instant).toBe(0);
    expect(duration.fast).toBeLessThan(duration.base);
    expect(duration.base).toBeLessThan(duration.slow);
    expect(pressScale).toBe(0.97);
    expect(reducedMotion).toEqual({
      pressOpacity: pressOpacity.soft,
      fadeDuration: duration.fast,
    });
  });

  it('provides worklet-safe timing curves', () => {
    expect(easing.standard).toBeDefined();
    expect(easing.enter).toBeDefined();
    expect(easing.exit).toBeDefined();
  });

  it.each(Object.entries(spring))('%s spring is clamped and system-aware', (_, preset) => {
    expect(preset.overshootClamping).toBe(true);
    expect(preset.reduceMotion).toBe(ReduceMotion.System);
  });
});
