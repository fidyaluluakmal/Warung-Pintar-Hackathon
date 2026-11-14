-- Warung Pintar — data contoh (v1, ditulis saat hackathon)
--
-- Data ini SIMULASI, bukan data warung sungguhan. Disediakan supaya fitur
-- saran AI punya riwayat yang bisa dilihat: tanpa 30 hari penjualan, AI
-- tidak punya bahan untuk memberi saran.
--
-- Cara pakai:
--   psql "$SUPABASE_DB_URL" -f supabase/seed.sql
-- atau tempel ke Supabase SQL Editor.
--
-- Data ditautkan ke akun demo lewat `owner_id`. Kalau akun demo belum ada,
-- bagian katalog dan transaksi dilewati.

-- ---------------------------------------------------------------------------
-- 1. Akun demo
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from auth.users where email = 'demo@warungpintar.app') then
    insert into auth.users (email, password_hash, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    values (
      'demo@warungpintar.app',
      crypt('warungpintar2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"warung":"Warung Sumber Rejeki","pemilik":"Pak Andi"}'::jsonb
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Katalog + alias
-- ---------------------------------------------------------------------------
do $$
declare
  demo_owner uuid;
begin
  select id into demo_owner from auth.users where email = 'demo@warungpintar.app';
  if demo_owner is null then
    raise notice 'Akun demo belum ada. Seed dilewati.';
    return;
  end if;

  -- Bersihkan data lama supaya seed bisa dijalankan berulang.
  -- Urutan penting: anak lebih dulu, karena barang direferensikan oleh
  -- baris transaksi, utang, dan catatan harga.
  delete from public.baris_transaksi where owner_id = demo_owner;
  delete from public.transaksi where owner_id = demo_owner;
  delete from public.alias_barang where owner_id = demo_owner;
  delete from public.nota_belanja where owner_id = demo_owner;
  delete from public.utang where owner_id = demo_owner;
  delete from public.harga_pasar where owner_id = demo_owner;
  delete from public.harga_modal_riwayat where owner_id = demo_owner;
  delete from public.barang where owner_id = demo_owner;

  -- Barang: nama, satuan, stok awal, min stok, modal, jual, lead time.
  -- Stok awal sengaja besar supaya penyesuaian opname nanti kelihatan wajar.
  insert into public.barang
    (owner_id, nama, satuan, stok_awal, min_stok, harga_modal, harga_jual, lead_time_hari)
  values
    (demo_owner, 'Beras Premium',   'kg',      30, 40,  14000, 16000, 2),
    (demo_owner, 'Gula Pasir',       'kg',      45, 30,  17000, 19000, 2),
    (demo_owner, 'Minyak Goreng',    'liter',   60, 25,  15000, 17000, 3),
    (demo_owner, 'Telur Ayam',       'kg',      34, 20,  28000, 32000, 1),
    (demo_owner, 'Mi Instan',        'bungkus', 45, 60,   3000,  3500, 1),
    (demo_owner, 'Kopi Sachet',      'sachet',  85, 70,   1200,  1500, 2),
    (demo_owner, 'Susu UHT',         'pcs',     90, 50,   5000,  6000, 2),
    (demo_owner, 'Air Mineral',      'botol',   60, 80,   2500,  4000, 1),
    (demo_owner, 'Rokok Kretek',     'bungkus', 50, 60,  22000, 24000, 1),
    (demo_owner, 'Sabun Mandi',      'pcs',     70, 40,   4500,  5500, 2),
    (demo_owner, 'Sarden',           'pcs',     75, 40,   6000,  7500, 3),
    (demo_owner, 'Pisang',           'kg',      46, 24,  12000, 15000, 1);

  -- Alias: cara orang menyebut barang di warung.
  insert into public.alias_barang (owner_id, barang_id, alias)
  select demo_owner, b.id, a.alias
  from public.barang b
  join (values
    ('Beras Premium', 'beras'), ('Beras Premium', 'beras premium'),
    ('Gula Pasir', 'gula'), ('Gula Pasir', 'gulpas'), ('Gula Pasir', 'gula pasir'),
    ('Minyak Goreng', 'minyak'), ('Minyak Goreng', 'minyak goreng'), ('Minyak Goreng', 'goreng'),
    ('Telur Ayam', 'telur'), ('Telur Ayam', 'telor'), ('Telur Ayam', 'telur ayam'),
    ('Mi Instan', 'mi'), ('Mi Instan', 'mie'), ('Mi Instan', 'mi instan'),
    ('Kopi Sachet', 'kopi'), ('Kopi Sachet', 'kopi sachet'),
    ('Susu UHT', 'susu'), ('Susu UHT', 'susu uht'),
    ('Air Mineral', 'air'), ('Air Mineral', 'aqua'), ('Air Mineral', 'air mineral'),
    ('Rokok Kretek', 'rokok'), ('Rokok Kretek', 'kretek'),
    ('Sabun Mandi', 'sabun'), ('Sabun Mandi', 'sabun mandi'),
    ('Sarden', 'sarden'), ('Sarden', 'sarden tuna'),
    ('Pisang', 'pisang')
  ) as a(nama, alias) on a.nama = b.nama
  where b.owner_id = demo_owner;

  -- -------------------------------------------------------------------------
  -- 3. Riwayat 90 hari
  --
  -- Setiap hari buka (kecuali Minggu) dibuat beberapa transaksi penjualan.
  -- Jam transaksi diacak antara 08:00 dan 18:00 supaya grafiknya terlihat hidup.
  -- -------------------------------------------------------------------------
  insert into public.transaksi (owner_id, tipe, tanggal, sumber, total)
  select
    demo_owner,
    'jual',
    hari.tanggal,
    case when extract(doy from hari.tanggal)::int % 4 = 0 then 'nota' else 'suara' end,
    0
  from (
    select
      -- Jam warung (WIB) untuk tanggal tersebut, lalu dikonversi ke UTC
      -- supaya tanggalnya tetap benar saat dibaca di zona waktu warung.
      (d::date
        + time '08:00'
        + (random() * interval '10 hours')) at time zone 'Asia/Jakarta' as tanggal
    from generate_series(
      (now() at time zone 'Asia/Jakarta')::date - interval '90 days',
      (now() at time zone 'Asia/Jakarta')::date,
      '1 day'
    ) as d
  ) hari
  cross join generate_series(1, 3 + (extract(doy from hari.tanggal)::int % 3)) as n
  where extract(dow from hari.tanggal)::int <> 0;

  -- Baris penjualan: tiap transaksi punya 1-3 barang, diambil acak dan
  -- merata dari semua barang.
  insert into public.baris_transaksi (owner_id, transaksi_id, barang_id, jumlah, satuan, harga_satuan)
  select
    t.owner_id,
    t.id,
    b.id,
    (1 + (abs(hashtext(t.id::text || 'q')) % 4))::numeric,
    b.satuan,
    b.harga_jual
  from public.transaksi t
  cross join lateral (
    select bb.id, bb.satuan, bb.harga_jual
    from public.barang bb
    where bb.owner_id = t.owner_id
    -- Urutan dari hash transaksi + barang. Dengan `random()` di dalam
    -- lateral, Postgres bisa menilai nilainya sekali untuk seluruh
    -- pernyataan, sehingga semua transaksi memilih barang yang sama.
    order by md5(t.id::text || bb.id::text)
    limit 1 + (abs(hashtext(t.id::text)) % 3)
  ) b
  where t.owner_id = demo_owner
    and t.tipe = 'jual';

  -- Total transaksi = jumlah baris x harga satuan.
  update public.transaksi t
  set total = coalesce(
    (select sum(bt.jumlah * bt.harga_satuan) from public.baris_transaksi bt where bt.transaksi_id = t.id),
    0
  )
  where t.owner_id = demo_owner and t.tipe = 'jual';

  -- Pembelian: kira-kira tiap 10 hari, untuk mengisi barang yang laku.
  insert into public.transaksi (owner_id, tipe, tanggal, sumber, total, agen)
  select
    demo_owner,
    'beli',
    t.tanggal + interval '1 day',
    'nota',
    0,
    'Agen Beras Makmur'
  from (
    select distinct date_trunc('day', tanggal) as tanggal
    from public.transaksi
    where owner_id = demo_owner and tipe = 'jual'
  ) t
  where extract(doy from t.tanggal)::int % 10 = 0;

  -- Jumlah pembelian mengikuti barang yang benar-benar terjual, supaya stok
  -- akhir tetap waras: barang laris stoknya masih positif, barang sepi
  -- tidak menumpuk.
  --
  -- Total terjual per barang dibagi rata ke semua nota pembelian, lalu
  -- Pembelian sama dengan penjualan, jadi stok mengurus seperti warung
  -- sungguhan: barang laku tinggal sedikit dan perlu restok.
  with penjualan_per_barang as (
    select bt.barang_id, sum(bt.jumlah) as total_terjual
    from public.baris_transaksi bt
    join public.transaksi t on t.id = bt.transaksi_id
    where t.owner_id = demo_owner and t.tipe = 'jual'
    group by bt.barang_id
  ),
  jumlah_nota as (
    select count(*)::numeric as n from public.transaksi
    where owner_id = demo_owner and tipe = 'beli'
  )
  insert into public.baris_transaksi (owner_id, transaksi_id, barang_id, jumlah, satuan, harga_satuan)
  select
    btrans.owner_id,
    btrans.id,
    b.id,
    greatest(10, ceil(coalesce(p.total_terjual, 0) / greatest(j.n, 1)))::numeric,
    b.satuan,
    b.harga_modal
  from public.transaksi btrans
  cross join public.barang b
  cross join jumlah_nota j
  left join penjualan_per_barang p on p.barang_id = b.id
  where btrans.owner_id = demo_owner
    and btrans.tipe = 'beli'
    and b.owner_id = demo_owner;

  update public.transaksi t
  set total = coalesce(
    (select sum(bt.jumlah * bt.harga_satuan) from public.baris_transaksi bt where bt.transaksi_id = t.id),
    0
  )
  where t.owner_id = demo_owner and t.tipe = 'beli';
end $$;
