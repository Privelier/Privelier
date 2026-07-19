/**
 * Component tests for the barber BioEditScreen (build-order step 17, bio-edit run).
 * A leaf editor on a plain useEffect (architect-review C6), so unlike the
 * focus-effect screens it is fully component-testable — same pattern and mock
 * shape as LocationEditScreen.test.tsx. The data layer is mocked.
 *
 * What these pin hardest:
 *  - Save writes the typed text and pops back (C5), and an untouched screen
 *    cannot save at all (no no-op writes).
 *  - Clearing an existing bio is a legitimate save that reaches updateOwnBio
 *    (which stores empty as NULL) and is labelled as a removal, not damage.
 *  - The `beforeRemove` discard guard blocks an abandoning back tap — AND does
 *    NOT fire after a successful save. That second half is the real trap: onSave
 *    pops while `dirty` is still true (initialBio is never rewritten), so
 *    without `savedRef` a SUCCESSFUL save would raise a discard dialog.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import BioEditScreen from '../BioEditScreen';
import { fetchOwnBarberProfile, updateOwnBio } from '../../profileData';

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: { user: { id: 'barber-1' } } } })
      ),
    },
  },
}));

jest.mock('../../profileData', () => ({
  MAX_BIO_LENGTH: 500,
  fetchOwnBarberProfile: jest.fn(),
  updateOwnBio: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      background: '#121214',
      surface: '#1B1B1E',
      border: '#2A2A2E',
      textPrimary: '#F5F1E8',
      textSecondary: '#9A968C',
      accent: '#BFA06B',
      accentText: '#BFA06B',
      onAccent: '#121214',
      error: '#A8453E',
      errorText: '#A8453E',
      successText: '#51785C',
    },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans', bodySemiBold: 'sans' },
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockFetchProfile = fetchOwnBarberProfile as jest.Mock;
const mockUpdateBio = updateOwnBio as jest.Mock;

/**
 * The screen registers a `beforeRemove` listener; the nav mock both hands back
 * an unsubscribe (required — the effect returns it as its cleanup) and keeps
 * the latest listener so a back gesture can be simulated.
 */
type RemoveListener = (e: {
  preventDefault: jest.Mock;
  data: { action: { type: string } };
}) => void;

let beforeRemoveListener: RemoveListener | null;
let navigation: {
  goBack: jest.Mock;
  dispatch: jest.Mock;
  addListener: jest.Mock;
};

/** Simulate a back gesture; returns the event so the test can inspect it. */
function fireBeforeRemove() {
  const event = {
    preventDefault: jest.fn(),
    data: { action: { type: 'POP' } },
  };
  beforeRemoveListener?.(event);
  return event;
}

const PROFILE = (bio: string | null) => ({
  status: 'ok' as const,
  profile: { user_id: 'barber-1', bio, verified: false, verification_status: 'pending' },
});

async function renderScreen() {
  await render(<BioEditScreen navigation={navigation as never} route={{} as never} />);
}

