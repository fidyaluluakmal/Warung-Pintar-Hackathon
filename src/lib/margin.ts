/**
 * Penjaga Margin — deteksi harga modal yang naik dan saran harga jual.
 *
 * Warung kecil jarang memakai mesin kasir. Harga modal naik diam-diam, margin
 * menyusut, dan pemilik baru sadar setelah bulan tutup buku.
 *
 * Modul ini murni: masuk dan keluar sama, tanpa database atau jaringan.
 */

import { persen, rupiah } from "./format"
import { round2 } from "./inventory"
import type { MarginBarang } from "./types"

/** Bulat ke kelipatan 100, ke atas. Harga jual selalu terlihat rapi. */
export function bulatkanHarga(harga: number): number {
  if (!Number.isFinite(harga) || harga <= 0) return 0
  return Math.ceil(harga / 100) * 100
}

/**
 * Margin dalam persen.
 *
 * margin = (harga_jual - harga_modal) / harga_jual × 100
 *
 * Kalau harga jual <= 0, margin dianggap 0 — bukan NaN, supaya tampilan
 * tidak pernah menampilkan "NaN%".
 */
export function marginPersen(hargaJual: number, hargaModal: number): number {
  if (hargaJual <= 0) return 0
  return round2(((hargaJual - hargaModal) / hargaJual) * 100)
}

/**
 * Harga jual yang menjaga margin target.
 *
 * Dipakai saat harga modal naik: owner tidak harus menyerap seluruh kenaikan,
 * tapi juga tidak boleh langsung menaikkan harga jual tanpa alasan.
 *
 * margin_target = (harga_jual_baru - modal_baru) / harga_jual_baru
 * => harga_jual_baru = modal_baru / (1 - margin_target)
 */
export function hargaJualUntukMargin(modalBaru: number, marginTargetPersen: number): number {
  const target = Math.min(Math.max(marginTargetPersen, 0) / 100, 0.95)
  if (modalBaru <= 0) return 0
  return bulatkanHarga(modalBaru / (1 - target))
}

/** Margin target yang dipakai sebagai patokan. */
export const MARGIN_TARGET = 16

export interface SinyalMargin {
  barangId: string
  nama: string
  satuan: string
  hargaJual: number
  hargaModal: number
  hargaModalSebelumnya: number
  marginSekarang: number
  marginSebelumnya: number
  kenaikanModalPersen: number
  hargaJualSaran: number
  alasan: string
}

/**
 * Cari barang yang margin-nya menyusut karena harga modal naik.
 *
 * Syaratnya:
 *  - harga modal sekarang lebih tinggi dari sebelumnya
 *  - margin sekarang lebih rendah dari margin sebelumnya
 *
 * Diurutkan dari kenaikan modal terbesar, karena itu yang paling mendesak.
 */
export function cariSinyalMargin(barang: MarginBarang[]): SinyalMargin[] {
  const sinyal: SinyalMargin[] = []

  for (const item of barang) {
    const modalSekarang = item.harga_modal
    const modalSebelumnya = item.modal_sebelumnya

    // Tidak ada riwayat, atau modal tidak berubah: bukan sinyal.
    if (modalSebelumnya <= 0) continue
    if (modalSekarang <= modalSebelumnya) continue

    const marginSekarang = marginPersen(item.harga_jual, modalSekarang)
    const marginSebelumnya = marginPersen(item.harga_jual, modalSebelumnya)
    if (marginSekarang >= marginSebelumnya) continue

    const kenaikan = round2(((modalSekarang - modalSebelumnya) / modalSebelumnya) * 100)
    const hargaJualSaran = hargaJualUntukMargin(modalSekarang, MARGIN_TARGET)

    sinyal.push({
      barangId: item.barang_id,
      nama: item.nama,
      satuan: item.satuan,
      hargaJual: item.harga_jual,
      hargaModal: modalSekarang,
      hargaModalSebelumnya: modalSebelumnya,
      marginSekarang,
      marginSebelumnya,
      kenaikanModalPersen: kenaikan,
      hargaJualSaran,
      alasan: `Modal naik ${persen(kenaikan)} (${rupiah(modalSebelumnya)} → ${rupiah(modalSekarang)} per ${item.satuan}), margin menyusut ${persen(marginSebelumnya)} → ${persen(marginSekarang)}.`,
    })
  }

  return sinyal.sort((a, b) => b.kenaikanModalPersen - a.kenaikanModalPersen)
}

/**
 * Pembagian pembayaran untuk penjualan "simpen dulu".
 *
 * Barang keluar seluruhnya (stok turun untuk semua), tapi hanya sebagian
 * yang dibayar. Sisanya jadi utang.
 *
 * Pembagian mengikuti urutan baris: barang pertama dibayar dulu. Kalau uang
 * yang dibayar tidak cukup untuk satu barang, barang itu dipotong sebagian
 * dan sisanya ikut jadi utang.
 */
export interface BarisBayar {
  barangId: string
  qty: number
  satuan: string
  hargaSatuan: number
}

export interface HasilBagiBayar {
  /** Uang yang benar-benar dibayar sekarang. */
  dibayar: number
  /** Sisa yang jadi utang. */
  utang: number
  /**
   * Per baris: berapa yang dibayar dari barang ini.
   *
   * `index` menunjuk baris asal, jadi dua baris untuk barang yang sama
   * (misal "2 beras" dan "1 beras" di kalimat yang sama) tidak tertukar
   *_qty_ dan harganya.
   */
  perBaris: Array<{ index: number; barangId: string; dibayar: number; utang: number }>
}

export function bagiPembayaran(baris: BarisBayar[], uangDibayar: number): HasilBagiBayar {
  const total = round2(baris.reduce((sum, b) => sum + b.qty * b.hargaSatuan, 0))
  const dibayar = round2(Math.min(Math.max(uangDibayar, 0), total))
  let sisa = dibayar

  const perBaris = baris.map((b, index) => {
    const hargaBaris = round2(b.qty * b.hargaSatuan)
    const untukBaris = round2(Math.min(sisa, hargaBaris))
    sisa = round2(sisa - untukBaris)
    return {
      index,
      barangId: b.barangId,
      dibayar: untukBaris,
      utang: round2(hargaBaris - untukBaris),
    }
  })

  return {
    dibayar,
    utang: round2(total - dibayar),
    perBaris,
  }
}

