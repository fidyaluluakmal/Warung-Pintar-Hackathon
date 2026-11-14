-- Warung Pintar — RLS per pemilik warung (v1, ditulis saat hackathon)
--
-- Satu akun = satu warung. Setiap baris punya `owner_id` (= auth.users.id).
-- Row Level Security membuat database yang hanya bisa dibaca pemiliknya,
-- bukan dengan filter di frontend.
--
---view `stok_barang` dan `penjualan_harian` memakai `security_invoker = true`,
-- jadi policy tabel di bawah ini juga berlaku untuk view.

alter table public.barang enable row level security;
alter table public.alias_barang enable row level security;
alter table public.transaksi enable row level security;
alter table public.baris_transaksi enable row level security;
alter table public.nota_belanja enable row level security;

drop policy if exists "own barang access" on public.barang;
create policy "own barang access"
  on public.barang
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "own alias access" on public.alias_barang;
create policy "own alias access"
  on public.alias_barang
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "own transaksi access" on public.transaksi;
create policy "own transaksi access"
  on public.transaksi
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "own baris access" on public.baris_transaksi;
create policy "own baris access"
  on public.baris_transaksi
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "own nota access" on public.nota_belanja;
create policy "own nota access"
  on public.nota_belanja
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
