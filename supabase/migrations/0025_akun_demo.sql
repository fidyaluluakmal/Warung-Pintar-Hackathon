-- Warung Pintar — akun demo (v1)
--
-- Akun demo dibuat di sini, sebagai bagian dari skema, bukan hanya di
-- `seed.sql`.
--
-- Alasannya urutan jalan:
--
--   1. supabase db push --remote   -> menjalankan migration ini, lalu
--                                      0032/0042/0051/0061 yang butuh akun demo
--   2. psql ... -f supabase/seed.sql -> mengisi data contoh
--
-- Kalau akun demo baru dibuat di langkah 2, semua seed di langkah 1 akan
-- dilewati karena akunnya belum ada -- dan data contohnya tidak pernah
-- masuk. Akun demo dibuat di sini supaya urutan itu benar.
--
-- Password akun demo: warungpintar2026. Ini akun demo publik, dipakai
-- bersama-sama -- bukan akun sungguhan.

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
