/**
 * Chat message length bound, shared by both apps' conversation screens and
 * data layers.
 *
 * This MIRRORS the database constraint `chk_messages_message_len` (migration
 * 0018: `char_length(btrim(message)) between 1 and 2000`). It exists so the
 * server bound can never be the thing that rejects a send — the same discipline
 * the bio editor uses with MAX_BIO_LENGTH.
 *
 * That discipline was missing when 0018 landed, and it mattered: a pasted
 * over-length message failed 23514, the failure reason was discarded, and the
 * resulting "Not sent — tap to retry" bubble re-sent the identical text forever.
 * If this number ever changes, change the constraint in the same migration —
 * they are one decision expressed in two places.
 */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * How close to the cap the composer starts showing its counter. Mirrors the
 * bio editor's "quiet until it matters" treatment — a cap is not an error and
 * not an achievement, so the counter appears late and never turns red.
 */
export const MESSAGE_COUNTER_VISIBLE_AT = MAX_MESSAGE_LENGTH - 200;
