# Warung Pintar

**Cytech National AI Hackathon 2026 | Telkom AI Center Padang**

**Demo live:** https://warung-pintar-hackathon.vercel.app

Asisten pencatatan warung: catat penjualan lewat suara, pindai nota belanja,
lalu dapat saran belanja besok yang ada alasannya.

> Prinsip utama: **AI hanya mengusulkan, pemilik warung yang mengonfirmasi.**
> Tidak ada angka yang masuk database tanpa diperiksa pemilik dulu.

## Masalah

Warung kecil mencatat penjualan di buku tulis. Stok tidak terpantau, belanja
berikutan berdasarkan perkiraan, dan laba tidak pernah dihitung. Kasir digital
untuk minimarket tidak membantu: warung punya cara jual sendiri — utang pakai
nama panggilan, pembeli datang saat tanggal tua, harga modal naik diam-diam.

## Solusi

**Cukup bicara dan foto.** Pemilik warung mencatat penjualan dengan suara,
memotret nota agen, lalu aplikasi mengubahnya jadi data stok dan saran
pembelian. Setiap hasil AI tampil di layar konfirmasi yang bisa diedit
sebelum disimpan.

## Yang sudah jalan

| Alur | Status |
| --- | --- |
| Catat penjualan lewat suara (speech-to-text + ekstraksi AI) | Berjalan |
| Pindai nota belanja (model multimodal + tabel koreksi) | Berjalan |
| Stok otomatis dari history transaksi | Berjalan |
| Saran belanja besok + alasan (dihitung kode) | Berjalan |
| Tanya warung (AI menjawab dari data warung sendiri) | Berjalan |
| Akun demo + RLS per pemilik warung | Berjalan |

## Prinsip yang dijaga

1. **AI hanya mengusulkan.** Semua hasil AI masuk ke layar konfirmasi dulu.
2. **Angka dihitung kode, bukan AI.** AI hanya merapikan bahasa. Saran
   belanja, stok, dan laba kotor dihitung di `src/lib/inventory.ts` — satu
   mesin, jadi dua layar tidak pernah berbeda.
3. **Laba kotor, bukan laba bersih.** Selalu disebut "laba kotor" di seluruh
   tampilan.
4. **Prediksi adalah estimasi.** Setiap saran menyebut asumsinya.
5. **Kunci AI hanya di server.** Tidak pernah di frontend atau repositori.

## Menjalankan lokal

```bash
pnpm install
pnpm dev
```

Tanpa environment Supabase, aplikasi jalan dalam **mode demo lokal**: data
disimpan di `localStorage`, tanpa perlu akun. Supabase hanya perlu kalau mau
menguji pemanggilan AI sungguhan.

### Dengan Supabase

Salin `.env.example` jadi `.env` lalu isi:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Lalu jalankan migrasi dan seed:

```bash
supabase link --project-ref <project-ref>
supabase db push --remote
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Seed membuat akun demo, 12 barang, 28 alias, dan ±90 hari transaksi
simulasi.

### Edge Function (AI)

```bash
supabase secrets set \
  AI_API_KEY=... \
  AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai \
  AI_MODEL=gemini-3.5-flash-lite

supabase functions deploy ai-extract-voice
supabase functions deploy ai-read-receipt
supabase functions deploy ai-advise
```

Kunci hanya lived di Supabase Secrets. Tidak pernah masuk `.env` frontend
atau repositori.

## Demo

Akun demo:

```txt
email    demo@warungpintar.app
sandi    warungpintar2026
warung   Warung Sumber Rejeki
```

Atau tekan **Coba akun demo** di layar masuk.

Alur demo (±3 menit) ada di [`docs/demo.md`](docs/demo.md).

## Struktur

```
src/
  lib/          mesin hitung, parser, tipe, lapisan API
  pages/        Beranda, CatatSuara, PindaiNota, TanyaAi, StokBarang
supabase/
  migrations/   skema + RLS per pemilik warung
  functions/    Edge Function AI (kunci hanya di server)
  seed.sql      data simulasi
docs/           kontrak AI, skrip demo
```

### Mesin hitung

| Modul | Tugas |
| --- | --- |
| `src/lib/inventory.ts` | Stok dari history, saran beli, laba kotor |
| `src/lib/parser.ts` | Parser kalimat Indonesia (lokal, tanpa AI) |
| `src/lib/format.ts` | Format rupiah dan tanggal (WIB) |

Rumus saran beli:

```txt
proyeksi per hari = (qty terjual ÷ hari aktif) × faktor musim
target stok       = proyeksi per hari × (lead time + 3 hari)
saran beli        = target stok − stok, minimal sampai stok minimum
```

"Hari aktif" = hari sejak barang pertama terjual, dibatasi 30 hari. Warung yang
baru buka dua hari tidak ikut dibagi 30.

## Pengujian

```bash
pnpm typecheck
pnpm test
pnpm build
```

CI GitHub Actions menjalankan typecheck, test, build, dan pengecekan Edge
Function di setiap pull request.

## Credits

Semua pustaka, model AI, dan dataset dicatat di [`CREDITS.md`](CREDITS.md).

## Lisensi

MIT — lihat [`LICENSE`](LICENSE).
