CREATE INDEX IF NOT EXISTS idx_ep_posts_recent
ON ec_posts (deleted_at, status, published_at DESC, title ASC, id DESC);

CREATE INDEX IF NOT EXISTS idx_ep_options_name_nocase
ON options (name COLLATE NOCASE);

PRAGMA optimize;
