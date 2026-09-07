-- WhatsApp messages with full text search
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  group_jid TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', body)) STORED
);

CREATE INDEX idx_messages_org_event ON whatsapp_messages(org_id, event_id, timestamp DESC);
CREATE INDEX idx_messages_fts ON whatsapp_messages USING GIN(search_vector);
CREATE INDEX idx_messages_group ON whatsapp_messages(org_id, group_jid, timestamp DESC);

-- Structured extractions from messages
CREATE TABLE message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  group_jid TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  type TEXT NOT NULL,
  action TEXT,
  task_id TEXT,
  raw_message_id UUID REFERENCES whatsapp_messages(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_message_events_org_event_type ON message_events(org_id, event_id, type, timestamp DESC);

-- Unified document index — all files from all sources
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  team_node_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  source TEXT NOT NULL, -- 'whatsapp', 'drive_direct', 'form', 'generated'
  uploaded_by TEXT,
  group_jid TEXT,
  message_id UUID REFERENCES whatsapp_messages(id),
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', file_name)) STORED,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_docs_org_event ON documents(org_id, event_id, timestamp DESC);
CREATE INDEX idx_docs_fts ON documents USING GIN(search_vector);
CREATE INDEX idx_docs_team ON documents(org_id, team_node_id, timestamp DESC);
