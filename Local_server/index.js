// 해커톤용 서버 뼈대 (Node.js + Supabase PostgreSQL)
// DATABASE_URL: Supabase > Connect 에서 복사한 Pooler 주소 (IPv4 지원)
//   - 서버(Render 등): Transaction pooler (포트 6543)
//   - 로컬 개발·DB 툴: Session pooler (포트 5432)
import "dotenv/config";
import express from "express";
import pg from "pg";

const app = express();
app.use(express.json());

const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },   // Supabase는 SSL 연결 필요
      max: 5,
    })
  : null;

// 서버가 살아 있는지 + DB 연결 확인
app.get("/health", async (_req, res) => {
  let db = "DATABASE_URL 없음";
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT now() AS now");
      db = `연결됨 (${rows[0].now.toISOString()})`;
    } catch (e) {
      db = `연결 실패: ${e.code || e.message}`;
    }
  }
  res.json({ ok: true, db });
});

app.get("/", (_req, res) => res.send("서버 실행 중 · /health 에서 DB 연결 확인"));

// 예시 API: 전망 지점 목록
app.get("/api/viewpoints", async (_req, res) => {
  if (!pool) return res.status(500).json({ error: "DB 미연결" });
  try {
    const { rows } = await pool.query("SELECT * FROM viewpoints ORDER BY elev_m");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// TODO: 팀원 코드의 API 라우트를 여기에 추가

const PORT = process.env.PORT || 3000;   // Render가 PORT를 자동으로 넣어 줌
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
