CREATE TABLE IF NOT EXISTS email_users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at_ms INTEGER NOT NULL,
  last_login_at_ms INTEGER
);

CREATE TABLE IF NOT EXISTS email_login_codes (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  consumed_at_ms INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  user_agent TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_login_codes_email_created ON email_login_codes(email, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_email_login_codes_ip_created ON email_login_codes(ip_hash, created_at_ms);

CREATE TABLE IF NOT EXISTS email_login_sessions (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  session_hash TEXT NOT NULL UNIQUE,
  expires_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  last_seen_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_email_login_sessions_email ON email_login_sessions(email, expires_at_ms);
CREATE INDEX IF NOT EXISTS idx_email_login_sessions_expires ON email_login_sessions(expires_at_ms);
