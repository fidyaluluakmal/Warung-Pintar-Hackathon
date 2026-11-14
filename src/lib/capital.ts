/**
 * Modal awal & posisi modal.
 *
 * Pemilik warung tahu dia mulai dengan modal berapa. Dari situ bisa
 * dibandingkan: sekarang uangnya di rak (stok), di piutang (utang pelanggan),
 * atau sudah jadi laba: atau justru berkurang.
 *
 * Semua angka berasal dari data (stok, transaksi, utang) plus satu angka yang
 * dimasukkan pemilik sendiri: modal awal. Tidak ada angka yang dikarang.
 */

import { rupiah } from "./format"
import { tanggalWib } from "./calendar"
import { round2 } from "./inventory"
import type { BarisTransaksi, StokBarang, Transaksi, UtangBerjalan } from "./types"

const KUNCI = "warung-pintar-modal-awal-v1"

export interface ModalAwal {
  /** Modal yang dipakai mulai berjualan (stok + kas), dalam rupiah. */
  amount: number
  /** Tanggal mulai (YYYY-MM-DD). */
  since: string
}

export interface LaporanModal {
  initial: number
  since: string
  /** Nilai persediaan saat ini: stok × harga modal. */
  stockValue: number
  /** Laba kotor kumulatif sejak tanggal modal awal. */
  grossProfit: number
  /** Piutang: utang pelanggan yang belum lunas. */
  openDebt: number
  /** Perkiraan posisi modal sekarang. */
  estimatedNow: number
  /** Selisih terhadap modal awal (positif = bertambah). */
  change: number
  verdict: "naik" | "turun" | "seimbang"
  message: string
}

export function bacaModalAwal(): ModalAwal | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    const mentah = window.localStorage.getItem(KUNCI)
    if (!mentah) return null
    const parsed = JSON.parse(mentah) as ModalAwal
    if (!parsed || !Number.isFinite(parsed.amount) || parsed.amount <= 0) return null
    // Tanggal yang tidak sah membuat halaman Modal Awal mati total, jadi
    // dikembalikan sebagai kosong: artinya "sejak awal".
    const since =
      typeof parsed.since === "string" && /\d{4}-\d{2}-\d{2}$/.test(parsed.since)
        ? parsed.since
        : ""
    return { amount: parsed.amount, since }
  } catch {
    return null
  }
}

export function simpanModalAwal(input: ModalAwal | null): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return
    if (!input) {
      window.localStorage.removeItem(KUNCI)
      return
    }
    window.localStorage.setItem(KUNCI, JSON.stringify(input))
  } catch {
    // Penyimpanan diblokir: nilainya tetap dipakai di sesi ini.
  }
}

/**
 * Apakah transaksi terjadi pada tanggal modal awal atau sesudahnya.
 *
 * Tanggal dibandingkan di zona waktu warung. Kalau dibotong dari string
 * ISO (yang dalam UTC), penjualan jam 00:30 WIB terhitung tanggal
 * sebelumnya dan laba kotornya keluar dari hitungan.
 */
function setelahTanggal(iso: string, since: string): boolean {
  if (!since) return true
  return tanggalWib(iso) >= since
}

/**
 * Susun laporan posisi modal.
 *
 * estimatedNow = nilai stok sekarang + laba kotor kumulatif + utang belum lunas.
 *
 * Yang dipakai untuk "nilai stok" adalah stok SEKARANG, bukan stok awal:
 * uang yang dipakai untuk kulakan sudah jadi barang di rak, dan barang yang
 * sudah laku sudah masuk laba kotor. Kalau memakai stok awal, barang yang
 * sudah terjual dihitung dua kali: sekali di laba, sekali di stok.
 *
 * Uang tunai di laci tidak ikut dihitung (belum ada catatan kas harian) -
 * itu sebabnya hasilnya disebut "perkiraan".
 */
export function susunLaporanModal(
  input: ModalAwal,
  stokBarang: StokBarang[],
  transaksi: Transaksi[],
  baris: BarisTransaksi[],
  utang: UtangBerjalan[],
): LaporanModal {
  const { since } = input

  const hargaModal = new Map(stokBarang.map((s) => [s.barang_id, s.harga_modal]))
  const stockValue = stokBarang.reduce((sum, s) => sum + s.stok * s.harga_modal, 0)

  let grossProfit = 0
  for (const transaksiJual of transaksi) {
    if (transaksiJual.tipe !== "jual") continue
    if (!setelahTanggal(transaksiJual.tanggal, since)) continue
    const barisJual = baris.filter((b) => b.transaksi_id === transaksiJual.id)
    for (const barisSatu of barisJual) {
      const pendapatan = barisSatu.jumlah * barisSatu.harga_satuan
      const modal = barisSatu.jumlah * (hargaModal.get(barisSatu.barang_id) ?? 0)
      grossProfit += pendapatan - modal
    }
  }

  const openDebt = utang.reduce((sum, u) => sum + Math.max(u.total - u.dibayar, 0), 0)

  const estimatedNow = stockValue + grossProfit + openDebt
  const change = estimatedNow - input.amount
  const verdict: LaporanModal["verdict"] =
    change > 1000 ? "naik" : change < -1000 ? "turun" : "seimbang"

  let message: string
  if (verdict === "naik") {
    message = `Modal Anda bertambah ${rupiah(Math.abs(change))} sejak ${
      since === "" ? "awal" : since
    }.`
  } else if (verdict === "turun") {
    message = `Modal Anda berkurang ${rupiah(Math.abs(change))} sejak ${
      since === "" ? "awal" : since
    }. Cek barang hilang, harga jual, atau utang yang belum tertagih.`
  } else {
    message = "Posisi modal masih sama dengan modal awal."
  }

  return {
    initial: input.amount,
    since,
    stockValue: round2(stockValue),
    grossProfit: round2(grossProfit),
    openDebt: round2(openDebt),
    estimatedNow: round2(estimatedNow),
    change: round2(change),
    verdict,
    message: `${message} Belum termasuk uang tunai di laci.`,
  }
}
