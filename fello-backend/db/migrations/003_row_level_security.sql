-- Row-Level Security for every tenant-scoped table (CLAUDE.md §5.3).
--
-- Application code already scopes every query by org_id, but that is a single
-- layer. RLS makes the database itself refuse to return or accept a row whose
-- org_id doesn't match the org the current connection is acting for, so a bug
-- (or injection) in any future query can no longer cross a tenant boundary.
--
-- How the app cooperates: before running a query, the client sets the
-- transaction/session GUC `app.org_id` to the verified org id
-- (fello-backend/backend/src/db.js and fello-agent/skills/_postgres.py both do
-- this). A connection that never sets it matches no rows (fail closed) —
-- current_setting(..., true) returns NULL instead of erroring.
--
-- IMPORTANT: connect the application with a NON-superuser role that does not
-- own these tables. Superusers and table owners bypass RLS unless FORCE is
-- used — FORCE is applied here so even the owner is subject to the policies,
-- but a superuser still bypasses everything by design in PostgreSQL.

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_messages_org_isolation ON whatsapp_messages
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

ALTER TABLE message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_events FORCE ROW LEVEL SECURITY;
CREATE POLICY message_events_org_isolation ON message_events
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
CREATE POLICY documents_org_isolation ON documents
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));
