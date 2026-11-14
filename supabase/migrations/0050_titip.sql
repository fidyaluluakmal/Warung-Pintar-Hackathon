-- Warung Pintar — Titip Jual (konsinyasi) (v1, ditulis saat hackathon)
--
-- Warung kecil sering dititipi barang milik orang lain: keripik tetangga,
-- wajik buat acara warga, kue lapis Vendor. Warung jadi etalase, tapi
-- barangnya bukan milik warung.
--
-- Karena itu barang titipan TIDAK masuk hitungan stok warung sendiri. Yang
-- dicatat cuma dua angka: komisi warung, dan bagian yang harus dibayar ke
-- pemilik barang. Stok warung tetap milik warung, laba warung tetap bersih.
--
-- Satu akun = satu warung: `owner_id` = auth.uid(), sama seperti tabel lain.

create table if not exists public.titip (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  -- Nama yang menitipkan barang. Warung sering cuma tahu nama panggilan.
  pemilik text not null,
  nama_barang text not null,
  satuan text not null default 'pcs',
  -- Berapa yang dititipkan.
  qty numeric(12, 2) not null check (qty > 0),
  -- Berapa yang sudah laku. Tidak boleh melebihi qty.
  terjual numeric(12, 2) not null default 0 check (terjual >= 0 and terjual <= qty),
  -- Harga dari pemilik barang (informasi, untuk tahu untung warung).
  harga_pemilik numeric(14, 2) not null default 0 check (harga_pemilik >= 0),
  -- Harga jual ke pelanggan.
  harga_jual numeric(14, 2) not null default 0 check (harga_jual >= 0),
  -- Komisi warung dalam persen dari omzet.
  komisi_persen numeric(6, 2) not null default 10
    check (komisi_persen >= 0 and komisi_persen <= 100),
  status text not null default 'aktif' check (status in ('aktif', 'selesai')),
  catatan text,
  dibuat_pada timestamptz not null default now(),
  selesai_pada timestamptz
);

create index if not exists titip_owner_status_idx
  on public.titip (owner_id, status, dibuat_pada desc);

comment on table public.titip is
  'Barang titipan (konsinyasi). Barang milik orang lain yang dijual warung; yang dihitung komisi warung dan bagian untuk pemilik barang.';

-- ---------------------------------------------------------------------------
-- View: titipan yang masih jalan
-- ---------------------------------------------------------------------------
drop view if exists public.titip_aktif;
create view public.titip_aktif
with (security_invoker = true) as
select
  t.id,
  t.owner_id,
  t.pemilik,
  t.nama_barang,
  t.satuan,
  t.qty,
  t.terjual,
  greatest(t.qty - t.terjual, 0) as sisa,
  t.harga_pemilik,
  t.harga_jual,
  t.komisi_persen,
  t.status,
  t.catatan,
  t.dibuat_pada,
  t.selesai_pada,
  t.terjual * t.harga_jual as omzet,
  round(t.terjual * t.harga_jual * (t.komisi_persen / 100)) as komisi,
  round(t.terjual * t.harga_jual * (1 - t.komisi_persen / 100)) as bagian_pemilik
from public.titip t
where t.status = 'aktif';

comment on view public.titip_aktif is
  'Titipan yang masih jalan, lengkap dengan omzet, komisi warung, dan bagian untuk pemilik barang.';

-- ---------------------------------------------------------------------------
-- RLS: satu akun = satu warung.
-- ---------------------------------------------------------------------------
alter table public.titip enable row level security;

drop policy if exists "own titip access" on public.titip;
create policy "own titip access"
  on public.titip
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
