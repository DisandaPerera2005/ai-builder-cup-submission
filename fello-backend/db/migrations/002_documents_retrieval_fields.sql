-- Extends `documents` with the retrieval-specific fields defined in
-- FELLO_ADK_CAPABILITIES_AND_SECURITY.md ("The documents table — extended
-- for retrieval"). fello-agent/skills/retrieval.py already queries
-- document_type/description — this migration is what makes those columns
-- real. Also adds the drive_file_id uniqueness needed for idempotent
-- upserts from the new Drive sync pipeline (fello-backend/backend/src/drive-sync.js).

ALTER TABLE documents
  ADD COLUMN tenant_id TEXT,
  ADD COLUMN description TEXT,
  ADD COLUMN document_type TEXT,
  ADD COLUMN ai_extracted_summary TEXT;

-- Generated columns can't be altered in place — drop and recreate with the
-- new weighted expression (filename > description > extracted summary),
-- then rebuild the GIN index that depends on it.
DROP INDEX IF EXISTS idx_docs_fts;
ALTER TABLE documents DROP COLUMN search_vector;
ALTER TABLE documents ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(file_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(ai_extracted_summary, '')), 'C')
) STORED;
CREATE INDEX idx_docs_fts ON documents USING GIN(search_vector);

CREATE INDEX idx_docs_type ON documents(org_id, event_id, document_type);
CREATE INDEX idx_docs_drive_file ON documents(org_id, drive_file_id);

-- Makes the sync job's upsert idempotent: re-syncing the same Drive file
-- updates its row instead of duplicating it.
ALTER TABLE documents
  ADD CONSTRAINT uq_documents_org_drive_file UNIQUE (org_id, drive_file_id);
