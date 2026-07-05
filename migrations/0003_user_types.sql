ALTER TABLE users ADD COLUMN type TEXT NOT NULL DEFAULT 'standard';

UPDATE users
SET type = 'admin'
WHERE id = created_by;

CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);
