-- Warung Pintar — Harga Pasar (v1, ditulis saat hackathon)
--
-- Warung kecil belanja sambil banding-banding: "di tempat lain beras 15
-- ribu, di sini 14 ribu". Catatan seperti itu biasanya cuma ingatan di
-- kepala, lalu hilang. Di sini dicatat, lalu dibandingkan dengan modal
-- sendiri, lalu jadi saran harga jual.
--
-- Satu baris = satu catatan harga yang dilihat di tempat lain (toko, agen,
-- pasar). Satu barang boleh punya banyak catatan, jadi pemilik bisa melihat
-- apakah harga di luar sudah naik atau turun.
--
-- Satu akun = satu warung: `owner_id` = auth.uid().

create table if not exists public.harga_pasar (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  barang_id uuid not null references public.barang (id) on delete cascade,
  harga numeric(14, 2) not null check (harga >= 0),
  tempat text,
  tanggal timestamptz not null default now(),
  dibuat_pada timestamptz not null default now()
);

create index if not exists harga_pasar_barang_idx on public.harga_pasar (barang_id, tanggal desc);
create index if not exists harga_pasar_owner_idx on public.harga_pasar (owner_id, tanggal desc);

comment on table public.harga_pasar is
  'Harga barang yang sama di toko atau agen lain. Dipakai pemilik warung untuk membandingkan dengan modal sendiri lalu menentukan harga jual.';

-- RLS: satu akun = satu warung. Pemisahan antar warung dijamin database,
-- bukan filter di frontend.
alter table public.harga_pasar enable row level security;
drop policy if exists "own harga pasar access" on public.harga_pasar;
create policy "own harga pasar access" on public.harga_pasar for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
