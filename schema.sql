-- =============================================
-- Supabase テーブル作成 SQL
-- Supabase ダッシュボード > SQL Editor で実行
-- =============================================

-- タスクテーブル
create table tasks (
  id         text primary key,
  name       text not null,
  start_date date not null,
  end_date   date not null,
  progress   integer default 0,
  status     text default '待ち',
  color      text default '#4A90D9',
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- メモテーブル
create table task_notes (
  task_id text primary key references tasks(id) on delete cascade,
  content text default ''
);

-- 工数テーブル
create table task_hours (
  id      serial primary key,
  task_id text references tasks(id) on delete cascade,
  date    date not null,
  hours   numeric(4,1) default 0,
  unique(task_id, date)
);

-- =============================================
-- RLS (Row Level Security) を無効化 (個人利用)
-- =============================================
alter table tasks      disable row level security;
alter table task_notes disable row level security;
alter table task_hours disable row level security;

-- もし RLS を有効にしたい場合は以下のポリシーを使用:
-- alter table tasks      enable row level security;
-- create policy "全ユーザーが読み書き可能" on tasks      for all using (true);
-- alter table task_notes enable row level security;
-- create policy "全ユーザーが読み書き可能" on task_notes for all using (true);
-- alter table task_hours enable row level security;
-- create policy "全ユーザーが読み書き可能" on task_hours for all using (true);
