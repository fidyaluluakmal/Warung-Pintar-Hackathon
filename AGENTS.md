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
- Admin (pemilik repo) boleh merge langsung pakai `--admin`, tapi anggota tim
  lain tidak: mereka tetap butuh persetujuan pemilik.
- Push baru setelah persetujuan harus diulang (`require_last_push_approval`).
- Persetujuan lama dibatalkan kalau ada commit baru (`dismiss_stale_reviews`).
- Semua komentar harus dijawab sebelum merge.
- Auto-merge tidak dinyalakan, force push dan delete branch dilarang.
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
- **Barang titipan bukan milik warung.** Barang titipan tidak boleh masuk
  hitungan stok atau laba warung. Yang dihitung cuma komisi warung dan
  bagian yang harus dibayar ke pemilik barang (`src/lib/titip.ts`).
- **Pelanggan warung cuma punya nama panggilan.** Identitasnya nama, bukan
  nomor telepon. Nomor telepon opsional.
- Data contoh harus deterministik: hash, bukan `random()`. Kalau seed
  diulang, hasilnya harus persis sama — jurit yang datang kedua kali
  tidak boleh melihat angka berbeda.

## Layar yang ada

| Layar | Isi |
| --- | --- |
| Beranda | Ringkasan hari ini, modal awal, kartu aksi |
| Kasir | Keranjang, mode "simpen dulu" |
| Stok Barang | Stok dari history, saran beli, filter perlu restok |
| Simpen Dulu | Buku utang pelanggan per orang |
| Penjaga Margin | Barang yang margin-nya menyusut, saran harga jual |
| Cek Stok | Hitung fisik vs catatan, selisih jadi penyesuaian |
| Pelanggan | Buku pelanggan, riwayat belanja, barang favorit |
| Titip Jual | Barang titipan, komisi warung, bagian pemilik barang |
| Harga Pasar | Perbandingan harga di tempat lain |
| Modal Awal | Posisi modal sekarang vs modal awal |
| Tutup Buku | Ringkasan harian + pengecekan laci |
| Laporan | Tren penjualan, komposisi omzet, produk terlaris |
| Riwayat | Jejak transaksi beserta sumbernya |
| Pengaturan | Tema, akun, data demo |

## Struktur

```
src/lib/      logika murni + lapisan data. Tidak boleh menyentuh DOM, tidak
              boleh mengimpor React.
src/hooks/    hook React (mis. jam berjalan).
src/pages/    satu layar per file.
supabase/
  migrations/ skema. Nomor migration tidak boleh dipakai ulang.
  functions/  Edge Function. Kunci API hanya dari Deno.env.
```

Satu angka satu tempat. Kalau dua layar menghitung hal yang sama, harus
pakai fungsi yang sama — kalau tidak, angkanya bisa berbeda untuk warung
yang sama. `src/lib/inventory.ts` (mesin restok), `src/lib/capital.ts` (modal
awal), dan `src/lib/margin.ts` (margin) adalah sumbernya.

Daftar satuan harus sama di `src/lib/types.ts` dan
`supabase/functions/_shared/normalize.ts`. Kalau berbeda, AI mengubah satuan
yang tidak dikenal jadi "pcs" dan stoknya tidak cocok dengan katalog. Ada
test yang menjaganya: `src/lib/satuan.test.ts`.

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
