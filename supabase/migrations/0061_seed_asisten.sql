-- Warung Pintar — data contoh untuk Asisten warung (v1)
--
-- Kalau halaman asisten dibuka kosong, jurit tidak bisa melihat apa pun.
-- Dua percakapan contoh supaya kelihatan fitur sesi dan proyeknya jalan.
--
-- Isi jawabannya sama dengan yang keluar dari AI untuk data demo — jadi
-- angkanya cocok dengan halaman lain.
--
-- Data ini disambung ke akun demo lewat `owner_id`. Kalau akun demo belum
-- ada, bagian ini dilewati.

do $$
declare
  demo_owner uuid;
  proyek_utang uuid;
  sesi_beli uuid;
  sesi_utang uuid;
begin
  select id into demo_owner from auth.users where email = 'demo@warungpintar.app';
  if demo_owner is null then
    raise notice 'Akun demo belum ada. Seed dilewati.';
    return;
  end if;

  delete from public.pesan_asisten where owner_id = demo_owner;
  delete from public.sesi_asisten where owner_id = demo_owner;
  delete from public.proyek where owner_id = demo_owner;

  -- ---------------------------------------------------------------------------
  -- Proyek: satu kelompok percakapan dengan instruksi bersama.
  -- ---------------------------------------------------------------------------
  insert into public.proyek (owner_id, nama, instruksi)
  values (
    demo_owner,
    'Utang Pak Yono',
    'Fokus saja utang Pak Yono. Jangan membahas barang lain.'
  )
  returning id into proyek_utang;

  -- ---------------------------------------------------------------------------
  -- Sesi 1: pertanyaan umum, tanpa proyek.
  -- ---------------------------------------------------------------------------
  insert into public.sesi_asisten (owner_id, judul, proyek_id, dibuat_pada, diperbarui_pada)
  values (
    demo_owner,
    'Beli apa besok?',
    null,
    now() - interval '2 hours',
    now() - interval '2 hours'
  )
  returning id into sesi_beli;

  insert into public.pesan_asisten (owner_id, sesi_id, role, teks, dibuat_pada)
  values
    (
      demo_owner,
      sesi_beli,
      'user',
      'Beli apa besok?',
      now() - interval '2 hours'
    ),
    (
      demo_owner,
      sesi_beli,
      'assistant',
      'Berdasarkan catatan, besok disarankan beli Air Mineral sebanyak 19 botol, Mi Instan 12 bungkus, Rokok Kretek 8 bungkus, dan Beras Premium 7 kg. Semua angka ini adalah estimasi dari catatan warung, jadi cek lagi kondisinya sebelum belanja.',
      now() - interval '2 hours'
    );

  -- ---------------------------------------------------------------------------
  -- Sesi 2: di dalam proyek, jadi instruksi proyeknya kelihatan.
  -- ---------------------------------------------------------------------------
  insert into public.sesi_asisten (owner_id, judul, proyek_id, dibuat_pada, diperbarui_pada)
  values (
    demo_owner,
    'Siapa yang paling banyak utang?',
    proyek_utang,
    now() - interval '35 minutes',
    now() - interval '35 minutes'
  )
  returning id into sesi_utang;

  insert into public.pesan_asisten (owner_id, sesi_id, role, teks, dibuat_pada)
  values
    (
      demo_owner,
      sesi_utang,
      'user',
      'Siapa yang paling banyak utang?',
      now() - interval '35 minutes'
    ),
    (
      demo_owner,
      sesi_utang,
      'assistant',
      'Paling besar utangnya Pak Yono, sisa Rp198.500 dari 3 catatan. Yang terlama sudah 15 hari. Catatan utangnya ada di menu Simpen Dulu.',
      now() - interval '35 minutes'
    );
end $$;
