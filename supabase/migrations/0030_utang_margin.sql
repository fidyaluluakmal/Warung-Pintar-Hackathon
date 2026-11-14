-- Warung Pintar — Simpen Dulu (utang) dan Penjaga Margin (v1, ditulis saat hackathon)
--
-- Dua fitur pembeda yang hanya masuk akal untuk warung kecil:
--
--   1. SIMPEN DULU — pelanggan Buying sebagian, sisanya ngutang. Stok tetap
--      turun untuk seluruh barang yang keluar, tidak hanya yang dibayar.
--
--   2. PENJAGA MARGIN — harga modal naik diam-diam, margin menyusut.
--      Aplikasi menyimpan riwayat harga modal supaya bisa dibandingkan.
--
-- Nomor migration 0030 (bukan 0022) supaya tidak bentrok dengan riwayat
-- migrasi lain di database yang sama.

-- ---------------------------------------------------------------------------
-- 1. Utang pelanggan ("simpen dulu")
-- ---------------------------------------------------------------------------
create table if not exists public.utang (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  pelanggan text not null,
  barang_id uuid not null references public.barang (id) on delete restrict,
  qty numeric(12, 2) not null check (qty > 0),
  satuan text not null default 'pcs',
  harga_satuan numeric(14, 2) not null default 0 check (harga_satuan >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  tanggal timestamptz not null default now(),
  status text not null default 'belum_lunas' check (status in ('belum_lunas', 'lunas')),
  dibayar numeric(14, 2) not null default 0 check (dibayar >= 0),
  lunas_pada timestamptz,
  dibuat_pada timestamptz not null default now()
);

create index if not exists utang_owner_status_idx
  on public.utang (owner_id, status, tanggal desc);

create index if not exists utang_owner_pelanggan_idx
  on public.utang (owner_id, pelanggan);

comment on table public.utang is
  'Utang pelanggan dari penjualan "simpen dulu". Satu baris = satu barang yang diutangkan.';

-- ---------------------------------------------------------------------------
-- 2. Riwayat harga modal
--
-- Disimpan setiap kali ada pembelian dengan harga modal. Ini yang membuat
-- "modal naik" bisa dibandingkan, bukan cuma angka sekarang.
-- ---------------------------------------------------------------------------
create table if not exists public.harga_modal_riwayat (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  barang_id uuid not null references public.barang (id) on delete cascade,
  harga_modal numeric(14, 2) not null check (harga_modal >= 0),
  tanggal timestamptz not null default now()
);

create index if not exists harga_modal_riwayat_barang_idx
  on public.harga_modal_riwayat (barang_id, tanggal desc);

create index if not exists harga_modal_riwayat_owner_idx
  on public.harga_modal_riwayat (owner_id, tanggal desc);

comment on table public.harga_modal_riwayat is
  'Riwayat harga modal per barang. Dipakai untuk mendeteksi margin yang menyusut.';

-- ---------------------------------------------------------------------------
-- 3. View: margin per barang
--
-- margin % = (harga_jual - harga_modal) / harga_jual
--
-- "modal_sebelumnya" = harga modal pada pembelian sebelumnya (paling awal
-- pada periode 90 hari terakhir). Kalau tidak ada pembelian sebelumnya,
-- sama dengan harga modal sekarang.
-- ---------------------------------------------------------------------------
drop view if exists public.margin_barang;
create view public.margin_barang
with (security_invoker = true) as
select
  b.id as barang_id,
  b.owner_id,
  b.nama,
  b.satuan,
  b.harga_jual,
  b.harga_modal,
  coalesce(
    (
      select h.harga_modal
      from public.harga_modal_riwayat h
      where h.barang_id = b.id
        and h.harga_modal <> b.harga_modal
        and h.tanggal >= now() - interval '120 days'
      order by h.tanggal desc
      limit 1
    ),
    b.harga_modal
  ) as modal_sebelumnya,
  case
    when b.harga_jual > 0
    then round(((b.harga_jual - b.harga_modal) / b.harga_jual) * 100, 2)
    else 0
  end as margin_persen
from public.barang b;

comment on view public.margin_barang is
  'Margin per barang. Dibandingkan dengan harga modal sebelumnya untuk melihat penyusutan.';

-- ---------------------------------------------------------------------------
-- 4. View: utang yang masih berjalan
-- ---------------------------------------------------------------------------
drop view if exists public.utang_berjalan;
create view public.utang_berjalan
with (security_invoker = true) as
select
  u.id,
  u.owner_id,
  u.pelanggan,
  u.barang_id,
  b.nama as nama_barang,
  u.qty,
  u.satuan,
  u.harga_satuan,
  u.total,
  u.dibayar,
  u.status,
  u.tanggal,
  greatest(u.total - u.dibayar, 0) as sisa
from public.utang u
join public.barang b on b.id = u.barang_id
where u.status = 'belum_lunas';

comment on view public.utang_berjalan is
  'Utang yang belum lunas, lengkap dengan sisa yang harus dibayar.';
