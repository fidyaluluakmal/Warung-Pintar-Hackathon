-- Warung Pintar — data contoh untuk Simpen Dulu dan Penjaga Margin (v1)
--
-- Dua hal yang perlu ada supaya kedua fiturnya bisa didemokan:
--
--   1. Riwayat harga modal yang naik untuk beberapa barang, supaya
--      "margin menyusut" punya bukti, bukan sekadar cerita.
--   2. Utang pelanggan yang belum lunas, supaya buku utang bisa dibaca.
--
-- Cara pakai: sama seperti seed.sql — tempel di Supabase SQL Editor.

do $$
declare
  demo_owner uuid;
  v_barang uuid;
begin
  select id into demo_owner from auth.users where email = 'demo@warungpintar.app';
  if demo_owner is null then
    raise notice 'Akun demo belum ada. Seed dilewati.';
    return;
  end if;

  delete from public.harga_modal_riwayat where owner_id = demo_owner;
  delete from public.utang where owner_id = demo_owner;

  -- ---------------------------------------------------------------------------
  -- 1. Riwayat harga modal.
  --
  -- Untuk semua barang, catat harga modal yang dipakai di pembelian 90 hari
  -- lalu. Lalu untuk tiga barang, tambahkan satu pembelian lebih baru dengan
  -- harga modal naik — itu yang memicu sinyal margin.
  -- ---------------------------------------------------------------------------
  -- Harga modal awal (hard-coded) supaya seed ini idempoten: dijalankan
  -- berkali-kali, hasilnya sama.
  insert into public.harga_modal_riwayat (owner_id, barang_id, harga_modal, tanggal)
  select
    demo_owner,
    b.id,
    m.harga_awal,
    now() - interval '90 days'
  from public.barang b
  join (values
    ('Beras Premium',  14000::numeric),
    ('Gula Pasir',     17000),
    ('Minyak Goreng',  15000),
    ('Telur Ayam',     28000),
    ('Mi Instan',       3000),
    ('Kopi Sachet',     1200),
    ('Susu UHT',        5000),
    ('Air Mineral',     2500),
    ('Rokok Kretek',   22000),
    ('Sabun Mandi',     4500),
    ('Sarden',          6000),
    ('Pisang',         12000)
  ) as m(nama, harga_awal) on m.nama = b.nama
  where b.owner_id = demo_owner;

  -- Reset harga modal ke nilai awal, supaya seed bisa dijalankan berulang.
  update public.barang b
  set harga_modal = m.harga_awal
  from (values
    ('Beras Premium',  14000::numeric),
    ('Gula Pasir',     17000),
    ('Minyak Goreng',  15000),
    ('Telur Ayam',     28000),
    ('Mi Instan',       3000),
    ('Kopi Sachet',     1200),
    ('Susu UHT',        5000),
    ('Air Mineral',     2500),
    ('Rokok Kretek',   22000),
    ('Sabun Mandi',     4500),
    ('Sarden',          6000),
    ('Pisang',         12000)
  ) as m(nama, harga_awal)
  where b.owner_id = demo_owner and m.nama = b.nama;

  -- Tiga barang yang modalnya naik diam-diam.
  --
  -- Riwayat menyimpan harga modal LAMA. Harga modal yang SEKARANG ada di
  -- `barang.harga_modal`, dan diupdate di bawah. Jadi view `margin_barang`
  -- bisa membandingkan "modal dulu" vs "modal sekarang".
  update public.barang
  set harga_modal = round(harga_modal * 1.12, 2)
  where owner_id = demo_owner and nama = 'Telur Ayam';

  update public.barang
  set harga_modal = round(harga_modal * 1.08, 2)
  where owner_id = demo_owner and nama = 'Minyak Goreng';

  update public.barang
  set harga_modal = round(harga_modal * 1.08, 2)
  where owner_id = demo_owner and nama = 'Beras Premium';

  -- ---------------------------------------------------------------------------
  -- 2. Utang pelanggan ("simpen dulu").
  --
  -- Pelanggan warung Paylater: nama panggilan, tanpa nomor telepon.
  -- Sebagian sudah dibayar sebagian, sebagian masih utuh.
  -- ---------------------------------------------------------------------------
  insert into public.utang
    (owner_id, pelanggan, barang_id, qty, satuan, harga_satuan, total, tanggal, status, dibayar)
  select
    demo_owner,
    u.pelanggan,
    b.id,
    u.qty,
    b.satuan,
    b.harga_jual,
    round(u.qty * b.harga_jual, 2),
    now() - make_interval(days => u.hari_lalu),
    'belum_lunas',
    u.dibayar
  from (values
    ('Pak Yono',  'Telur Ayam',    5,  12, 20_000::numeric),
    ('Pak Yono',  'Mi Instan',    3,   5,  0::numeric),
    ('Bu Sri',    'Kopi Sachet',  10,   8,  0::numeric),
    ('Mas Togo',  'Pisang',       4,   6, 15_000::numeric),
    ('Pak Yono',  'Rokok Kretek', 2,  15,  0::numeric)
  ) as u(pelanggan, nama_barang, qty, hari_lalu, dibayar)
  join public.barang b on b.nama = u.nama_barang and b.owner_id = demo_owner;
end $$;
