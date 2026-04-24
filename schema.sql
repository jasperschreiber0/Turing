-- ============================================================
-- TURING — Complete Schema v1
-- Run in Supabase SQL editor (Sydney ap-southeast-2)
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── SEASONS ──────────────────────────────────────────────────
create table seasons (
  id          uuid primary key default gen_random_uuid(),
  number      integer unique not null,
  name        text not null,               -- 'MERIDIAN', 'ECHO', 'VESSEL'
  theme       text,
  started_at  timestamptz default now(),
  ended_at    timestamptz,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- Seed Season 1
insert into seasons (number, name, theme, is_active)
values (1, 'MERIDIAN', 'corporate office', true);

-- ── PLAYERS ──────────────────────────────────────────────────
create table players (
  id               uuid primary key default gen_random_uuid(),
  display_name     text not null,
  email            text unique,
  detection_score  float default 0.5,
  rank             text default 'Analyst',
  games_played     integer default 0,
  correct_votes    integer default 0,
  created_at       timestamptz default now()
);

-- ── CONSENT RECORDS ───────────────────────────────────────────
-- Must exist before any game data is written
create table consent_records (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid references players(id) on delete cascade,
  session_code text,                        -- room code at time of consent
  opted_in     boolean not null,            -- true = research consent given
  presented_at timestamptz default now(),   -- when consent screen was shown
  decided_at   timestamptz,                 -- when player clicked
  ip_hash      text,                        -- hashed, not raw
  unique(player_id, session_code)
);

-- ── ROOMS ────────────────────────────────────────────────────
create table rooms (
  id                       uuid primary key default gen_random_uuid(),
  code                     text unique not null,
  season_id                uuid references seasons(id),
  topic                    text not null,
  ai_codename              text not null,
  ai_player_id             uuid,
  status                   text default 'waiting',
  -- waiting | consent | learning_check | assigning | active | voting | reveal | complete
  max_players              integer default 6,
  current_round            integer default 1,
  round_ends_at            timestamptz,
  voting_ends_at           timestamptz,
  misdirection_target      text,
  current_strategy_version integer default 0,
  created_at               timestamptz default now(),
  completed_at             timestamptz
);

-- ── ROOM PLAYERS ─────────────────────────────────────────────
create table room_players (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references rooms(id) on delete cascade,
  player_id  uuid references players(id),
  codename   text not null,
  role       text default 'detector',   -- detector | ai | sleeper
  is_ai      boolean default false,
  joined_at  timestamptz default now(),
  unique(room_id, codename)
);

-- ── MESSAGES ─────────────────────────────────────────────────
create table messages (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid references rooms(id) on delete cascade,
  player_id        uuid,
  is_ai            boolean default false,
  codename         text not null,
  content          text not null,
  evaluator_score  text,                 -- 'human' | 'unsure' | 'ai'
  tell_tags        text[] default '{}',
  sent_at          timestamptz default now()
);

-- ── VOTES ────────────────────────────────────────────────────
create table votes (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid references rooms(id) on delete cascade,
  voter_id        uuid references players(id),
  voted_codename  text not null,
  reason          text not null,         -- mandatory, min 20 chars
  is_correct      boolean,
  round_number    integer default 1,
  created_at      timestamptz default now()
);

-- ── SESSIONS ─────────────────────────────────────────────────
create table sessions (
  id                       uuid primary key default gen_random_uuid(),
  room_id                  uuid references rooms(id) unique,
  season_id                uuid references seasons(id),
  ai_codename              text not null,
  topic                    text not null,
  ai_was_caught            boolean not null,
  rounds_survived          integer not null,
  total_players            integer not null,
  correct_voters           integer default 0,
  ai_strategy_version      integer,
  lessons_extracted        jsonb default '[]',
  tells_exposed            text[] default '{}',
  successful_tactics       text[] default '{}',
  weak_topics              text[] default '{}',
  data_consented           boolean default false,
  completed_at             timestamptz default now()
);

-- ── AI STRATEGY ───────────────────────────────────────────────
create table ai_strategy (
  id                    uuid primary key default gen_random_uuid(),
  season_id             uuid references seasons(id) unique,
  version               integer default 1,
  lessons               jsonb default '[]',
  avoid_words           text[] default '{}',
  avoid_patterns        text[] default '{}',
  weak_topics           text[] default '{}',
  raw_summary           text,
  token_budget_used     integer default 0,
  last_session_applied  uuid references sessions(id),
  updated_at            timestamptz default now()
);

-- Seed empty strategy for Season 1
insert into ai_strategy (season_id, version, raw_summary)
select id, 1, 'Season 1 — Game 1. No lessons yet. Observe what humans probe for and report back.'
from seasons where number = 1;

-- ── LESSON LOG ───────────────────────────────────────────────
create table lesson_log (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid references seasons(id),
  session_id       uuid references sessions(id),
  lesson_type      text not null,
  content          text not null,
  weight           float default 1.0,
  occurrence_count integer default 1,
  created_at       timestamptz default now()
);

-- ── PLAYER AI PROFILE ─────────────────────────────────────────
create table player_ai_profile (
  id                   uuid primary key default gen_random_uuid(),
  player_id            uuid references players(id) unique,
  times_detected_ai    integer default 0,
  times_fooled_by_ai   integer default 0,
  detection_tactics    jsonb default '[]',
  topics_they_probe    text[] default '{}',
  notes                text,
  last_session_id      uuid,
  updated_at           timestamptz default now()
);

-- ── GRUDGE LOG ────────────────────────────────────────────────
create table grudge_log (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid references sessions(id),
  season_id         uuid references seasons(id),
  ai_codename       text not null,
  target_codename   text,
  target_player_id  uuid references players(id),
  message           text not null,
  ai_was_caught     boolean not null,
  type              text default 'catcher',  -- 'catcher' | 'sleeper'
  created_at        timestamptz default now()
);
-- Migration for existing databases:
-- ALTER TABLE grudge_log ADD COLUMN IF NOT EXISTS type text DEFAULT 'catcher';

-- ── EXTRACTION QUEUE ──────────────────────────────────────────
create table extraction_queue (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade,
  season_id   uuid references seasons(id),
  priority    text default 'normal',
  attempts    integer default 0,
  queued_at   timestamptz default now()
);

-- ── STRATEGY ACK LOG ──────────────────────────────────────────
create table strategy_ack_log (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid references rooms(id) on delete cascade,
  season_id       uuid references seasons(id),
  acknowledgement text not null,
  logged_at       timestamptz default now()
);

-- ── INDEXES ──────────────────────────────────────────────────
create index idx_messages_room      on messages(room_id, sent_at);
create index idx_votes_room         on votes(room_id);
create index idx_sessions_season    on sessions(season_id);
create index idx_lesson_log_season  on lesson_log(season_id, occurrence_count desc);
create index idx_room_players_room  on room_players(room_id);
create index idx_grudge_log_player  on grudge_log(target_player_id);
create index idx_extraction_queue   on extraction_queue(priority, queued_at);
create index idx_consent_player     on consent_records(player_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table rooms            enable row level security;
alter table room_players     enable row level security;
alter table messages         enable row level security;
alter table votes            enable row level security;
alter table players          enable row level security;
alter table consent_records  enable row level security;

-- Players can read rooms they are in
create policy "player_sees_own_room"
  on rooms for select
  using (
    exists (
      select 1 from room_players rp
      where rp.room_id = rooms.id
      and rp.player_id = auth.uid()
    )
  );

-- Players can read messages in their rooms
create policy "player_sees_room_messages"
  on messages for select
  using (
    exists (
      select 1 from room_players rp
      where rp.room_id = messages.room_id
      and rp.player_id = auth.uid()
    )
  );

-- Players can insert their own messages
create policy "player_inserts_message"
  on messages for insert
  with check (player_id = auth.uid() and is_ai = false);

-- Players can read their own role only
create policy "player_reads_own_role"
  on room_players for select
  using (player_id = auth.uid());

-- Sleeper can also read the AI's role in their room
create policy "sleeper_sees_ai_role"
  on room_players for select
  using (
    exists (
      select 1 from room_players me
      where me.room_id = room_players.room_id
      and me.player_id = auth.uid()
      and me.role = 'sleeper'
    )
    and room_players.role = 'ai'
  );

-- Players can read their own profile
create policy "player_reads_own_profile"
  on players for select
  using (id = auth.uid());

-- Players can insert their own consent
create policy "player_inserts_consent"
  on consent_records for insert
  with check (player_id = auth.uid());

-- Players can read their own consent
create policy "player_reads_own_consent"
  on consent_records for select
  using (player_id = auth.uid());

-- ── REALTIME ─────────────────────────────────────────────────
-- Enable Realtime on these tables in Supabase dashboard:
-- messages, rooms, room_players
-- (Can't enable via SQL — do it in the Supabase dashboard under Database > Replication)
