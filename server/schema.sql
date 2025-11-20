CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  auth_verifier TEXT NOT NULL,
  auth_salt BYTEA NOT NULL,
  kdf_params JSONB NOT NULL DEFAULT '{}',
  vault_blob TEXT,
  vault_iv TEXT,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

