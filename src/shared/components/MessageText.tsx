/**
 * Chat message text for both conversation screens (Wave 4).
 *
 * - Phone numbers, email addresses and web links inside a message become
 *   tappable (tel:, mailto:, https:). Only http(s) web links are opened;
 *   anything else stays plain text, so a message cannot trigger an
 *   arbitrary app scheme.
 * - Long-press copies the whole message to the clipboard with a haptic and a
 *   short confirmation, e.g. to paste an address into a maps app.
 */
import { Linking, Text, type StyleProp, type TextStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getAppLanguage } from '../locale';
import { haptics } from '../haptics';
import { useToast } from './ToastProvider';

export type MessageSegment =
  | { kind: 'text'; value: string }
  | { kind: 'url' | 'email' | 'phone'; value: string; href: string };

// One alternation, left to right: URL, email, phone (7+ digits, optional +,
// spaces, dots, dashes or parentheses between digits).
const TOKEN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(\+?\(?\d[\d\s().-]{5,}\d)/g;

export function linkifyMessage(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [value, url, email, phone] = match;
    const index = match.index ?? 0;
    if (phone && phone.replace(/\D/g, '').length < 7) continue;
    if (index > last) segments.push({ kind: 'text', value: text.slice(last, index) });
    if (url) segments.push({ kind: 'url', value, href: url });
    else if (email) segments.push({ kind: 'email', value, href: `mailto:${email}` });
    else segments.push({ kind: 'phone', value, href: `tel:${value.replace(/[^\d+]/g, '')}` });
    last = index + value.length;
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) });
  return segments;
}

type Props = {
  text: string;
  style: StyleProp<TextStyle>;
  linkColor: string;
  testID?: string;
};

export function MessageText({ text, style, linkColor, testID }: Props) {
  const { showToast } = useToast();
  const de = getAppLanguage() === 'de';
  const segments = linkifyMessage(text);

  const copy = async () => {
    await Clipboard.setStringAsync(text);
    void haptics.selection();
    showToast({ message: de ? 'Nachricht kopiert.' : 'Message copied.', durationMs: 1800 });
  };

  return (
    <Text
      style={style}
      onLongPress={() => void copy()}
      accessibilityHint={de ? 'Lange drücken zum Kopieren' : 'Long-press to copy'}
      testID={testID}
    >
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          segment.value
        ) : (
          <Text
            key={index}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(segment.href)}
            onLongPress={() => void copy()}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
          >
            {segment.value}
          </Text>
        )
      )}
    </Text>
  );
}
