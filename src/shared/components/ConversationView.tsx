/**
 * The booking chat, shared by both apps' Conversation screens (each app keeps
 * its own screen, navigation and data layer and passes them in).
 *
 * Messages, realtime sync, pagination, sending, read receipts and typing
 * live in useConversation; the rows and the composer in ./conversation.
 *
 * SAFETY: the other person's messages can be reported (long press or the
 * screen reader's actions); the header menu reports or blocks the person.
 * Neither appears once that person deleted their account (migration 0057).
 */
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import type { ChatRoomRow } from '../../types';
import { getAppLanguage } from '../locale';
import { useConversation, type ConversationApi, type ConversationListItem } from '../useConversation';
import { Avatar } from './Avatar';
import { ChatList } from './conversation/ChatList';
import { Composer } from './conversation/Composer';
import { useConversationStyles } from './conversation/conversationStyles';
import { GlassSurface, useGlassStyle } from './GlassSurface';
import { JumpToLatestButton } from './JumpToLatestButton';
import { Notice } from './Notice';
import { ReportSheet } from './ReportSheet';
import { SafetyMenu } from './SafetyMenu';
import { BackButton } from './ScreenBackHeader';
import { ConversationSkeleton } from './ScreenSkeletons';

interface ConversationCounterpart {
  id: string;
  name: string | null;
  profile_image: string | null;
}

interface Props {
  room: ChatRoomRow;
  title: string;
  subtitle?: string | null;
  counterpart: ConversationCounterpart | null;
  /** The other participant's id from the room; null once they deleted their account. */
  counterpartFallbackId: string | null;
  api: ConversationApi;
  /** Tells the app's unread provider which room is on screen (null on blur). */
  setActiveRoom: (roomId: string | null) => void;
  onBack: () => void;
  /** Shown above an empty composer; tapping one fills it, sending stays manual. */
  quickReplies?: readonly string[];
  /** `${testIDPrefix}` | 'barber-conversation': keeps Maestro ids stable. */
  testIDPrefix: string;
}

export function ConversationView({ room, title, subtitle, counterpart, counterpartFallbackId, api, setActiveRoom, onBack, quickReplies, testIDPrefix }: Props) {
  const de = getAppLanguage() === 'de';
  const { colors } = useTheme();
  const styles = useConversationStyles(colors);
  // Glass bubbles: yours in brass glass, theirs in neutral glass, a failed
  // send in danger glass. One shared Reduce Transparency fallback.
  const ownGlass = useGlassStyle('brass');
  const theirGlass = useGlassStyle('neutral');
  const failedGlass = useGlassStyle('danger');
  const listRef = useRef<FlatList<ConversationListItem>>(null);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const chat = useConversation(room, api, setActiveRoom);
  const counterpartId = counterpart?.id ?? counterpartFallbackId;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']} testID={`${testIDPrefix}-screen`}>
      <GlassSurface variant="navigation" style={styles.header} testID={`${testIDPrefix}-header-glass`}>
        <BackButton onPress={onBack} accessibilityLabel={de ? 'Zurück' : 'Back'} testID={`${testIDPrefix}-back`} />
        <Avatar id={counterpartId ?? room.id} name={counterpart?.name ?? title} imageUrl={counterpart?.profile_image} size={44} accessible={false} testID={`${testIDPrefix}-avatar`} />
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
        {/* Nobody to report or block once the other person deleted their account. */}
        {counterpartId ? (
          <SafetyMenu counterpartId={counterpartId} counterpartName={counterpart?.name ?? title} bookingId={room.booking_id} testIDPrefix={testIDPrefix} />
        ) : null}
      </GlassSurface>

      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {chat.loading ? (
          <ConversationSkeleton testID={`${testIDPrefix}-loading`} label={de ? 'Nachrichten werden geladen' : 'Loading messages'} />
        ) : chat.error !== null ? (
          <Notice testID={`${testIDPrefix}-error`} message={chat.error} style={styles.noticeMargins} />
        ) : (
          <ChatList
            listRef={listRef}
            styles={styles}
            chat={chat}
            glass={{ own: ownGlass, theirs: theirGlass, failed: failedGlass }}
            de={de}
            testIDPrefix={testIDPrefix}
            onAwayFromLatestChange={setAwayFromLatest}
            onReport={setReportMessageId}
          />
        )}

        {reportMessageId ? (
          <ReportSheet
            open
            target={{ type: 'message', messageId: reportMessageId }}
            bookingId={room.booking_id}
            onClose={() => setReportMessageId(null)}
            testIDPrefix={`${testIDPrefix}-message`}
          />
        ) : null}

        <JumpToLatestButton
          visible={awayFromLatest && !chat.loading && chat.error === null}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          label={de ? 'Zur neuesten Nachricht' : 'Jump to latest message'}
          testID={`${testIDPrefix}-jump-latest`}
        />

        <Composer
          styles={styles}
          draft={chat.draft}
          counterpartTyping={chat.counterpartTyping}
          quickReplies={quickReplies}
          chipGlass={theirGlass}
          de={de}
          testIDPrefix={testIDPrefix}
          onChangeDraft={chat.onChangeDraft}
          onSend={chat.send}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
