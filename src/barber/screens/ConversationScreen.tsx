/**
 * Barber conversation screen: one booking chat, reached from a Chats thread
 * row. The chat itself is the shared ConversationView; this screen supplies
 * the barber's data layer, unread provider, navigation and quick replies.
 *
 * Counterpart identity: the Chats list can only offer the service name
 * (users RLS is own-row-only), so the title starts as that and upgrades to
 * the customer's real name once get_booking_counterparts (migration 0012)
 * resolves. Best effort, as on the Requests tab: a failure keeps the
 * fallback title.
 */
import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConversationView } from '../../shared/components/ConversationView';
import { getAppLanguage } from '../../shared/locale';
import type { BarberStackParamList } from '../BarberNavigator';
import {
  fetchBookingCounterpart,
  fetchConversation,
  fetchConversationNewerThan,
  sendMessage,
} from '../conversationData';
import { useUnread } from '../UnreadContext';

type Props = NativeStackScreenProps<BarberStackParamList, 'Conversation'>;

const api = { fetchConversation, fetchConversationNewerThan, sendMessage };

const QUICK_REPLIES = {
  de: ['Ich bin unterwegs.', 'Ich verspäte mich um etwa 10 Minuten.', 'Ich bin da.', 'Danke, bis bald.'],
  en: ["I'm on my way.", 'Running about 10 minutes late.', "I've arrived.", 'Thank you, see you soon.'],
} as const;

export default function ConversationScreen({ route, navigation }: Props) {
  const { room, title, subtitle } = route.params;
  const { setActiveRoom } = useUnread();
  const [counterpart, setCounterpart] = useState(route.params.counterpart ?? null);

  useEffect(() => {
    let active = true;
    void fetchBookingCounterpart(room.booking_id).then((found) => {
      if (active && found) setCounterpart({ id: found.id, name: found.name, profile_image: found.profile_image });
    });
    return () => {
      active = false;
    };
  }, [room.booking_id]);

  return (
    <ConversationView
      // A different room is a different conversation: remount, never reuse state.
      key={room.id}
      room={room}
      title={counterpart?.name ?? title}
      subtitle={subtitle}
      counterpart={counterpart}
      counterpartFallbackId={room.customer_id}
      api={api}
      setActiveRoom={setActiveRoom}
      onBack={() => navigation.goBack()}
      quickReplies={QUICK_REPLIES[getAppLanguage() === 'de' ? 'de' : 'en']}
      testIDPrefix="barber-conversation"
    />
  );
}
