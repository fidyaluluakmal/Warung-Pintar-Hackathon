# Konvensi Repository

Dokumen ini menjelaskan cara kerja tim di repo ini. Baca sebelum contribute.

## Alur kerja

Jangan langsung push ke `main`. `main` dilindungi: branch ini wajib lewat
pull request, harus ada persetujuan kode dari pemilik repo, dan CI harus hijau.

```bash
git checkout main
git pull
git checkout -b feat/<nama>-<tugas>
```

Contoh: `feat/tyan-nota-koreksi-total`.

Setelah selesai:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Buka pull request ke `main`. **Pemilik repo yang-review dan menyetujui merge.**
Jangan merge pull request milik orang lain — ini yang membuat review berarti.

## Aturan commit

- Commit kecil dan jelas, satu tujuan.
- Format: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- Contoh: `fix: total nota beda tidak ditandai`.
- Email commit harus email GitHub yang terverifikasi, kalau tidak Vercel
  menolak membangun preview deploy.
- Jangan commit `.env`, `dist`, atau `node_modules`.

## Branch protection

`main` dilindungi dengan:

- Wajib pull request, minimal 1 persetujuan kode dari pemilik repo.
- Admin juga tidak bisa bypass (`enforce_admins`).
- Push baru setelah persetujuan harus diulang (`require_last_push_approval`).
- Persetujuan lama dibatalkan kalau ada commit baru (`dismiss_stale_reviews`).
- Semua komentar harus dijawab sebelum merge.
- Force push dan delete branch dilarang.
- CI (`check` + `edge-functions`) harus hijau.

## Aturan produk

- **AI hanya mengusulkan.** Hasil AI selalu lewat layar konfirmasi yang bisa
  diedit sebelum disimpan.
- **Angka dihitung kode, bukan AI.** Satu mesin hitung di
  `src/lib/inventory.ts`. Kalau layar baru butuh angka, panggil mesin itu —
  jangan hitung ulang di komponen.
- Stok = stok awal + masuk − keluar. Sumbernya history transaksi.
- Selalu sebut **laba kotor**, tidak pernah "laba bersih".
- Prediksi selalu diperlakukan sebagai estimasi, dan menyebut asumsinya.
- Satu barang = satu nama baku + alias. Kalau nama sudah dipakai, tambah
  alias — jangan buat barang baru.
- Satu akun = satu warung. Semua baris yang ditulis aplikasi harus punya
  `owner_id`. Jangan pernah insert tanpa `owner_id`.

## Struktur

```
src/lib/      logika murni + lapisan data. Tidak boleh menyentuh DOM.
src/pages/    satu layar per file.
supabase/
  migrations/ skema. Nomor migration tidak boleh dipakai ulang.
  functions/  Edge Function. Kunci API hanya dari Deno.env.
```

## Migrasi

- Nomor migration baru harus lebih besar dari semua yang sudah ada.
- `create table if not exists` dan `drop policy if exists` sebelum `create
  policy`, supaya migrasi bisa dijalankan berulang.
- Nama fungsi dan trigger dibedakan per fitur. Database dipakai bersama, jadi
  nama generik seperti `set_updated_at` bisa menimpa fungsi milik fitur lain.
- Setelah mengubah skema, jalankan ulang `supabase/seed.sql` supaya data
  contoh tetap sinkron.

## Edge Function

- Prompt wajib memaksa JSON saja, dan melarang mengarang angka.
- Kunci API dari `Deno.env.get("AI_API_KEY")`. Tidak pernah dari frontend.
- Bentuk JSON keluar harus selalu cocok dengan `docs/contract.md`.

## Sebelum demo

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` hijau
- [ ] Alur demo dicoba 3 kali berturut-turut di HP sungguhan
- [ ] Rekaman video demo tersimpan di laptop dan HP
- [ ] Link demo aktif dan bisa dibuka dari luar
