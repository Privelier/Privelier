/**
 * Text input for use inside @gorhom/bottom-sheet sheets.
 *
 * Replaces the library's BottomSheetTextInput, which imports `TextInput`
 * from react-native-gesture-handler — renamed `LegacyTextInput` in Gesture
 * Handler 3 (Expo SDK 58), so it now renders `undefined` and crashes. This
 * keeps the exact keyboard bookkeeping (register the node with the sheet,
 * report focus/blur so the sheet lifts above the keyboard) on React Native's
 * own TextInput, via the library's public useBottomSheetInternal hook.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  findNodeHandle,
  TextInput,
  type TextInputFocusEvent,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { useBottomSheetInternal } from '@gorhom/bottom-sheet';

export const SheetTextInput = forwardRef<TextInputInstance | null, TextInputProps>(function SheetTextInput(
  { onFocus, onBlur, ...rest },
  providedRef
) {
  const ref = useRef<TextInputInstance>(null);
  const { animatedKeyboardState, textInputNodesRef } = useBottomSheetInternal();

  const handleFocus = useCallback(
    (event: TextInputFocusEvent) => {
      animatedKeyboardState.set((state) => ({ ...state, target: event.nativeEvent.target }));
      onFocus?.(event);
    },
    [animatedKeyboardState, onFocus]
  );

  const handleBlur = useCallback(
    (event: TextInputFocusEvent) => {
      const keyboard = animatedKeyboardState.get();
      const focused = findNodeHandle(TextInput.State.currentlyFocusedInput());
      // Only clear the target if it is ours and focus did not just move to
      // another input inside the same sheet.
      if (keyboard.target === event.nativeEvent.target && !(focused && textInputNodesRef.current.has(focused))) {
        animatedKeyboardState.set((state) => ({ ...state, target: undefined }));
      }
      onBlur?.(event);
    },
    [animatedKeyboardState, textInputNodesRef, onBlur]
  );

  useEffect(() => {
    const node = findNodeHandle(ref.current);
    if (!node) return;
    const nodes = textInputNodesRef.current;
    nodes.add(node);
    return () => {
      if (animatedKeyboardState.get().target === node) {
        animatedKeyboardState.set((state) => ({ ...state, target: undefined }));
      }
      nodes.delete(node);
    };
  }, [animatedKeyboardState, textInputNodesRef]);

  useImperativeHandle(providedRef, () => ref.current as TextInputInstance, []);

  return <TextInput ref={ref} onFocus={handleFocus} onBlur={handleBlur} {...rest} />;
});
