/**
 * The inverted message list: newest at the bottom (index 0), "load earlier"
 * as the footer (visually the top), and the empty state.
 */
import type { RefObject } from 'react';
import { FlatList, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ConversationListItem, useConversation } from '../../useConversation';
import { JUMP_TO_LATEST_THRESHOLD } from '../JumpToLatestButton';
import { DayDivider, LoadEarlier, MessageBubble, PendingBubble } from './ChatRows';
import type { ConversationStyles } from './conversationStyles';
import { listPerformance } from '../../listPerformance';

type Glass = StyleProp<ViewStyle>;

export function ChatList({ listRef, styles, chat, glass, de, testIDPrefix, onAwayFromLatestChange, onReport }: {
  listRef: RefObject<FlatList<ConversationListItem> | null>;
  styles: ConversationStyles;
  chat: ReturnType<typeof useConversation>;
  glass: { own: Glass; theirs: Glass; failed: Glass };
  de: boolean;
  testIDPrefix: string;
  onAwayFromLatestChange: (away: boolean) => void;
  onReport: (messageId: string) => void;
}) {
  return (
    <FlatList
      ref={listRef}
      inverted
      testID={`${testIDPrefix}-list`}
      // Inverted: offset 0 is the newest message.
      onScroll={(event) => onAwayFromLatestChange(event.nativeEvent.contentOffset.y > JUMP_TO_LATEST_THRESHOLD)}
      scrollEventThrottle={64}
      data={chat.listData}
      {...listPerformance}
      // Inverted lists blank rows on Android with clipped subviews.
      removeClippedSubviews={false}
      keyExtractor={(item) => (item.kind === 'pending' ? `pending-${item.pending.key}` : item.kind === 'day' ? item.key : item.message.id)}
      contentContainerStyle={styles.listContent}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      ListFooterComponent={
        chat.hasEarlier ? (
          <LoadEarlier
            styles={styles}
            loading={chat.loadingEarlier}
            error={chat.earlierError}
            de={de}
            testIDPrefix={testIDPrefix}
            onPress={() => void chat.loadEarlier()}
          />
        ) : undefined
      }
      ListEmptyComponent={
        // NO manual counter-transform here: VirtualizedList composes its own
        // inversion style onto ListEmptyComponent, and on Android that
        // inversion is scale(-1) (both axes), not scaleY(-1) — a manual
        // transform overrides RN's counter-flip and mirrors the text.
        <View style={styles.empty}>
          <Text style={styles.emptyText} testID={`${testIDPrefix}-empty`}>{de ? 'Noch keine Nachrichten. Sag hallo.' : 'No messages yet. Say hello.'}</Text>
        </View>
      }
      renderItem={({ item }) => {
        if (item.kind === 'day') return <DayDivider styles={styles} label={item.label} glass={glass.theirs} />;
        if (item.kind === 'pending') {
          return (
            <PendingBubble
              styles={styles}
              pending={item.pending}
              ownGlass={glass.own}
              failedGlass={glass.failed}
              de={de}
              testIDPrefix={testIDPrefix}
              onRetry={() => chat.retry(item.pending.key)}
            />
          );
        }
        const own = item.message.sender_id === chat.myId;
        return (
          <MessageBubble
            styles={styles}
            message={item.message}
            own={own}
            showTimestamp={item.showTimestamp}
            glass={own ? glass.own : glass.theirs}
            counterpartLastReadAt={chat.counterpartLastReadAt}
            isReadMarker={item.message.id === chat.readMarkerId}
            de={de}
            testIDPrefix={testIDPrefix}
            onReport={() => onReport(item.message.id)}
          />
        );
      }}
    />
  );
}
