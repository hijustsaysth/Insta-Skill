export const SESSION_STORE_SCHEMA = `
CREATE TABLE IF NOT EXISTS session_refs (
  session_ref TEXT PRIMARY KEY CHECK (length(trim(session_ref)) > 0),
  account_id TEXT NOT NULL CHECK (length(trim(account_id)) > 0),
  provider_id TEXT NOT NULL CHECK (provider_id IN ('aiograpi-rest', 'official-api', 'connector')),
  session_type TEXT NOT NULL CHECK (length(trim(session_type)) > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'expired')),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0),
  updated_at TEXT NOT NULL CHECK (length(trim(updated_at)) > 0)
);

CREATE TABLE IF NOT EXISTS aiograpi_sessions (
  session_ref TEXT PRIMARY KEY CHECK (length(trim(session_ref)) > 0),
  aiograpi_session_id TEXT NOT NULL CHECK (length(trim(aiograpi_session_id)) > 0),
  base_url TEXT CHECK (base_url IS NULL OR length(trim(base_url)) > 0),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0),
  updated_at TEXT NOT NULL CHECK (length(trim(updated_at)) > 0),
  FOREIGN KEY (session_ref) REFERENCES session_refs(session_ref) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS official_api_sessions (
  session_ref TEXT PRIMARY KEY CHECK (length(trim(session_ref)) > 0),
  ig_user_id TEXT NOT NULL CHECK (length(trim(ig_user_id)) > 0),
  access_token_ciphertext TEXT NOT NULL CHECK (length(trim(access_token_ciphertext)) > 0),
  expires_at TEXT CHECK (expires_at IS NULL OR length(trim(expires_at)) > 0),
  scopes TEXT CHECK (scopes IS NULL OR length(trim(scopes)) > 0),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0),
  updated_at TEXT NOT NULL CHECK (length(trim(updated_at)) > 0),
  FOREIGN KEY (session_ref) REFERENCES session_refs(session_ref) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS connector_runtime_sessions (
  session_ref TEXT PRIMARY KEY CHECK (length(trim(session_ref)) > 0),
  adb_serial TEXT CHECK (adb_serial IS NULL OR length(trim(adb_serial)) > 0),
  runtime_host TEXT CHECK (runtime_host IS NULL OR length(trim(runtime_host)) > 0),
  artifact_dir TEXT CHECK (artifact_dir IS NULL OR length(trim(artifact_dir)) > 0),
  device_label TEXT CHECK (device_label IS NULL OR length(trim(device_label)) > 0),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0),
  updated_at TEXT NOT NULL CHECK (length(trim(updated_at)) > 0),
  FOREIGN KEY (session_ref) REFERENCES session_refs(session_ref) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_resolution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_ref TEXT NOT NULL CHECK (length(trim(session_ref)) > 0),
  provider_id TEXT CHECK (provider_id IS NULL OR provider_id IN ('aiograpi-rest', 'official-api', 'connector')),
  session_type TEXT CHECK (session_type IS NULL OR length(trim(session_type)) > 0),
  resolution_status TEXT NOT NULL CHECK (resolution_status IN ('success', 'failed')),
  error_code TEXT CHECK (
    error_code IS NULL OR error_code IN (
      'auth_required',
      'rate_limited',
      'unsupported_operation',
      'provider_request_failed',
      'NOT_IMPLEMENTED',
      'SESSION_REF_NOT_FOUND',
      'SESSION_NOT_ACTIVE',
      'SESSION_DETAIL_NOT_FOUND',
      'provider_validation_failed'
    )
  ),
  message TEXT,
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_session_resolution_logs_session_ref_id
ON session_resolution_logs(session_ref, id);
`;
