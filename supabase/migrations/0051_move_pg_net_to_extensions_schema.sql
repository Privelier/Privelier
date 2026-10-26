-- Move pg_net out of the public schema (Supabase security advisor
-- `extension_in_public`, introduced by 0049's plain `create extension`).
--
-- pg_net is not relocatable, so it is reinstalled into `extensions`. Its
-- functions live in the `net` schema either way, and dispatch_notification_push()
-- calls `net.http_post` by qualified name with plpgsql late binding, so no
-- caller changes. The request queue was verified empty before this ran; at
-- worst an in-flight best-effort push is dropped, never a notification row.

drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
