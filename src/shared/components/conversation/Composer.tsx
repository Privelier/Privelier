/**
 * The chat composer: the typing indicator slot, the near-cap character
 * counter, quick replies above an empty draft, and the input with its brass
 * send disc. The input's maxLength mirrors the DB constraint so the server
 * bound can never be the rejecter (migration 0018).
 */
import { Pressable, ScrollView, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { pressOpacity } from '../../../theme/motion';
import { useTheme } from '../../../theme/useTheme';
import { MAX_MESSAGE_LENGTH, MESSAGE_COUNTER_VISIBLE_AT } from '../../messageLimits';
import { GlassSurface } from '../GlassSurface';
import type { ConversationStyles } from './conversationStyles';

export function Composer({ styles, draft, counterpartTyping, quickReplies, chipGlass, de, testIDPrefix, onChangeDraft, onSend }: {
  styles: ConversationStyles;
  draft: string;
  counterpartTyping: boolean;
  quickReplies?: readonly string[];
  chipGlass: StyleProp<ViewStyle>;
  de: boolean;
  testIDPrefix: string;
  onChangeDraft: (text: string) => void;
  onSend: () => void;
}) {
  const { colors } = useTheme();
  const canSend = draft.trim().length > 0;
  return (
    <>
      {/* Fixed-height slot: the indicator appears/disappears without any
          layout shift (typing state is ephemeral and frequent). */}
      <View style={styles.typingSlot} accessibilityLiveRegion="polite">
        {counterpartTyping ? <Text style={styles.typingText} testID={`${testIDPrefix}-typing`}>{de ? 'Schreibt …' : 'Typing…'}</Text> : null}
      </View>

      {/* Quiet until the cap is actually near — see MESSAGE_COUNTER_VISIBLE_AT. */}
      {draft.length >= MESSAGE_COUNTER_VISIBLE_AT ? (
        <Text
          style={styles.messageCounter}
          accessibilityLabel={de ? `Noch ${MAX_MESSAGE_LENGTH - draft.length} Zeichen` : `${MAX_MESSAGE_LENGTH - draft.length} characters left`}
          testID={`${testIDPrefix}-counter`}
        >
          {draft.length} / {MAX_MESSAGE_LENGTH}
        </Text>
      ) : null}

      {quickReplies && draft.length === 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.quickRow}
          testID={`${testIDPrefix}-quick-replies`}
        >
          {quickReplies.map((reply, index) => (
            <Pressable
              key={reply}
              onPress={() => onChangeDraft(reply)}
              accessibilityRole="button"
              accessibilityLabel={reply}
              testID={`${testIDPrefix}-quick-reply-${index}`}
              style={({ pressed }) => [styles.quickChip, chipGlass, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.quickText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <GlassSurface variant="navigation" style={styles.inputRow} testID={`${testIDPrefix}-composer-glass`}>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={de ? 'Nachricht schreiben' : 'Write a message'}
          accessibilityLabel={de ? 'Nachricht schreiben' : 'Write a message'}
          selectionColor={colors.accent}
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          style={styles.input}
          testID={`${testIDPrefix}-input`}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={de ? 'Nachricht senden' : 'Send message'}
          onPress={onSend}
          disabled={!canSend}
          accessibilityState={{ disabled: !canSend }}
          style={({ pressed }) => [styles.sendButton, !canSend ? styles.sendButtonDisabled : pressed ? { opacity: pressOpacity.firm } : null]}
          testID={`${testIDPrefix}-send`}
        >
          <Feather name="arrow-up" size={20} color={colors.onAccent} />
        </Pressable>
      </GlassSurface>
    </>
  );
}
