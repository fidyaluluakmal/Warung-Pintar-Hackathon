/**
 * Titip jual (konsinyasi).
 *
 * Warung jadi etalase barang milik orang lain. Barang titipan bukan milik
 * warung, jadi tidak boleh masuk hitungan stok warung sendiri; yang dihitung
 * adalah komisi warung dan bagian yang harus dibayar ke pemilik barang.
 *
 * Modul ini murni: tanpa React, tanpa jaringan, bisa diuji sendiri.
 */

import { angka, persen, rupiah } from "./format"
import type { Titip } from "./types"
/** Hasil penjualan barang titipan sebanyak sejumlah tertentu. */
export interface PenjualanTitip {
  /** Berapa yang benar-benar terjual (dibatasi sisa yang ada). */
  qty: number
  /** Omzet dari penjualan titipan. */
  omzet: number
  /** Komisi untuk warung. */
  komisi: number
  /** Bagian yang harus dibayar ke pemilik barang. */
  bagianPemilik: number
  /** Sisa barang yang belum terjual. */
  sisa: number
}

/** Berapa barang titipan yang masih di rak. */
export function sisaTitip(row: Titip): number {
  return Math.max(0, row.qty - row.terjual)
}

/**
 * Hitung efek penjualan titipan sebanyak `qty`.
 *
 * Dipakai untuk pratinjau: "kalau ini terjual, angkanya jadi berapa?"
 * Jumlah yang diminta tidak boleh melebihi sisa yang ada: kalau minta 10 tapi
 * sisa 3, yang dihitung 3.
 */
export function hitungPenjualanTitip(row: Titip, qty: number): PenjualanTitip {
  const terjual = Math.min(Math.max(0, qty), sisaTitip(row))
  const omzet = Math.round(terjual * row.harga_jual)
  const komisi = Math.round(omzet * (row.komisi_persen / 100))
  return {
    qty: terjual,
    omzet,
    komisi,
    bagianPemilik: omzet - komisi,
    sisa: sisaTitip(row) - terjual,
  }
}

/**
 * Angka dari penjualan yang SUDAH terjadi pada satu titipan.
 *
 * Berbeda dengan `hitungPenjualanTitip`: di sini jumlah yang terjual sudah
 * tercatat di titipan, jadi tidak perlu dibatasi sisa. Kalau dibatasi, titipan
 * yang sudah laku semua akan terhitung nol.
 */
export function omzetTitip(row: Titip): PenjualanTitip {
  const omzet = Math.round(row.terjual * row.harga_jual)
  const komisi = Math.round(omzet * (row.komisi_persen / 100))
  return {
    qty: row.terjual,
    omzet,
    komisi,
    bagianPemilik: omzet - komisi,
    sisa: sisaTitip(row),
  }
}

/** Ringkasan seluruh titipan yang masih jalan. */
export interface StatistikTitip {
  /** Berapa titipan yang masih jalan. */
  jumlahTitip: number
  /** Omzet titipan yang sudah terjual. */
  omzet: number
  /** Total komisi warung. */
  komisi: number
  /** Total yang harus dibayar ke pemilik barang. */
  harusDibayar: number
  /** Berapa barang titipan yang sudah terjual. */
  barangTerjual: number
  /** Berapa barang titipan yang masih tersisa di rak. */
  barangSisa: number
}

export function statistikTitip(rows: Titip[]): StatistikTitip {
  const aktif = rows.filter((row) => row.status === "aktif")
  let omzet = 0
  let komisi = 0
  for (const row of aktif) {
    const jual = omzetTitip(row)
    omzet += jual.omzet
    komisi += jual.komisi
  }
  return {
    jumlahTitip: aktif.length,
    omzet,
    komisi,
    harusDibayar: omzet - komisi,
    barangTerjual: aktif.reduce((sum, row) => sum + row.terjual, 0),
    barangSisa: aktif.reduce((sum, row) => sum + sisaTitip(row), 0),
  }
}

/**
 * Ringkasan yang harus dibayar ke pemilik barang.
 *
 * Hasilnya bisa disalin dan dikirim ke pemilik barang — jadi pemilik barang
 * tak perlu menghitung ulang sendiri.
 */
export function teksPembayaranTitip(rows: Titip[]): string {
  const aktif = rows.filter((row) => row.status === "aktif" && row.terjual > 0)
  if (aktif.length === 0) return "Belum ada barang titipan yang terjual."

  const lines = ["Rincian titip jual:"]
  for (const row of aktif) {
    const jual = omzetTitip(row)
    lines.push(
      `- ${row.pemilik}: ${angka(row.terjual)} ${row.satuan} ${row.nama_barang} — ` +
        `omzet ${rupiah(jual.omzet)}, komisi warung ${persen(row.komisi_persen)} ` +
        `(${rupiah(jual.komisi)}), bagian Anda ${rupiah(jual.bagianPemilik)}`,
    )
  }
  const stats = statistikTitip(rows)
  lines.push(`Total bagian pemilik barang: ${rupiah(stats.harusDibayar)}.`)
  return lines.join("\n")
}


/**
 * Saran tindakan untuk satu titipan.
 *
 * Dipakai supaya pemilik warung tahu langkah berikutnya tanpa perlu
 * menghitung sendiri.
 */
export function saranTitip(row: Titip): string {
  const sisa = sisaTitip(row)
  if (row.status === "selesai") return "Selesai — sudah dibayar ke pemilik barang."
  if (row.terjual === 0) return "Belum ada yang terjual."
  if (sisa === 0) {
    return `Semua ${angka(row.qty)} ${row.satuan} terjual — bisa dibayar ke ${row.pemilik}.`
  }
  return `${angka(row.terjual)} ${row.satuan} terjual, sisa ${angka(sisa)} ${row.satuan} masih di rak.`
}
