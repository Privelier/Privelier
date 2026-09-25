import { act, fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { ToastProvider, useToast } from '../ToastProvider';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function Trigger({ onAction }: { onAction: () => void }) {
  const { showToast } = useToast();
  return (
    <>
      <Pressable testID="show-toast" onPress={() => showToast({ message: 'Adresse gespeichert', action: { label: 'Rückgängig', onPress: onAction }, durationMs: 5000 })}>
        <Text>Show</Text>
      </Pressable>
      <Pressable testID="replace-toast" onPress={() => showToast({ message: 'Profil gespeichert', durationMs: 4000 })}>
        <Text>Replace</Text>
      </Pressable>
    </>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('offers a 44pt action, invokes it once, and dismisses the toast', async () => {
    const onAction = jest.fn();
    const view = await render(<ToastProvider><Trigger onAction={onAction} /></ToastProvider>);
    await act(async () => fireEvent.press(view.getByTestId('show-toast')));
    expect(view.getByText('Adresse gespeichert')).toBeTruthy();
    const action = view.getByTestId('global-toast-action');
    expect(action.props.accessibilityLabel).toBe('Rückgängig');
    expect(action.props.style.minHeight).toBe(44);
    await act(async () => fireEvent.press(action));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('global-toast')).toBeNull();
  });

  it('replaces the prior message and expires only the latest toast', async () => {
    const view = await render(<ToastProvider><Trigger onAction={jest.fn()} /></ToastProvider>);
    await act(async () => fireEvent.press(view.getByTestId('show-toast')));
    await act(async () => { jest.advanceTimersByTime(3000); });
    await act(async () => fireEvent.press(view.getByTestId('replace-toast')));
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(view.getByText('Profil gespeichert')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(view.queryByTestId('global-toast')).toBeNull();
  });
});
