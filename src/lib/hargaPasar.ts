/**
 * Harga Pasar: bandingkan modal sendiri dengan harga barang di tempat lain.
 *
 * Warung kecil belanja sambil banding-banding: "di tempat lain beras 15
 * ribu, di sini 14 ribu". Catatan seperti itu biasanya cuma ingatan di
 * kepala, lalu hilang. Di sini dicatat, dibandingkan dengan modal sendiri,
 * lalu jadi saran harga jual.
 *
 * Modul ini murni: masuk dan keluar sama, tanpa database atau jaringan.
 * Semua angka berasal dari harga yang dicatat pemilik warung: tidak ada
 * angka yang dikarang.
 *
 * Perhitungan harga jual memakai mesin yang sama dengan Penjaga Margin
 * (`src/lib/margin.ts`), jadi angka antar layar tidak berbeda.
 */

import { rupiah } from "./format"
import { MARGIN_TARGET, hargaJualUntukMargin, marginPersen } from "./margin"
import { round2 } from "./inventory"

/** Batas selisih yang masih dianggap "sepat" (hampir sama). */
export const TOLERANSI_SEPAK_PERSEN = 1

/** Catatan harga yang lebih dari ini hari sudah dianggap data lama. */
export const BATASAN_KEDALUWARSA_HARI = 7

/** Satu catatan: harga barang yang sama, dilihat di tempat lain. */
export interface CatatanHargaPasar {
  id: string
  barangId: string
  /** Harga yang dicatat, per satuan barang. */
  harga: number
  /** Nama toko atau agen. Boleh kosong. */
  tempat: string | null
  /** Kapan dicatat (ISO). */
  tanggal: string
}

/** Barang warung yang dibandingkan dengan harga pasar. */
export interface BarangPasar {
  id: string
  nama: string
  satuan: string
  /** Harga modal sendiri: dasar perbandingan. */
  hargaModal: number
  /** Harga jual yang sedang dipakai. */
  hargaJual: number
}

/** Hasil perbandingan satu barang. */
export interface PerbandinganPasar {
  barangId: string
  nama: string
  satuan: string
  hargaModal: number
  hargaJual: number
  /** Harga termurah yang pernah dicatat. */
  hargaTermurah: number
  /** Rata-rata semua harga yang dicatat. */
  hargaRataRata: number
  /** Catatan yang paling berguna ditampilkan: paling baru. */
  catatanTerpakai: CatatanHargaPasar | null
  jumlahCatatan: number
  /**
   * Selisih bertanda, dalam persen.
   *
   * Positif = harga di luar lebih murah dari modal sendiri (hemat).
   * Negatif = harga di luar lebih mahal.
   * Dasarnya modal sendiri: "berapa persen modal Anda di atas harga luar".
   */
  selisihPersen: number
  /** Selisih yang sama, kalau dibandingkan dengan rata-rata harga luar. */
  selisihRataRataPersen: number
  /** Umur catatan yang dipakai, dalam hari. */
  umurHari: number
}

/** Saran harga jual beserta alasannya. */
export interface SaranHargaJual {
  /** Harga jual yang menjaga margin target dari modal sendiri. */
  hargaJual: number
  /** Margin persen pada harga jual itu. */
  marginPersen: number
  /** Kalau barangnya dibeli di harga luar, harga jual seperti apa. */
  hargaJualBeliDiLuar: number
  /** "modal Anda lebih murah" / "di luar lebih murah" / "sepat". */
  verdict: string
  /** Penjelasan singkat, pakai angka. */
  alasan: string
}

/** Ringkasan untuk kartu angka di layar. */
export interface RingkasanHargaPasar {
  /** Jumlah barang yang punya data harga pasar. */
  jumlahBarang: number
  /** Rata-rata hemat (%) kalau di luar lebih murah. */
  rataRataHemat: number
  /** Jumlah catatan yang sudah lebih dari 7 hari. */
  jumlahKedaluwarsa: number
}

