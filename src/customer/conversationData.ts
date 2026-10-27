/**
 * Customer conversation data layer: the shared message reads and send
 * (src/shared/conversationData), with customer error codes and wording.
 */
import { createConversationData } from '../shared/conversationData';
import { failure, mapPostgrestError } from './errors';

export const { fetchConversation, fetchConversationNewerThan, sendMessage } = createConversationData({ failure, mapPostgrestError });
