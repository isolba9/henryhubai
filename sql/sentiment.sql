-- ============================================================
-- HENRYHUB.ai — Sentiment Monitor Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Raw Reddit posts/comments with sentiment analysis
CREATE TABLE IF NOT EXISTS reddit_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reddit_id TEXT UNIQUE NOT NULL,
  subreddit TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  author TEXT,
  post_type TEXT DEFAULT 'post' CHECK (post_type IN ('post', 'comment')),
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  permalink TEXT,
  sentiment_score REAL NOT NULL,
  sentiment_label TEXT NOT NULL CHECK (sentiment_label IN ('bullish', 'bearish', 'neutral')),
  keywords TEXT[] DEFAULT '{}',
  posted_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reddit_posts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reddit_posts_subreddit ON reddit_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_posted_at ON reddit_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_reddit_id ON reddit_posts(reddit_id);

-- Pre-aggregated daily sentiment snapshots
CREATE TABLE IF NOT EXISTS sentiment_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  subreddit TEXT NOT NULL,
  avg_sentiment REAL NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  bullish_count INTEGER NOT NULL DEFAULT 0,
  bearish_count INTEGER NOT NULL DEFAULT 0,
  neutral_count INTEGER NOT NULL DEFAULT 0,
  top_keywords JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, subreddit)
);

ALTER TABLE sentiment_snapshots DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_date ON sentiment_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_sub_date ON sentiment_snapshots(subreddit, date DESC);

-- ── RPC: sentiment_summary ──
-- Returns trend, keywords, and overview for a date range + subreddit filter
CREATE OR REPLACE FUNCTION sentiment_summary(
  p_days INTEGER DEFAULT 30,
  p_subreddit TEXT DEFAULT 'all'
)
RETURNS JSON AS $$
  SELECT json_build_object(
    'trend', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT date, avg_sentiment, post_count, comment_count
        FROM sentiment_snapshots
        WHERE date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
          AND subreddit = p_subreddit
        ORDER BY date ASC
      ) t
    ),
    'keywords', (
      SELECT COALESCE(json_agg(row_to_json(k)), '[]'::json) FROM (
        SELECT word, SUM(cnt)::INTEGER as count FROM (
          SELECT
            kw->>'word' as word,
            (kw->>'count')::INTEGER as cnt
          FROM sentiment_snapshots,
               jsonb_array_elements(top_keywords) as kw
          WHERE date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
            AND subreddit = p_subreddit
        ) sub
        GROUP BY word
        ORDER BY count DESC
        LIMIT 20
      ) k
    ),
    'overview', (
      SELECT json_build_object(
        'avg_sentiment', COALESCE(ROUND(AVG(avg_sentiment)::NUMERIC, 3), 0),
        'total_posts', COALESCE(SUM(post_count), 0),
        'total_comments', COALESCE(SUM(comment_count), 0),
        'bullish_pct', CASE WHEN SUM(bullish_count + bearish_count + neutral_count) > 0
          THEN ROUND((SUM(bullish_count)::NUMERIC / SUM(bullish_count + bearish_count + neutral_count) * 100), 1)
          ELSE 0 END,
        'bearish_pct', CASE WHEN SUM(bullish_count + bearish_count + neutral_count) > 0
          THEN ROUND((SUM(bearish_count)::NUMERIC / SUM(bullish_count + bearish_count + neutral_count) * 100), 1)
          ELSE 0 END,
        'neutral_pct', CASE WHEN SUM(bullish_count + bearish_count + neutral_count) > 0
          THEN ROUND((SUM(neutral_count)::NUMERIC / SUM(bullish_count + bearish_count + neutral_count) * 100), 1)
          ELSE 0 END
      )
      FROM sentiment_snapshots
      WHERE date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
        AND subreddit = p_subreddit
    )
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- ── RPC: rebuild_sentiment_snapshots ──
-- Recomputes snapshots from raw reddit_posts for a date range
CREATE OR REPLACE FUNCTION rebuild_sentiment_snapshots(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS VOID AS $$
BEGIN
  -- Delete existing snapshots in range
  DELETE FROM sentiment_snapshots
  WHERE date >= p_start_date AND date <= p_end_date;

  -- Insert per-subreddit snapshots
  INSERT INTO sentiment_snapshots (date, subreddit, avg_sentiment, post_count, comment_count, bullish_count, bearish_count, neutral_count, top_keywords)
  SELECT
    posted_at::date as date,
    subreddit,
    AVG(sentiment_score),
    COUNT(*) FILTER (WHERE post_type = 'post'),
    COUNT(*) FILTER (WHERE post_type = 'comment'),
    COUNT(*) FILTER (WHERE sentiment_label = 'bullish'),
    COUNT(*) FILTER (WHERE sentiment_label = 'bearish'),
    COUNT(*) FILTER (WHERE sentiment_label = 'neutral'),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('word', word, 'count', cnt) ORDER BY cnt DESC)
       FROM (
         SELECT unnest(rp2.keywords) as word, COUNT(*) as cnt
         FROM reddit_posts rp2
         WHERE rp2.posted_at::date = rp.posted_at::date AND rp2.subreddit = rp.subreddit
         GROUP BY word ORDER BY cnt DESC LIMIT 10
       ) kw),
      '[]'::jsonb
    )
  FROM reddit_posts rp
  WHERE posted_at::date >= p_start_date AND posted_at::date <= p_end_date
  GROUP BY posted_at::date, subreddit;

  -- Insert 'all' combined snapshots
  INSERT INTO sentiment_snapshots (date, subreddit, avg_sentiment, post_count, comment_count, bullish_count, bearish_count, neutral_count, top_keywords)
  SELECT
    posted_at::date as date,
    'all',
    AVG(sentiment_score),
    COUNT(*) FILTER (WHERE post_type = 'post'),
    COUNT(*) FILTER (WHERE post_type = 'comment'),
    COUNT(*) FILTER (WHERE sentiment_label = 'bullish'),
    COUNT(*) FILTER (WHERE sentiment_label = 'bearish'),
    COUNT(*) FILTER (WHERE sentiment_label = 'neutral'),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('word', word, 'count', cnt) ORDER BY cnt DESC)
       FROM (
         SELECT unnest(rp2.keywords) as word, COUNT(*) as cnt
         FROM reddit_posts rp2
         WHERE rp2.posted_at::date = rp.posted_at::date
         GROUP BY word ORDER BY cnt DESC LIMIT 10
       ) kw),
      '[]'::jsonb
    )
  FROM reddit_posts rp
  WHERE posted_at::date >= p_start_date AND posted_at::date <= p_end_date
  GROUP BY posted_at::date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