/**
 * Bandingkan modal sendiri dengan harga pasar satu barang.
 *
 * Yang dibandingkan:
 *  - harga termurah yang pernah dicatat (hemat paling besar)
 *  - rata-rata semua catatan (gambaran harga pasar sebenarnya)
 *  - selisih bertanda terhadap modal sendiri
 *
 * Catatan yang dipakai untuk ditampilkan adalah yang paling baru. Kalau
 * tanggalnya sama, yang lebih murah yang ditampilkan.
 */
export function bandingkanHargaPasar(
  barang: BarangPasar,
  catatan: CatatanHargaPasar[],
  sekarang: Date = new Date(),
): PerbandinganPasar {
  const milik = catatan.filter(
    (item) =>
      item.barangId === barang.id && Number.isFinite(item.harga) && item.harga >= 0,
  )

  const hargaTermurah = milik.length ? Math.min(...milik.map((item) => item.harga)) : 0
  const hargaRataRata = milik.length
    ? round2(milik.reduce((sum, item) => sum + item.harga, 0) / milik.length)
    : 0
  const catatanTerpakai = pilihHargaPasar(milik)
  // Tanpa catatan tidak ada harga pasar untuk dibandingkan, jadi selisihnya 0
  // (bukan "hemat 100%").
  const adaCatatan = milik.length > 0

  return {
    barangId: barang.id,
    nama: barang.nama,
    satuan: barang.satuan,
    hargaModal: barang.hargaModal,
    hargaJual: barang.hargaJual,
    hargaTermurah,
    hargaRataRata,
    catatanTerpakai,
    jumlahCatatan: milik.length,
    selisihPersen: adaCatatan ? selisihPersen(barang.hargaModal, hargaTermurah) : 0,
    selisihRataRataPersen: adaCatatan ? selisihPersen(barang.hargaModal, hargaRataRata) : 0,
    umurHari: catatanTerpakai ? hariLewat(catatanTerpakai.tanggal, sekarang) : 0,
  }
}

/**
 * Saran harga jual dari modal sendiri dan harga di tempat lain.
 *
 * Harga jualnya dihitung dari modal sendiri (`hargaJualUntukMargin`), jadi
 * margin target tetap terjaga. Harga pasar cuma dipakai untuk memberi
 * gambaran: kalau barangnya dibeli di luar, harga jualnya bisa berapa.
 */
export function saranHargaJual(
  hargaModal: number,
  hargaPasar: number,
  marginTarget: number = MARGIN_TARGET,
): SaranHargaJual {
  const hargaJual = hargaJualUntukMargin(hargaModal, marginTarget)
  const hargaJualBeliDiLuar = hargaJualUntukMargin(hargaPasar, marginTarget)
  const selisih = selisihPersen(hargaModal, hargaPasar)

  if (hargaModal <= 0) {
    return {
      hargaJual: 0,
      marginPersen: 0,
      hargaJualBeliDiLuar,
      verdict: "modal belum diisi",
      alasan: "Harga modal barang ini belum diisi, jadi harga jualnya belum bisa dihitung.",
    }
  }

  let verdict: string
  let alasan: string

  if (Math.abs(selisih) < TOLERANSI_SEPAK_PERSEN) {
    verdict = "sepat"
    alasan = `Harganya hampir sama: modal ${rupiah(hargaModal)}, di luar ${rupiah(hargaPasar)}. Jual di ${rupiah(hargaJual)} supaya margin ${marginTarget}% tetap aman.`
  } else if (selisih > 0) {
    // Selisih positif = modal sendiri lebih mahal, jadi di luar lebih murah.
    verdict = "di luar lebih murah"
    alasan = `Di luar ${rupiah(hargaPasar)}, modal Anda ${rupiah(hargaModal)}. Kalau belanja di sana, baru bisa jual di ${rupiah(hargaJualBeliDiLuar)}.`
  } else {
    verdict = "modal Anda lebih murah"
    alasan = `Modal Anda ${rupiah(hargaModal)}, di luar ${rupiah(hargaPasar)}. Jual di ${rupiah(hargaJual)} supaya margin ${marginTarget}% tetap aman.`
  }

  return {
    hargaJual,
    marginPersen: marginPersen(hargaJual, hargaModal),
    hargaJualBeliDiLuar,
    verdict,
    alasan,
  }
}

