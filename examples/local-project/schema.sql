CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE context_packets (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
