CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sop_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_active
ON executions(user_id, sop_id) WHERE status != 'finished';

CREATE TABLE IF NOT EXISTS execution_events (
  execution_id TEXT NOT NULL REFERENCES executions(id),
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  expected_revision INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(execution_id, request_id)
);

CREATE TRIGGER IF NOT EXISTS execution_event_guard
BEFORE INSERT ON execution_events
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM executions
    WHERE id = NEW.execution_id AND user_id = NEW.user_id
      AND revision = NEW.expected_revision AND status != 'finished'
  ) THEN RAISE(ABORT, 'execution_conflict') END;
END;

CREATE TRIGGER IF NOT EXISTS execution_event_apply
AFTER INSERT ON execution_events
BEGIN
  UPDATE executions SET snapshot = NEW.result,
    revision = NEW.expected_revision + 1,
    status = json_extract(NEW.result, '$.status')
  WHERE id = NEW.execution_id AND user_id = NEW.user_id;
END;
