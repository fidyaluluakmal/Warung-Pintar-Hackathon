/**
 * Logika asisten warung.
 *
 * Modul ini murni: tanpa React, tanpa jaringan, tanpa database. Jadi bisa
 * diuji sendiri, dan halaman yang memakainya tetap ramping.
 *
 * Yang dihitung di sini:
 *  - pengelompokan sesi per waktu (ala "Hari ini / Kemarin / 7 hari"),
 *  - judul sesi otomatis dari pertanyaan pertama,
 *  - sapaan pembuka yang memakai nama pemilik,
 *  - daftar pertanyaan cepat yang paling relevan.
 */

import { selisihHari } from "./calendar"
import type {
  BarisTransaksi,
  Barang,
  Proyek,
  SesiAsisten,
  SaranBeli,
  StokBarang,
  Transaksi,
  UtangBerjalan,
} from "./types"

/** Satu percakapan beserta proyeknya. */
export interface SesiLengkap extends SesiAsisten {
  /** Jumlah pesan di sesi ini. */
  jumlahPesan: number
}

/** Kumpulan sesi yang dikelompokkan untuk ditampilkan di sidebar. */
export interface KelompokSesi {
  /** Judul kelompok, mis. "Hari ini". */
  label: string
  /** Kunci pengelompokan, untuk membandingkan tanpa membandingkan teks. */
  kunci: string
  sesi: SesiLengkap[]
}

/** Batas jumlah sesi yang ditampilkan di sidebar. */
export const BATAS_SESI_SIDEBAR = 40

/**
 * Batas panjang pertanyaan.
 *
 * Edge Function `ai-ask` menolak di atas 300 karakter dengan status 400.
 * Batas yang sama dipasang di sini, jadi kegagalan terjadi sebelum dikirim dan
 * pesannya bisa dijelaskan.
 */
export const BATAS_PERTANYAAN = 300

/**
 * Judul otomatis dari pertanyaan pertama.
 *
 * Dipotong di batas kata supaya tidak jadi satu baris panjang. Kalau
 * pertanyaannya terlalu pendek, pakai kalimat utuh.
 */
export function judulOtomatis(pertanyaan: string): string {
  const bersih = pertanyaan.replace(/\s+/g, " ").trim()
  if (!bersih) return "Sesi baru"
  if (bersih.length <= 42) return bersih
  const potong = bersih.slice(0, 42)
  const batas = potong.lastIndexOf(" ")
  return `${(batas > 20 ? potong.slice(0, batas) : potong).trim()}…`
}

/** Sapaan yang biasa dipakai buat orang Indonesia. */
const SAPAAN = ["pak", "bu", "mas", "bpk", "sdr", "h", "hj", "drs", "ir"]

/**
 * Nama yang enak dipanggil.
 *
 * "Pak Andi Warung Sumber Rejeki" jadi "Pak Andi": sapaan ikut nama depan,
 * bukan dipotong di tengah. Kalau nama diawali sapaan, sapaannya ikut
 * diambil: "Pak" saja bukan nama orang.
 */
export function namaPendek(nama: string | null | undefined): string {
  const bersih = (nama ?? "").trim().replace(/\s+/g, " ")
  if (!bersih) return ""
  const kata = bersih.split(" ")
  if (kata.length === 1) return kata[0]
  const pertama = kata[0].toLowerCase().replace(/[.,]/g, "")
  if (SAPAAN.includes(pertama)) return `${kata[0]} ${kata[1]}`
  return kata[0]
}

/**
 * Sapaan pembuka.
 *
 * Memakai nama pemilik warung, jadi terasa seperti orang yang membantu,
 * bukan formulir.
 */
export function sapaan(namaPemilik: string | null | undefined): string {
  const nama = namaPendek(namaPemilik)
  if (!nama) return "Halo, siap untuk bertanya?"
  return `Halo ${nama}, siap untuk bertanya?`
}

/**
 * Kelompokkan sesi per waktu.
 *
 * Urutannya: hari ini, kemarin, 7 hari terakhir, lalu sisanya. Adegan seperti
 * ChatGPT, tapi mengikuti kalender warung (Asia/Jakarta).
 */
