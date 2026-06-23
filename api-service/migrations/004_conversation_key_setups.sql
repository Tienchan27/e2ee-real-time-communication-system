-- Lưu các "key-setup envelope" (wrappedKeys của khóa hội thoại) tách khỏi bảng messages,
-- để client luôn khôi phục được khóa bất kể hội thoại dài bao nhiêu (không bị giới hạn
-- phân trang 50 tin). Mỗi lần thiết lập khóa = 1 ephemeral public key duy nhất.
CREATE TABLE IF NOT EXISTS conversation_key_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_device_id UUID NOT NULL,
  sender_ephemeral_public_key TEXT NOT NULL,
  setup_aad JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, sender_ephemeral_public_key)
);

CREATE INDEX IF NOT EXISTS idx_cks_conversation_created
  ON conversation_key_setups (conversation_id, created_at ASC);