/** Flush the mount's awaited chain (getSession -> fetchOwnBarberProfile -> state). */
async function flushMount() {
  await act(async () => {});
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  beforeRemoveListener = null;
  navigation = {
    goBack: jest.fn(),
    dispatch: jest.fn(),
    addListener: jest.fn((event: string, listener: RemoveListener) => {
      if (event === 'beforeRemove') beforeRemoveListener = listener;
      return jest.fn();
    }),
  };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('BioEditScreen', () => {
  it('seeds the authoritative bio, refuses a no-op save, and writes the edited text', async () => {
    mockFetchProfile.mockResolvedValue(PROFILE('Ten years of sharp fades.'));
    mockUpdateBio.mockResolvedValue(PROFILE('Fifteen years of sharp fades.'));

    await renderScreen();
    await flushMount();

    // C5: the field shows what the server returned, not a route-param seed.
    expect(screen.getByTestId('barber-bio-input').props.value).toBe('Ten years of sharp fades.');
    expect(mockFetchProfile).toHaveBeenCalledWith('barber-1');

    // Untouched: nothing to write, so save is disabled.
    expect(screen.getByTestId('barber-bio-save').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.changeText(
      screen.getByTestId('barber-bio-input'),
      'Fifteen years of sharp fades.'
    );
    expect(screen.getByTestId('barber-bio-save').props.accessibilityState?.disabled).toBe(false);

    await fireEvent.press(screen.getByTestId('barber-bio-save'));
    await act(async () => {});

    expect(mockUpdateBio).toHaveBeenCalledWith('barber-1', 'Fifteen years of sharp fades.');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('treats clearing an existing bio as a removal save, not a destructive act', async () => {
    mockFetchProfile.mockResolvedValue(PROFILE('Ten years of sharp fades.'));
    mockUpdateBio.mockResolvedValue(PROFILE(null));

    await renderScreen();
    await flushMount();

    await fireEvent.changeText(screen.getByTestId('barber-bio-input'), '');

    // Honest labelling + the calm hint, but it stays an ordinary save.
    expect(screen.getByText('Remove bio')).toBeTruthy();
    expect(screen.getByTestId('barber-bio-clear-hint')).toBeTruthy();
    expect(screen.getByTestId('barber-bio-save').props.accessibilityState?.disabled).toBe(false);

    await fireEvent.press(screen.getByTestId('barber-bio-save'));
    await act(async () => {});

    // The empty string reaches the data layer, which is what stores NULL.
    expect(mockUpdateBio).toHaveBeenCalledWith('barber-1', '');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('shows no clear hint when there was no bio to begin with', async () => {
    mockFetchProfile.mockResolvedValue(PROFILE(null));

    await renderScreen();
    await flushMount();

    expect(screen.getByTestId('barber-bio-input').props.value).toBe('');
    expect(screen.queryByTestId('barber-bio-clear-hint')).toBeNull();
    expect(screen.getByText('Save bio')).toBeTruthy();
    // Empty -> empty is not dirty.
    expect(screen.getByTestId('barber-bio-save').props.accessibilityState?.disabled).toBe(true);
  });

  it('guards an abandoning back tap, but never after a successful save', async () => {
    mockFetchProfile.mockResolvedValue(PROFILE('Ten years of sharp fades.'));
    mockUpdateBio.mockResolvedValue(PROFILE('Edited.'));

    await renderScreen();
    await flushMount();

    // Clean screen: leaving is not obstructed.
    const cleanExit = fireBeforeRemove();
    expect(cleanExit.preventDefault).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();

    // Dirty screen: the back gesture is blocked and a discard dialog is raised.
    await fireEvent.changeText(screen.getByTestId('barber-bio-input'), 'Edited.');
    const dirtyExit = fireBeforeRemove();
    expect(dirtyExit.preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Discard changes?',
      expect.any(String),
      expect.any(Array)
    );

    // Confirming "Discard" dispatches the original navigation action.
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    buttons.find((b) => b.text === 'Discard')?.onPress?.();
    expect(navigation.dispatch).toHaveBeenCalledWith(dirtyExit.data.action);

    // THE TRAP: a successful save pops while `dirty` is still true. The guard
    // must stand down, or saving would raise a discard dialog over saved work.
    (Alert.alert as jest.Mock).mockClear();
    await fireEvent.press(screen.getByTestId('barber-bio-save'));
    await act(async () => {});
    expect(navigation.goBack).toHaveBeenCalled();

    const savedExit = fireBeforeRemove();
    expect(savedExit.preventDefault).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('surfaces a failed save as a form error and stays on the screen', async () => {
    mockFetchProfile.mockResolvedValue(PROFILE(null));
    mockUpdateBio.mockResolvedValue({
      status: 'error',
      code: 'network',
      message: 'We could not save your bio. Check your connection and try again.',
      retryable: true,
    });

    await renderScreen();
    await flushMount();

    await fireEvent.changeText(screen.getByTestId('barber-bio-input'), 'A new bio.');
    await fireEvent.press(screen.getByTestId('barber-bio-save'));
    await act(async () => {});

    expect(screen.getByTestId('barber-bio-error')).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();

    // Editing clears the stale notice above the field being fixed.
    await fireEvent.changeText(screen.getByTestId('barber-bio-input'), 'A new bio!');
    expect(screen.queryByTestId('barber-bio-error')).toBeNull();
  });

  it('renders a load failure instead of an editable field', async () => {
    mockFetchProfile.mockResolvedValue({
      status: 'error',
      code: 'network',
      message: 'We could not load your profile. Check your connection and try again.',
      retryable: true,
    });

    await renderScreen();
    await flushMount();

    expect(screen.getByTestId('barber-bio-load-error')).toBeTruthy();
    expect(screen.queryByTestId('barber-bio-input')).toBeNull();
    expect(screen.queryByTestId('barber-bio-save')).toBeNull();
  });

  it('emphasises the character counter only in the last 50 characters', async () => {
    mockFetchProfile.mockResolvedValue(PROFILE(null));

    await renderScreen();
    await flushMount();

    await fireEvent.changeText(screen.getByTestId('barber-bio-input'), 'x'.repeat(100));
    expect(screen.getByTestId('barber-bio-counter').props.children.join('')).toBe('100 / 500');
    // Muted + regular weight well clear of the cap.
    expect(screen.getByTestId('barber-bio-counter').props.accessibilityLabel).toBe(
      '100 of 500 characters used'
    );

    // Past 450 it gains weight (never colour — the cap is not an error).
    await fireEvent.changeText(screen.getByTestId('barber-bio-input'), 'x'.repeat(470));
    expect(screen.getByTestId('barber-bio-counter').props.accessibilityLabel).toBe(
      '30 characters left'
    );

    await fireEvent.changeText(screen.getByTestId('barber-bio-input'), 'x'.repeat(500));
    expect(screen.getByTestId('barber-bio-counter').props.accessibilityLabel).toBe(
      "You've reached the 500 character limit"
    );
  });
});