export function kelompokkanSesi(
  sesi: SesiLengkap[],
  sekarang: Date = new Date(),
): KelompokSesi[] {
  const buckets = new Map<string, { label: string; kunci: string; sesi: SesiLengkap[] }>()

  const urutan: Array<{ kunci: string; label: string; batas: number }> = [
    { kunci: "hari-ini", label: "Hari ini", batas: 0 },
    { kunci: "kemarin", label: "Kemarin", batas: 1 },
    // Batas 6, bukan 7: hari ini dan kemarin sudah ambil dua hari, jadi
    // kelompok ini menutup 2..6 -- tujuh hari altogether.
    { kunci: "minggu", label: "7 hari terakhir", batas: 6 },
  ]

  for (const item of sesi) {
    const umur = umurHari(item.diperbarui_pada, sekarang)
    let group = urutan.find((g) => umur <= g.batas)
    if (!group) group = { kunci: "lama", label: "Lebih lama", batas: 3650 }

    const bucket = buckets.get(group.kunci) ?? {
      label: group.label,
      kunci: group.kunci,
      sesi: [],
    }
    bucket.sesi.push(item)
    buckets.set(group.kunci, bucket)
  }

  // Sesi terbaru dulu di dalam tiap kelompok.
  for (const bucket of buckets.values()) {
    bucket.sesi.sort((a, b) => b.diperbarui_pada.localeCompare(a.diperbarui_pada))
  }

  return urutan
    .filter((g) => buckets.has(g.kunci))
    .map((g) => buckets.get(g.kunci)!)
    .concat(buckets.has("lama") ? [buckets.get("lama")!] : [])
}

/**
 * Umur sebuah sesi dalam hari, dihitung di zona waktu warung.
 *
 * Memakai `selisihHari` dari kalender, bukan menyalin perhitungannya: dua
 * versi yang berbeda pasti akan berbeda someday.
 */
export function umurHari(iso: string, sekarang: Date = new Date()): number {
  return Math.max(0, selisihHari(iso, sekarang))
}

/** Proyek yang dipakai sebuah sesi. */
export function proyekSesi(
  sesi: SesiLengkap[],
  proyekId: string | null,
): SesiLengkap[] {
  if (!proyekId) return []
  return sesi.filter((s) => s.proyek_id === proyekId)
}

/**
 * Instruksi proyek yang berlaku untuk sebuah sesi.
 *
 * Kalau sesi tidak punya proyek, tidak ada instruksi tambahan: dan ini
 * yang dikirim ke AI.
 */
export function instruksiUntukSesi(
  sesi: SesiLengkap | null,
  proyek: Proyek[],
): string {
  if (!sesi || !sesi.proyek_id) return ""
  const cari = proyek.find((p) => p.id === sesi.proyek_id)
  return (cari?.instruksi ?? "").trim()
}

/**
 * Urutkan proyek: yang paling baru dipakai lebih dulu.
 *
 * Proyek tanpa sesi tidak ditampilkan di urutan pertama: tapi tetap ada,
 * supaya tidak hilang begitu semua sesinya dihapus.
 */
export function urutProyek(
  proyek: Proyek[],
  sesi: SesiLengkap[],
): Proyek[] {
  const dipakai = new Map<string, string>()
  for (const item of sesi) {
    if (!item.proyek_id) continue
    const sekarang = dipakai.get(item.proyek_id)
    if (!sekarang || item.diperbarui_pada > sekarang) {
      dipakai.set(item.proyek_id, item.diperbarui_pada)
    }
  }
  return [...proyek].sort((a, b) => {
    const pa = dipakai.get(a.id) ?? ""
    const pb = dipakai.get(b.id) ?? ""
    if (pa !== pb) return pb.localeCompare(pa)
    return b.dibuat_pada.localeCompare(a.dibuat_pada)
  })
}

/** Sesi yang belum punya proyek, untuk daftar utama di sidebar. */
export function sesiTanpaProyek(sesi: SesiLengkap[]): SesiLengkap[] {
  return sesi.filter((s) => !s.proyek_id)
}

