-- Warung Pintar — data contoh barang titipan (v1, ditulis saat hackathon)
--
-- Warung kecil sering jadi etalase barang tetangga: keripik, wajik, kue.
-- Barang titipan bukan milik warung, jadi TIDAK masuk hitungan stok warung.
-- Yang dicatat: komisi warung dan bagian yang harus dibayar ke pemilik barang.
--
-- Data ini disambung ke akun demo lewat `owner_id`. Kalau akun demo belum ada,
-- bagian ini dilewati.

do $$
declare
  demo_owner uuid;
begin
  select id into demo_owner from auth.users where email = 'demo@warungpintar.app';
  if demo_owner is null then
    raise notice 'Akun demo belum ada. Seed dilewati.';
    return;
  end if;

  delete from public.titip where owner_id = demo_owner;

  insert into public.titip
    (owner_id, pemilik, nama_barang, satuan, qty, terjual,
     harga_pemilik, harga_jual, komisi_persen, status, catatan, dibuat_pada)
  values
    -- Masih ada yang di rak, jadi komisinya jalan terus.
    (demo_owner, 'Bu Ratna', 'Keripik Singkong', 'pcs', 40, 18,
     8000, 10000, 10, 'aktif', 'Titip dari minggu lalu, komisi 10 persen.',
     (now() at time zone 'Asia/Jakarta')::date - interval '12 days'),
    (demo_owner, 'Pak Hadi', 'Kue Lapis Vendor', 'box', 20, 7,
     22000, 28000, 12.5, 'aktif', 'Ambil sendiri hari Kamis.',
     (now() at time zone 'Asia/Jakarta')::date - interval '6 days'),
    -- Sudah laku semua: bisa dibayar ke pemilik barang.
    (demo_owner, 'Mas Togo', 'Krupuk Udang', 'pcs', 15, 15,
     12000, 15000, 15, 'aktif', 'Semua laku, siap dibayar.',
     (now() at time zone 'Asia/Jakarta')::date - interval '20 days'),
    -- Sudah ditutup: bagian pemilik sudah dibayar.
    (demo_owner, 'Pak Hendra', 'Wajik Tempe', 'pcs', 10, 10,
     18000, 24000, 10, 'selesai', 'Sudah dibayar 3 hari lalu.',
     (now() at time zone 'Asia/Jakarta')::date - interval '35 days');
end $$;
