-- Warung Pintar — skema inti (v1, ditulis saat hackathon)
--
-- Catatan versi: file ini sengaja bernomor 0020, bukan 0001. Database yang
-- dipakai sudah punya migrasi 0001–0013 dari versi sebelumnya, dan `db push`
-- menandai migrasi sebagai "sudah dipasang" berdasarkan nomor. Nomor baru
-- memastikan file ini benar-benar dijalankan.
--
-- Yang belum ada di sini dan menyusul: utang pelanggan, titip konsinyasi,
-- harga pasar, dan tutup buku. Skema inti cukup untuk satu alur yang matang:
-- suara + nota -> stok -> saran AI.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Barang: katalog warung. Satu baris = satu nama baku + satu satuan dasar.
-- ---------------------------------------------------------------------------
create table if not exists public.barang (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  nama text not null,
  satuan text not null default 'pcs',
  stok_awal numeric(12, 2) not null default 0 check (stok_awal >= 0),
  min_stok numeric(12, 2) not null default 0 check (min_stok >= 0),
  harga_modal numeric(14, 2) not null default 0 check (harga_modal >= 0),
  harga_jual numeric(14, 2) not null default 0 check (harga_jual >= 0),
  lead_time_hari integer not null default 1 check (lead_time_hari >= 0),
  dibuat_pada timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now()
);

create unique index if not exists barang_nama_per_pemilik_idx
  on public.barang (lower(nama), owner_id);

create index if not exists barang_owner_id_idx on public.barang (owner_id);

-- Alias: caraypedagang menyebut barang ("gulpas" = gula pasir).
-- Alias mencegah satu barang jadi dua baris dan stok jadi terpisah.
create table if not exists public.alias_barang (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  barang_id uuid not null references public.barang (id) on delete cascade,
  alias text not null,
  dibuat_pada timestamptz not null default now()
);

create unique index if not exists alias_barang_unik_per_pemilik_idx
  on public.alias_barang (lower(alias), owner_id);

create index if not exists alias_barang_barang_id_idx on public.alias_barang (barang_id);

-- ---------------------------------------------------------------------------
-- Transaksi: satu baris = satu peristiwa (jual / beli / sesuaikan).
-- Stok tidak disimpan di tabel barang. Stok dihitung dari mutasi transaksi,
-- jadi tidak mungkin melenceng dari history.
-- ---------------------------------------------------------------------------
create table if not exists public.transaksi (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  tipe text not null check (tipe in ('jual', 'beli', 'sesuaikan')),
  tanggal timestamptz not null default now(),
  sumber text not null default 'manual' check (sumber in ('suara', 'nota', 'manual')),
  teks_mentah text,
  total numeric(14, 2) not null default 0 check (total >= 0),
  agen text,
  dibuat_pada timestamptz not null default now()
);

create index if not exists transaksi_owner_tanggal_idx
  on public.transaksi (owner_id, tanggal desc);

create index if not exists transaksi_owner_tipe_idx
  on public.transaksi (owner_id, tipe);

-- Baris transaksi: barang apa, berapa, harga berapa.
create table if not exists public.baris_transaksi (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  transaksi_id uuid not null references public.transaksi (id) on delete cascade,
  barang_id uuid not null references public.barang (id) on delete restrict,
  jumlah numeric(12, 2) not null,
  satuan text not null default 'pcs',
  harga_satuan numeric(14, 2) not null default 0 check (harga_satuan >= 0)
);

create index if not exists baris_transaksi_transaksi_idx
  on public.baris_transaksi (transaksi_id);

create index if not exists baris_transaksi_barang_idx
  on public.baris_transaksi (barang_id);

-- Nota belanja: bukti pembelian. Foto disimpan di bucket Supabase Storage
-- (path dicatat di `foto_path`), isi notanya disimpan sebagai baris transaksi.
create table if not exists public.nota_belanja (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  transaksi_id uuid references public.transaksi (id) on delete set null,
  agen text,
  foto_path text,
  dibuat_pada timestamptz not null default now()
);

create index if not exists nota_belanja_owner_id_idx on public.nota_belanja (owner_id);

-- ---------------------------------------------------------------------------
-- updated_at otomatis
--
-- Nama fungsi sengaja dibuat unik per skema. Database ini dipakai bersama
-- dengan versi sebelumnya, jadi fungsi generik seperti `set_updated_at`
-- akan menimpa fungsi yang dipakai tabel lain.
-- ---------------------------------------------------------------------------
create or replace function public.set_barang_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.diperbarui_pada = now();
  return new;
end;
$$;

drop trigger if exists barang_set_updated_at on public.barang;
create trigger barang_set_updated_at
  before update on public.barang
  for each row
  execute function public.set_barang_updated_at();

-- ---------------------------------------------------------------------------
-- View: stok per barang.
--
-- Stok = stok awal + barang masuk - barang keluar.
-- Sesuaikan (tipe 'sesuaikan') menambah kalau jumlah positif, mengurangi kalau negatif.
-- ---------------------------------------------------------------------------
drop view if exists public.stok_barang;
create view public.stok_barang
with (security_invoker = true) as
select
  b.id as barang_id,
  b.owner_id,
  b.nama,
  b.satuan,
  b.min_stok,
  b.harga_modal,
  b.harga_jual,
  b.lead_time_hari,
  b.stok_awal,
  b.stok_awal
    + coalesce(sum(case when t.tipe = 'beli' then bt.jumlah else 0 end), 0)
    + coalesce(sum(case when t.tipe = 'sesuaikan' then bt.jumlah else 0 end), 0)
    - coalesce(sum(case when t.tipe = 'jual' then bt.jumlah else 0 end), 0) as stok
from public.barang b
left join public.baris_transaksi bt on bt.barang_id = b.id
left join public.transaksi t on t.id = bt.transaksi_id
group by b.id;

comment on view public.stok_barang is
  'Stok per barang: stok awal + masuk - keluar. Dipakai semua layar agar angkanya sama.';

-- ---------------------------------------------------------------------------
-- View: penjualan per hari.
-- ---------------------------------------------------------------------------
drop view if exists public.penjualan_harian;
create view public.penjualan_harian
with (security_invoker = true) as
select
  t.owner_id,
  (t.tanggal at time zone 'Asia/Jakarta')::date as hari,
  count(distinct t.id) as jumlah_transaksi,
  coalesce(sum(t.total), 0) as omzet
from public.transaksi t
where t.tipe = 'jual'
group by t.owner_id, (t.tanggal at time zone 'Asia/Jakarta')::date;

comment on view public.penjualan_harian is
  'Penjualan harian dalam zona waktu warung (Asia/Jakarta).';
