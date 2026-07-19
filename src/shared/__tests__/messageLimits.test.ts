/**
 * Pins the client-side chat length bound to the database constraint it mirrors
 * (`chk_messages_message_len`, migration 0018: btrim length between 1 and 2000).
 *
 * This is the M2-class lesson applied to messages: a constraint that holds "by
 * construction" holds only until someone edits the other side. Mocked data-layer
 * tests structurally cannot see a Postgres CHECK, so the coupling is asserted
 * here explicitly rather than left incidental.
 */
import { MAX_MESSAGE_LENGTH, MESSAGE_COUNTER_VISIBLE_AT } from '../messageLimits';

describe('message length limits', () => {
  it('matches the database CHECK bound exactly', () => {
    // If this fails, migration 0018's constraint and the composers disagree —
    // change both together or an over-length send starts failing server-side.
    expect(MAX_MESSAGE_LENGTH).toBe(2000);
  });

  it('reveals the counter before the cap, not at it', () => {
    expect(MESSAGE_COUNTER_VISIBLE_AT).toBeLessThan(MAX_MESSAGE_LENGTH);
    // Late enough to stay quiet in ordinary use — a chat message is short.
    expect(MESSAGE_COUNTER_VISIBLE_AT).toBeGreaterThan(MAX_MESSAGE_LENGTH / 2);
  });
});
