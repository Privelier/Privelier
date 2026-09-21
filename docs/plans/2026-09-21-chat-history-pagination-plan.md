# Chat history pagination plan

## Scope

Replace unbounded conversation reads with keyset-paginated history for both customer and barber apps. Preserve current participant RLS, Realtime publication, replica identity, send, typing, receipts, and room creation.

## Approved cursor contract

- Private page size: 40; request 41 rows to compute `hasEarlier`.
- Database ordering: `created_at DESC, id DESC` with room filter.
- UI return order: ascending, retaining the existing inverted-list state contract.
- Cursor is server-derived `{ createdAt, id }` from the oldest returned row.
- Older-page predicate is strict composite less-than on `(created_at, id)`; no offsets or counts.

## Realtime recovery

Keep channel-before-fetch and idempotent message merges. Retain a REST-page-derived high-water separately from displayed state. After reconnect, coalesce recovery passes, refresh the newest page, then page newer-than the pre-recovery high-water through exhaustion with a timestamp tie window and ID dedupe. A successful send or stream event must merge after snapshots; an older-page cursor must not be replaced by a newest-page cursor.

## UI

Use an explicit, accessible visual-top `Load earlier messages` control in each inverted list. It has loading, retry, and exhausted states and must preserve scroll position when earlier rows load.

## Schema owner decision

Only the schema architect may add the candidate index:

```sql
create index if not exists idx_messages_chat_id_created_at_id
  on public.messages (chat_id, created_at desc, id desc);
```

Do not drop existing indexes in this feature. Run authenticated `EXPLAIN (ANALYZE, BUFFERS)` with representative synthetic volume after the migration.

## Release gates

Test boundary/tie cursors, recovery beyond a page, concurrent stream/send merges, F2 reference preservation, both role screens, and participant/nonparticipant RLS. Run the two-device Maestro flow, Realtime live checks/logs, security audit, typecheck, lint, full suite, migration verification, commit, and push.
