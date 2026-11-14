-- Warung Pintar — Asisten warung: sesi, pesan, dan proyek (v1)
--
-- Sebelumnya sesi asisten disimpan hanya di localStorage, jadi hilang
-- begitu pindah perangkat atau masuk dari HP. Sekarang sesi ikut database,
-- sama seperti transaksi dan utang: satu warung = satu riwayat.
--
-- Tiga tabel:
--   1. sesi_asisten  - satu percakapan.
--   2. pesan_asisten - satu pesan di dalam percakapan.
--   3. proyek        - kelompok percakapan + instruksi yang berlaku untuk
--                      semua chat di dalamnya (ala "Proyek" ChatGPT).
--
-- Satu akun = satu warung: `owner_id` = auth.uid().

-- ---------------------------------------------------------------------------
-- 1. Proyek
-- ---------------------------------------------------------------------------
create table if not exists public.proyek (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  nama text not null check (char_length(nama) between 1 and 80),
  -- Instruksi yang selalu ikut ke setiap pertanyaan di proyek ini.
  instruksi text,
  dibuat_pada timestamptz not null default now()
);

create index if not exists proyek_owner_idx
  on public.proyek (owner_id, dibuat_pada desc);

comment on table public.proyek is
  'Proyek asisten warung: kelompok percakapan dengan instruksi bersama.';

-- ---------------------------------------------------------------------------
-- 2. Sesi percakapan
-- ---------------------------------------------------------------------------
create table if not exists public.sesi_asisten (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  judul text not null default 'Sesi baru' check (char_length(judul) between 1 and 120),
  -- Proyek tempat sesi ini tinggal. Null = sesi tanpa proyek.
  proyek_id uuid references public.proyek (id) on delete set null,
  dibuat_pada timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now()
);

create index if not exists sesi_asisten_owner_idx
  on public.sesi_asisten (owner_id, diperbarui_pada desc);

create index if not exists sesi_asisten_proyek_idx
  on public.sesi_asisten (proyek_id);

comment on table public.sesi_asisten is
  'Satu percakapan dengan asisten warung.';

-- ---------------------------------------------------------------------------
-- 3. Pesan
-- ---------------------------------------------------------------------------
create table if not exists public.pesan_asisten (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  sesi_id uuid not null references public.sesi_asisten (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  teks text not null,
  dibuat_pada timestamptz not null default now()
);

create index if not exists pesan_asisten_sesi_idx
  on public.pesan_asisten (sesi_id, dibuat_pada);

comment on table public.pesan_asisten is
  'Satu pesan dalam percakapan dengan asisten warung.';

-- ---------------------------------------------------------------------------
-- RLS: satu akun = satu warung.
-- ---------------------------------------------------------------------------
alter table public.proyek enable row level security;
alter table public.sesi_asisten enable row level security;
alter table public.pesan_asisten enable row level security;

drop policy if exists "own proyek access" on public.proyek;
create policy "own proyek access"
  on public.proyek
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "own sesi access" on public.sesi_asisten;
create policy "own sesi access"
  on public.sesi_asisten
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "own pesan access" on public.pesan_asisten;
create policy "own pesan access"
  on public.pesan_asisten
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