/** Nama proyek yang masih kosong. */
export function namaProyekDefault(namaPemilik: string | null | undefined): string {
  const nama = namaPendek(namaPemilik)
  if (!nama) return "Proyek warung"
  return `Proyek ${nama}`
}

/* -------------------------------------------------------------------------- */
/* Konteks untuk AI                                                           */
/* -------------------------------------------------------------------------- */

/** Data warung yang dikirim ke AI sebagai konteks. */
export interface DataKonteks {
  transaksi: Transaksi[]
  baris: BarisTransaksi[]
  barang: Barang[]
  stok: StokBarang[]
  utang: UtangBerjalan[]
  saranBeli: SaranBeli[]
}

/** Bentuk konteks yang dikirim ke Edge Function. */
export interface KonteksAsisten {
  omzetHariIni: number
  labaKotorHariIni: number
  transaksiHariIni: number
  omzetMingguIni: number
  labaKotorMingguIni: number
  stokTipis: Array<{ nama: string; stok: number; satuan: string }>
  saranBeli: Array<{ nama: string; qty: number; satuan: string }>
  pelangganUtang: Array<{ nama: string; sisa: number }>
  totalTransaksi: number
  jumlahBaris: number
}

/**
 * Susun konteks untuk AI.
 *
 * Semua angka dihitung di sini, bukan oleh model. Model cuma menyusun
 * kalimat: jadi tidak mungkin mengarang angka.
 */
export function bangunKonteks(data: DataKonteks, sekarang: Date = new Date()): KonteksAsisten {
  const modeBarang = new Map(data.barang.map((b) => [b.id, b.harga_modal]))
  const tipeById = new Map(data.transaksi.map((t) => [t.id, t.tipe]))

  /** Omzet dan laba kotor dari sekumpulan transaksi. */
  const hitung = (daftar: Transaksi[]) => {
    const ids = new Set(daftar.map((t) => t.id))
    let modal = 0
    for (const row of data.baris) {
      if (!ids.has(row.transaksi_id)) continue
      if (tipeById.get(row.transaksi_id) !== "jual") continue
      modal += row.jumlah * (modeBarang.get(row.barang_id) ?? 0)
    }
    const omzet = daftar.reduce((sum, t) => sum + t.total, 0)
    return { omzet, labaKotor: omzet - modal }
  }

  const jual = data.transaksi.filter((t) => t.tipe === "jual")
  const hariIni = jual.filter((t) => selisihHari(t.tanggal, sekarang) === 0)
  // 7 hari terakhir di kalender warung, bukan 168 jam.
  const mingguIni = jual.filter((t) => selisihHari(t.tanggal, sekarang) < 7)

  const hari = hitung(hariIni)
  const minggu = hitung(mingguIni)

  const perluRestok = new Set(data.saranBeli.map((s) => s.barangId))
  const stokTipis = data.stok.filter((s) => perluRestok.has(s.barang_id))

  return {
    omzetHariIni: hari.omzet,
    labaKotorHariIni: hari.labaKotor,
    transaksiHariIni: hariIni.length,
    omzetMingguIni: minggu.omzet,
    labaKotorMingguIni: minggu.labaKotor,
    stokTipis: stokTipis.map((s) => ({ nama: s.nama, stok: s.stok, satuan: s.satuan })),
    saranBeli: data.saranBeli.map((s) => ({ nama: s.nama, qty: s.qty, satuan: s.satuan })),
    pelangganUtang: data.utang
      .filter((u) => u.status === "belum_lunas")
      .map((u) => ({ nama: u.pelanggan, sisa: Math.max(u.total - u.dibayar, 0) })),
    totalTransaksi: data.transaksi.length,
    jumlahBaris: data.baris.length,
  }
}

/** Pertanyaan cepat yang ditawarkan di layar kosong. */
export const PERTANYAAN_CEPAT = [
  "Beli apa besok?",
  "Stok apa yang hampir habis?",
  "Omzet hari ini berapa?",
  "Berapa laba kotor 7 hari?",
  "Siapa yang paling banyak utang?",
]
