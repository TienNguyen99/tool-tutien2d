CREATE TABLE IF NOT EXISTS events (
  tenant TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (tenant, id)
);
CREATE INDEX IF NOT EXISTS events_recent ON events(tenant, created_at);
CREATE TABLE IF NOT EXISTS fixes (
  tenant TEXT NOT NULL, stage INTEGER NOT NULL, payload TEXT NOT NULL,
  PRIMARY KEY (tenant, stage)
);
