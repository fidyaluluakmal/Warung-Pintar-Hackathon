-- Warung Pintar — data contoh untuk Buku Pelanggan dan Harga Pasar (v1)
--
-- Dua tabel ini butuh data supaya bisa didemokan: pelanggan yang punya
-- riwayat belanja, dan catatan harga barang di tempat lain.
--
-- Pelanggan dihubungkan ke penjualan lewat nama yang disebut di `teks_mentah`
-- (kalimat suara atau nota). Jadi data penjualan perlu menyebut nama itu.

do $$
declare
  demo_owner uuid;
begin
  select id into demo_owner from auth.users where email = 'demo@warungpintar.app';
  if demo_owner is null then
    raise notice 'Akun demo belum ada. Seed dilewati.';
    return;
  end if;

  delete from public.harga_pasar where owner_id = demo_owner;
  delete from public.pelanggan where owner_id = demo_owner;

  -- ---------------------------------------------------------------------------
  -- 1. Pelanggan
  -- ---------------------------------------------------------------------------
  insert into public.pelanggan (owner_id, nama, telepon, catatan)
  values
    (demo_owner, 'Pak Yono',  '0812-3456-7890', 'Langganan tetap, beli barang bulanan saja'),
    (demo_owner, 'Bu Sri',    null,              'Sering beli kopi sachet'),
    (demo_owner, 'Mas Togo',  null,              'Datang sore, suka barang segar'),
    (demo_owner, 'Pak Hadi',  '0813-9876-5432', 'Pembayaran sering tempo'),
    (demo_owner, 'Bu Ratna',  null,              'Warung sebelah');

  -- ---------------------------------------------------------------------------
  -- 2. Harga di tempat lain
  --
  -- Untuk tiga barang, dicatat harga yang DI LUAR lebih murah dari modal.
  -- Kalau di luar lebih murah, pemilik punya alasan buat kulakan ke sana.
  -- ---------------------------------------------------------------------------
  insert into public.harga_pasar (owner_id, barang_id, harga, tempat, tanggal)
  select demo_owner, b.id, m.harga, m.tempat, now() - make_interval(days => m.hari_lalu)
  from public.barang b
  join (values
    ('Beras Premium',  14500::numeric, 'Agen Beras Makmur',  2),
    ('Minyak Goreng',  15500,          'Pasar Bun',          1),
    ('Gula Pasir',     16500,          'Toko Sembako Jaya',  5),
    ('Telur Ayam',     30500,          'Agen Telur Pak Adi', 3),
    ('Mi Instan',       2800,          'Warung Tetangga',    8)
  ) as m(nama, harga, tempat, hari_lalu) on m.nama = b.nama
  where b.owner_id = demo_owner;
end $$;
