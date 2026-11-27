# 해커톤 서버 미리 열어 두기 (Supabase PostgreSQL + Render Node.js)

## A. 내가 지금 할 일

### 1) Supabase (DB)
1. supabase.com → GitHub로 로그인 → **New project**
   - Region: **Northeast Asia (Seoul)**
   - Database Password: 강하게 만들고 따로 보관 (팀원과 공유할 값)
2. 왼쪽 **SQL Editor** → `schema.sql` 붙여 넣기 → Run
3. 위쪽 **Connect** 버튼 → 연결 주소 두 개를 복사해 둔다
   - **Transaction pooler** (포트 6543): 서버용
   - **Session pooler** (포트 5432): 로컬 개발·DB 툴용
   - Direct connection은 IPv6 전용이라 집·학교 와이파이나 일부 호스팅에서 안 될 수 있음 → 쓰지 않기

### 2) Render (서버)
1. 이 폴더를 GitHub 저장소로 올린다 (`.env`는 올라가지 않음)
2. render.com → GitHub 로그인 → **New + → Web Service** → 저장소 선택
   - Build Command: `npm install` / Start Command: `npm start` / Instance: Free
3. **Environment** → `DATABASE_URL` = Transaction pooler 주소 (비밀번호 채워서)
4. 배포가 끝나면 `https://xxxx.onrender.com/health` 에서 `"db": "연결됨 ..."` 확인

## B. 팀원에게 권한 주기
- **Supabase**: 조직(Organization) 설정 → Team → Invite → 역할 **Administrator**
  (Developer는 데이터는 다룰 수 있지만 프로젝트 설정은 못 바꿈. 초대 링크는 24시간 유효)
- **Render**: Workspace 설정 → Members → Invite

## C. 팀원 노트북에서
```bash
cp .env.example .env      # Windows: copy .env.example .env
# .env 의 DATABASE_URL 에 Session pooler 주소 붙여 넣기
npm install
npm run dev               # http://localhost:3000/health
```
- DB 툴(DBeaver, pgAdmin, TablePlus): Session pooler 주소의 호스트/포트/사용자(postgres.프로젝트REF)/비밀번호 입력, SSL 사용
- 배포: GitHub에 푸시하면 Render가 자동 배포

## 주의
- Supabase 무료 프로젝트는 일주일 동안 활동이 적으면 일시정지됩니다. 대시보드에서 Resume으로 복구 가능.
  해커톤 전날 `/health`를 한 번 열어 두세요.
- Render 무료 서버는 15분 동안 요청이 없으면 잠들고, 다음 요청 때 깨어나느라 첫 응답이 늦습니다.
  발표 직전에 `/health`를 미리 한 번 열어 두세요.
- `.env`와 DB 비밀번호는 커밋하지 마세요.
