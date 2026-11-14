/**
 * Perhitungan stok dan saran beli.
 *
 * Semua fungsi di sini murni: masuk dan keluar sama, tanpa membaca database
 * atau jaringan. Jadi bisa diuji dan bisa dipakai di layar manapun.
 *
 * Aturan stok: Stok akhir = Stok awal + Barang masuk - Barang keluar.
 */

import type { SaranBeli, StokBarang, Transaksi, BarisTransaksi } from "./types"

/** Stok akhir satu barang dari riwayat baris transaksinya. */
export function hitungStok(
  stokAwal: number,
  baris: Pick<BarisTransaksi, "jumlah" | "transaksi_id">[],
  tipeTransaksi: Map<string, Transaksi["tipe"]>,
): number {
  let stok = stokAwal
  for (const row of baris) {
    const tipe = tipeTransaksi.get(row.transaksi_id)
    if (tipe === "beli") stok += row.jumlah
    else if (tipe === "jual") stok -= row.jumlah
    else if (tipe === "sesuaikan") stok += row.jumlah
  }
  return round2(stok)
}

/**
 * Saran beli per barang.
 *
 * Proyeksi per hari = (qty terjual ÷ hari aktif) × faktor musim
 * Target stok       = proyeksi per hari × (lead time + 3 hari)
 * Saran beli        = target stok - stok, minimal 0
 *
 * "Hari aktif" = hari sejak barang pertama terjual, dibatasi 30 hari.
 * Warung yang baru buka 2 hari tidak boleh dibagi 30 — sarannya jadi terlalu kecil.
 */
export function hitungSaranBeli(
  stokBarang: StokBarang[],
  baris: BarisTransaksi[],
  transaksi: Transaksi[],
  hariIni: Date,
  faktorMusim: Record<string, number> = {},
): SaranBeli[] {
  const tipeById = new Map(transaksi.map((t) => [t.id, t.tipe]))
  const byBarang = new Map<string, BarisTransaksi[]>()
  for (const row of baris) {
    const list = byBarang.get(row.barang_id)
    if (list) list.push(row)
    else byBarang.set(row.barang_id, [row])
  }

  const hasil: SaranBeli[] = []

  for (const barang of stokBarang) {
    const rows = byBarang.get(barang.barang_id) ?? []
    const jualRows = rows.filter((row) => tipeById.get(row.transaksi_id) === "jual")
    if (jualRows.length === 0) continue

    const qtyTerjual = jualRows.reduce((sum, row) => sum + row.jumlah, 0)

    // Hari aktif: sejak penjualan pertama, dibatasi 30 hari.
    const tanggalJual = jualRows
      .map((row) => findTanggal(row.transaksi_id, transaksi))
      .filter((value): value is string => value !== null)
      .sort()
    const pertama = tanggalJual[0]
    if (!pertama) continue
    const hariAktif = Math.min(
      30,
      Math.max(1, Math.floor((hariIni.getTime() - new Date(pertama).getTime()) / 86_400_000) + 1),
    )

    const dasarPerHari = qtyTerjual / hariAktif
    const musim = faktorMusim[barang.barang_id] ?? 1
    const proyeksiPerHari = dasarPerHari * musim
    const targetStok = proyeksiPerHari * (barang.lead_time_hari + 3)

    // Kalau stok sekarang masih di atas target, tidak perlu beli.
    // Kalau stok di bawah minimum, tetap harus dibeli walau target lebih kecil.
    const minimum = Math.max(barang.min_stok, targetStok)
    const kurang = Math.max(0, minimum - barang.stok)
    if (kurang <= 0) continue

    hasil.push({
      barangId: barang.barang_id,
      nama: barang.nama,
      satuan: barang.satuan,
      qty: round2(kurang),
      alasan: `Rata-rata terjual ${round2(dasarPerHari)} ${barang.satuan}/hari, stok sekarang ${round2(barang.stok)} ${barang.satuan}.`,
    })
  }

  // Barang paling butuh perhatian dulu.
  return hasil.sort((a, b) => b.qty - a.qty)
}

function findTanggal(
  transaksiId: string,
  transaksi: Transaksi[],
): string | null {
  const found = transaksi.find((t) => t.id === transaksiId)
  return found ? found.tanggal : null
}

/** Pembulatan 2 desimal, menghindari galat floating point. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Laba kotor = penjualan - modal barang terjual. */
export function labaKotor(penjualan: number, modalTerjual: number): number {
  return round2(penjualan - modalTerjual)
}

/** Ambil "hari ini" dalam zona waktu warung, bukan zona waktu perangkat. */
export function hariIniWIB(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}
