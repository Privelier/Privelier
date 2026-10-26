/**
 * Customer conversation screen: one booking chat, reached from an Inbox
 * thread row. The chat itself is the shared ConversationView; this screen
 * supplies the customer's data layer, unread provider and navigation, and
 * the barber as the counterpart.
 */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConversationView } from '../../shared/components/ConversationView';
import type { CustomerStackParamList } from '../CustomerNavigator';
import { fetchConversation, fetchConversationNewerThan, sendMessage } from '../conversationData';
import { useUnread } from '../UnreadContext';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Conversation'>;

const api = { fetchConversation, fetchConversationNewerThan, sendMessage };

export default function ConversationScreen({ route, navigation }: Props) {
  const { room, title, subtitle, counterpart } = route.params;
  const { setActiveRoom } = useUnread();
  return (
    <ConversationView
      // A different room is a different conversation: remount, never reuse state.
      key={room.id}
      room={room}
      title={title}
      subtitle={subtitle}
      counterpart={counterpart ?? null}
      counterpartFallbackId={room.barber_id}
      api={api}
      setActiveRoom={setActiveRoom}
      onBack={() => navigation.goBack()}
      testIDPrefix="customer-conversation"
    />
  );
}