/**
 * Catatan yang paling berguna ditampilkan: paling baru.
 *
 * Kalau dua catatan bertanggal sama, yang lebih murah yang dipilih -
 * harga termurah biasanya yang paling menarik buat pemilik warung.
 */
export function pilihHargaPasar(catatan: CatatanHargaPasar[]): CatatanHargaPasar | null {
  if (catatan.length === 0) return null

  const urut = [...catatan].sort((a, b) => {
    const selisihWaktu = waktuCatatan(b) - waktuCatatan(a)
    if (selisihWaktu !== 0) return selisihWaktu
    return a.harga - b.harga
  })

  return urut[0]
}

/** Berapa hari sejak harga itu dicatat. */
export function hariLewat(tanggal: string, sekarang: Date = new Date()): number {
  const selisih = hariJakarta(sekarang) - hariJakarta(tanggal)
  if (!Number.isFinite(selisih)) return 0
  return Math.max(0, Math.round(selisih / 86_400_000))
}

/**
 * Label kesegaran data harga, dalam bahasa sehari-hari.
 *
 * "hari ini", "kemarin", "3 hari lalu", dan "data lama" kalau sudah lewat
 * seminggu: harga pasar berubah cepat, jadi data lama perlu dicek lagi.
 */
export function labelKesegaran(tanggal: string, sekarang: Date = new Date()): string {
  const umur = hariLewat(tanggal, sekarang)
  if (umur <= 0) return "hari ini"
  if (umur === 1) return "kemarin"
  if (umur <= BATASAN_KEDALUWARSA_HARI) return `${umur} hari lalu`
  return "data lama"
}

/**
 * Ringkasan angka untuk kartu di layar.
 *
 * Rata-rata hemat dihitung dari barang yang di luar lebih murah saja -
 * barang yang di luar lebih mahal bukan penghematan.
 */
export function hitungRingkasan(
  perbandingan: PerbandinganPasar[],
  catatan: CatatanHargaPasar[],
  sekarang: Date = new Date(),
): RingkasanHargaPasar {
  const barang = perbandingan.filter((item) => item.jumlahCatatan > 0)
  const yangHemat = barang.filter((item) => item.selisihPersen > 0)

  const rataRataHemat = yangHemat.length
    ? round2(
        yangHemat.reduce((sum, item) => sum + item.selisihPersen, 0) / yangHemat.length,
      )
    : 0

  return {
    jumlahBarang: barang.length,
    rataRataHemat,
    jumlahKedaluwarsa: catatan.filter(
      (item) => hariLewat(item.tanggal, sekarang) > BATASAN_KEDALUWARSA_HARI,
    ).length,
  }
}

/**
 * Selisih bertanda antara modal sendiri dan harga pasar.
 *
 * Dasar = modal sendiri. Positif berarti harga di luar lebih murah.
 */
export function selisihPersen(hargaModal: number, hargaPasar: number): number {
  if (hargaModal <= 0) return 0
  return round2(((hargaModal - hargaPasar) / hargaModal) * 100)
}

/** Waktu catatan, dalam milidetik. Tanggal rusak dianggap paling tua. */
function waktuCatatan(catatan: CatatanHargaPasar): number {
  const waktu = new Date(catatan.tanggal).getTime()
  return Number.isFinite(waktu) ? waktu : 0
}

/**
 * Tanggal menurut zona waktu warung (Asia/Jakarta), dihitung sebagai
 * tengah malam UTC: jadi selisihnya murni selisih hari kalender.
 */
function hariJakarta(nilai: string | Date): number {
  const waktu = typeof nilai === "string" ? new Date(nilai) : nilai
  if (!Number.isFinite(waktu.getTime())) return Number.NaN

  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(waktu)

  const [tahun, bulan, hari] = bagian.split("-").map(Number)
  return Date.UTC(tahun, bulan - 1, hari)
}
