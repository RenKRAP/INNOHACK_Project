-- Supabase > SQL Editor 에 붙여 넣고 Run (팀 서비스에 맞게 수정)
CREATE TABLE IF NOT EXISTS viewpoints (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  lat     NUMERIC(9,6) NOT NULL,
  lon     NUMERIC(9,6) NOT NULL,
  elev_m  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS forecasts (
  id            BIGSERIAL PRIMARY KEY,
  viewpoint_id  TEXT NOT NULL REFERENCES viewpoints(id),
  valid_time    TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('ABOVE','EDGE','INSIDE','NO_FOG')),
  fog_top_m     INTEGER,
  fog_prob      NUMERIC(4,3),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (viewpoint_id, valid_time)
);

INSERT INTO viewpoints (id, name, lat, lon, elev_m) VALUES
  ('haeundae_beach', '해운대 해수욕장', 35.1587, 129.1604, 3),
  ('hwangryeongsan', '황령산 정상',     35.1572, 129.0822, 427),
  ('jangsan',        '장산 정상',       35.1950, 129.1770, 634)
ON CONFLICT (id) DO NOTHING;

-- 서버(Node)에서 DB에 직접 접속하므로 RLS는 켜 두고 공개 API 접근은 막아 둔다
ALTER TABLE viewpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts  ENABLE ROW LEVEL SECURITY;
