import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Animated, {
  ReduceMotion,
  useReducedMotion,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { pressScale, reducedMotion, spring } from '../../../theme/motion';
import { usePressFeedback } from '../usePressFeedback';
import { useReducedMotionPreference } from '../useReducedMotionPreference';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => (value: number) => value },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    useReducedMotion: jest.fn(),
    useSharedValue: (value: number) => {
      let currentValue = value;
      return {
        get: () => currentValue,
        set: (nextValue: number) => {
          currentValue = nextValue;
        },
      };
    },
    useAnimatedStyle: (updater: () => unknown) => updater(),
    withSpring: jest.fn((value: number) => value),
    withTiming: jest.fn((value: number) => value),
  };
});

const mockUseReducedMotion = jest.mocked(useReducedMotion);
const mockWithSpring = jest.mocked(withSpring);
const mockWithTiming = jest.mocked(withTiming);

function PressFeedbackHarness({ disabled = false }: { disabled?: boolean }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ disabled });

  return (
    <Pressable
      testID="press-target"
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={animatedStyle} />
    </Pressable>
  );
}

function ReducedMotionHarness() {
  const prefersReducedMotion = useReducedMotionPreference();
  return (
    <Text testID="preference">{prefersReducedMotion ? 'reduced' : 'standard'}</Text>
  );
}

describe('usePressFeedback', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
    mockWithSpring.mockClear();
    mockWithTiming.mockClear();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    (
      jest.spyOn(AccessibilityInfo, 'addEventListener') as unknown as jest.Mock
    ).mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('scales to 0.97 while pressed and returns to rest', async () => {
    await render(<PressFeedbackHarness />);
    const target = screen.getByTestId('press-target');

    await fireEvent(target, 'pressIn');
    expect(mockWithSpring).toHaveBeenCalledWith(pressScale, spring.press);

    await fireEvent(target, 'pressOut');
    expect(mockWithSpring).toHaveBeenLastCalledWith(1, spring.press);
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('uses only a short opacity fade when Reduce Motion is enabled', async () => {
    mockUseReducedMotion.mockReturnValue(true);
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<PressFeedbackHarness />);
    const target = screen.getByTestId('press-target');

    await fireEvent(target, 'pressIn');
    expect(mockWithTiming).toHaveBeenCalledWith(
      reducedMotion.pressOpacity,
      expect.objectContaining({
        duration: reducedMotion.fadeDuration,
        reduceMotion: ReduceMotion.Never,
      })
    );
    expect(mockWithSpring).not.toHaveBeenCalled();

    await fireEvent(target, 'pressOut');
    expect(mockWithTiming).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ duration: reducedMotion.fadeDuration })
    );
  });

  it('does not animate a disabled control', async () => {
    await render(<PressFeedbackHarness disabled />);
    await fireEvent(screen.getByTestId('press-target'), 'pressIn');

    expect(mockWithSpring).not.toHaveBeenCalled();
    expect(mockWithTiming).not.toHaveBeenCalled();
  });
});

describe('useReducedMotionPreference', () => {
  it('responds when the OS Reduce Motion preference changes', async () => {
    let listener: ((isEnabled: boolean) => void) | undefined;
    const remove = jest.fn();
    mockUseReducedMotion.mockReturnValue(false);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    (
      jest.spyOn(AccessibilityInfo, 'addEventListener') as unknown as jest.Mock
    ).mockImplementation((_: string, handler: (isEnabled: boolean) => void) => {
      listener = handler;
      return { remove };
    });

    const rendered = await render(<ReducedMotionHarness />);
    expect(screen.getByTestId('preference').props.children).toBe('standard');

    await act(() => listener?.(true));
    expect(screen.getByTestId('preference').props.children).toBe('reduced');

    await rendered.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
