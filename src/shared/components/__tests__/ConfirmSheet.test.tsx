import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ConfirmSheet } from '../ConfirmSheet';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    BottomSheetModal: React.forwardRef(function MockBottomSheetModal({ children, ...props }: { children: unknown }, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
      return React.createElement(View, props, children);
    }),
    BottomSheetView: View,
    BottomSheetBackdrop: View,
  };
});

describe('ConfirmSheet', () => {
  beforeEach(() => { mockPresent.mockReset(); mockDismiss.mockReset(); });

  it('presents a restrained destructive action with accessible 52pt targets', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    await render(
      <ConfirmSheet
        open title="Cancel this booking?" message="You can undo for 5 seconds."
        confirmLabel="Cancel booking" cancelLabel="Keep booking" destructive
        onConfirm={onConfirm} onClose={onClose} testID="confirm-sheet"
      />
    );
    expect(mockPresent).toHaveBeenCalledTimes(1);
    const keep = screen.getByTestId('confirm-sheet-keep');
    const confirm = screen.getByTestId('confirm-sheet-confirm');
    expect(keep.props.accessibilityLabel).toBe('Keep booking');
    expect(confirm.props.accessibilityLabel).toBe('Cancel booking');
    expect(StyleSheet.flatten(keep.props.style).minHeight).toBe(52);
    expect(StyleSheet.flatten(confirm.props.style).minHeight).toBe(52);
    await act(async () => fireEvent.press(confirm));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.press(keep));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
