-- Warung Pintar — RLS untuk fitur Simpen Dulu dan Penjaga Margin (v1)
--
-- Satu akun = satu warung. Sama seperti tabel inti: `owner_id` = auth.uid().

alter table public.utang enable row level security;
alter table public.harga_modal_riwayat enable row level security;

drop policy if exists "own utang access" on public.utang;
create policy "own utang access"
  on public.utang
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "own harga modal access" on public.harga_modal_riwayat;
create policy "own harga modal access"
  on public.harga_modal_riwayat
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
