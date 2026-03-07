-- HENRYHUB.ai Database Setup
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New conversation',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics events table (cookie-free tracking)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  session_id TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  page_path TEXT DEFAULT '/',
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS for server-side API access
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events DISABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ══════════════════════════════════════════════════════════════
-- Admin Analytics RPC Functions
-- ══════════════════════════════════════════════════════════════

-- Overview stats
CREATE OR REPLACE FUNCTION admin_overview_stats()
RETURNS JSON AS $$
  SELECT json_build_object(
    'sessions_today', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE event_name = 'session_start' AND created_at >= CURRENT_DATE),
    'sessions_week', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE event_name = 'session_start' AND created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'sessions_month', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE event_name = 'session_start' AND created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'auth_events_month', (SELECT COUNT(*) FROM analytics_events WHERE event_name = 'auth_complete' AND created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'total_messages', (SELECT COUNT(*) FROM analytics_events WHERE event_name = 'chat_message_sent'),
    'total_csv_downloads', (SELECT COUNT(*) FROM analytics_events WHERE event_name = 'csv_download')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Feature usage stats
CREATE OR REPLACE FUNCTION admin_feature_usage()
RETURNS JSON AS $$
  SELECT json_build_object(
    'chart_types', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT properties->>'chartType' as name, COUNT(*) as count
        FROM analytics_events WHERE event_name = 'chart_type_change' AND properties->>'chartType' IS NOT NULL
        GROUP BY properties->>'chartType' ORDER BY count DESC
      ) t
    ),
    'timeframes', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT properties->>'timeframe' as name, COUNT(*) as count
        FROM analytics_events WHERE event_name = 'timeframe_change' AND properties->>'timeframe' IS NOT NULL
        GROUP BY properties->>'timeframe' ORDER BY count DESC
      ) t
    ),
    'candle_intervals', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT properties->>'interval' as name, COUNT(*) as count
        FROM analytics_events WHERE event_name = 'candle_interval_change' AND properties->>'interval' IS NOT NULL
        GROUP BY properties->>'interval' ORDER BY count DESC
      ) t
    ),
    'ema_toggles', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT properties->>'ema' as name, COUNT(*) as count
        FROM analytics_events WHERE event_name = 'ema_toggle' AND (properties->>'enabled')::boolean = true
        GROUP BY properties->>'ema' ORDER BY count DESC
      ) t
    ),
    'model_switches', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT properties->>'model' as name, COUNT(*) as count
        FROM analytics_events WHERE event_name = 'model_switch' AND properties->>'model' IS NOT NULL
        GROUP BY properties->>'model' ORDER BY count DESC
      ) t
    )
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Referrer sources
CREATE OR REPLACE FUNCTION admin_referrer_sources()
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT
      CASE
        WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
        ELSE SPLIT_PART(SPLIT_PART(referrer, '://', 2), '/', 1)
      END as source,
      COUNT(*) as count
    FROM analytics_events
    WHERE event_name = 'session_start' AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY source ORDER BY count DESC LIMIT 20
  ) t;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Per-user activity
CREATE OR REPLACE FUNCTION admin_user_activity()
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT
      u.id, u.email, u.display_name, u.created_at,
      COALESCE(msg.total_messages, 0) as total_messages,
      msg.last_active,
      msg.preferred_model
    FROM users u
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) as total_messages,
        MAX(ae.created_at) as last_active,
        (SELECT properties->>'model' FROM analytics_events
         WHERE user_id = u.id AND event_name = 'model_switch'
         ORDER BY created_at DESC LIMIT 1) as preferred_model
      FROM analytics_events ae
      WHERE ae.user_id = u.id AND ae.event_name = 'chat_message_sent'
    ) msg ON true
    WHERE u.role != 'admin'
    ORDER BY msg.last_active DESC NULLS LAST
    LIMIT 100
  ) t;
$$ LANGUAGE SQL SECURITY DEFINER;
