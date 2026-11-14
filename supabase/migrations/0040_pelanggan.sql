-- Warung Pintar — Buku pelanggan (v1, ditulis saat hackathon)
--
-- Bedanya dengan kasir minimarket: warung tidak perlu kartu member, barcode,
-- atau nomor telepon. Pelanggan warung banyak yang cuma punya nama panggilan:
-- "Pak Yono".
--
-- Karena itu tabel ini menjadikan NAMA PANGGILAN sebagai identitas utama.
-- Nomor telepon dan catatan hanya pelengkap — boleh dikosongkan.

create table if not exists public.pelanggan (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  nama text not null,
  telepon text,
  catatan text,
  dibuat_pada timestamptz not null default now()
);

-- Satu pemilik warung tidak boleh punya dua pelanggan dengan nama sama.
-- Huruf besar-kecil tidak dianggap beda: "pak yono" = "Pak Yono".
create unique index if not exists pelanggan_nama_per_pemilik_idx
  on public.pelanggan (lower(nama), owner_id);

create index if not exists pelanggan_owner_id_idx on public.pelanggan (owner_id);

comment on table public.pelanggan is
  'Buku pelanggan warung. Pelanggan sering tidak punya nomor telepon, hanya nama panggilan (mis. "Pak Yono"), jadi nama adalah identitas utamanya dan nomor telepon opsional.';

-- ---------------------------------------------------------------------------
-- RLS: satu akun = satu warung. Sama seperti tabel lain di repo ini.
-- ---------------------------------------------------------------------------
alter table public.pelanggan enable row level security;

drop policy if exists "own pelanggan access" on public.pelanggan;
create policy "own pelanggan access"
  on public.pelanggan
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
