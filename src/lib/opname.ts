/**
 * Cek Stok (opname): bandingkan stok fisik dengan stok sistem.
 *
 * Warung kecil tidak punya pemindai barcode seperti minimarket. Stok sering
 * meleset tanpa disadari: ada yang telat dicatat, ada yang diambil tanpa
 * dibayar, ada juga barang rusak lalu dibuang. Kalau barang hilang sedikit
 * demi sedikit, lama-lama warung tumbuh tapi uangnya tidak.
 *
 * Hitungan fisik membuat selisih itu kelihatan. Modul ini murni: tidak
 * membaca database dan tidak menulis apa pun, jadi bisa diuji dan dipakai
 * di layar manapun.
 *
 * Aturan:
 *  - selisih = stok fisik − stok sistem
 *  - selisih negatif = barang hilang (dicatat sebagai penyesuaian negatif)
 *  - selisih positif = barang lebih (misal ditemukan lagi atau salah catat)
 *  - barang yang selisihnya nol tidak ikut disimpan sebagai penyesuaian
 */

import type { Satuan } from "./types"

/** Satu barang yang siap dihitung fisiknya. */
export interface BarangOpname {
  barangId: string
  nama: string
  satuan: Satuan
  /** Stok menurut sistem, dari view `stok_barang`. */
  stokSistem: number
  /** Harga modal per satuan, dipakai menghitung nilai selisih. */
  hargaModal: number
}

/** Status selisih satu barang. */
export type StatusSelisih = "belum" | "cocok" | "kurang" | "lebih"

/** Hasil hitung fisik satu barang. */
export interface HasilOpname {
  barangId: string
  nama: string
  satuan: Satuan
  /** Stok menurut sistem. */
  stokSistem: number
  /** Harga modal per satuan. */
  hargaModal: number
  /** Jumlah hasil hitung fisik; null kalau belum dihitung. */
  stokFisik: number | null
  /** Fisik − sistem; null kalau belum dihitung. */
  selisih: number | null
  status: StatusSelisih
  /** true kalau sudah dihitung dan selisihnya bukan nol. */
  beda: boolean
  /** Nilai selisih dalam rupiah, bertanda: negatif = barang hilang. */
  nilaiSelisih: number
  /** Alasan singkat bahasa sehari-hari. */
  alasan: string
}

/** Sesi hitung stok fisik. */
export interface SesiOpname {
  /** Kapan sesi dibuka (ISO). */
  mulaiPada: string
  /** Daftar barang yang dihitung. */
  barang: BarangOpname[]
  /** Hasil hitung fisik per barang_id. */
  hitungan: Record<string, number>
}

/** Satu baris penyesuaian yang siap disimpan ke database. */
export interface BarisPenyesuaian {
  barangId: string
  nama: string
  satuan: Satuan
  /** Selisih bertanda: negatif = stok hilang, positif = stok lebih. */
  delta: number
  /** Harga modal per satuan. */
  hargaSatuan: number
  /** Nilai delta dalam rupiah, bertanda. */
  nilai: number
}

/** Ringkasan satu sesi hitung stok. */
export interface RingkasanOpname {
  /** Berapa barang yang sudah dihitung fisik. */
  barangDihitung: number
  /** Berapa barang yang selisihnya bukan nol. */
  barangBeda: number
  /** Total nilai barang yang hilang (selisih negatif), dalam rupiah. */
  nilaiSusut: number
  /** Total nilai barang yang lebih (selisih positif), dalam rupiah. */
  nilaiLebih: number
  /** Selisih bersih: nilai lebih dikurangi nilai susut. */
  nilaiBersih: number
  /** Rincian barang yang berbeda, lengkap dengan alasannya. */
  rincian: HasilOpname[]
}

/**
 * Mulai sesi hitung stok baru.
 *
 * Sesi baru selalu kosong: belum ada barang yang dihitung fisik.
 */
export function mulaiSesiOpname(
  barang: BarangOpname[],
  mulaiPada: string = new Date().toISOString(),
): SesiOpname {
  return {
    mulaiPada,
    barang: barang.map((b) => ({ ...b })),
    hitungan: {},
  }
}

/**
 * Catat hasil hitung fisik satu barang.
 *
 * Sesi lama tidak diubah: fungsi ini mengembalikan sesi baru.
 */
export function catatHitung(
  sesi: SesiOpname,
  barangId: string,
  stokFisik: number,
): SesiOpname {
  if (!Number.isFinite(stokFisik)) return sesi
  return {
    ...sesi,
    hitungan: { ...sesi.hitungan, [barangId]: round2(stokFisik) },
  }
}

/** Hapus hasil hitung satu barang (kolom dikosongkan lagi). */
export function hapusHitung(sesi: SesiOpname, barangId: string): SesiOpname {
  if (!(barangId in sesi.hitungan)) return sesi
  const hitungan = { ...sesi.hitungan }
  delete hitungan[barangId]
  return { ...sesi, hitungan }
}

/** Selisih antara hasil hitung fisik dan stok sistem. */
export function hitungSelisih(stokSistem: number, stokFisik: number): number {
  return round2(stokFisik - stokSistem)
}

/**
 * Hitung hasil opname untuk semua barang dalam sesi.
 *
 * Barang yang belum dihitung tetap ikut muncul, dengan status "belum".
 */
export function hitungOpname(sesi: SesiOpname): HasilOpname[] {
  return sesi.barang.map((barang) => hitungSatuBarang(barang, sesi.hitungan[barang.barangId]))
}

function hitungSatuBarang(barang: BarangOpname, stokFisik: number | undefined): HasilOpname {
  const dasar: HasilOpname = {
    barangId: barang.barangId,
    nama: barang.nama,
    satuan: barang.satuan,
    stokSistem: round2(barang.stokSistem),
    hargaModal: round2(barang.hargaModal),
    stokFisik: null,
    selisih: null,
    status: "belum",
    beda: false,
    nilaiSelisih: 0,
    alasan: "Belum dihitung. Isi jumlah barang yang benar-benar ada di rak.",
  }

  if (stokFisik === undefined || !Number.isFinite(stokFisik)) return dasar

  const fisik = round2(stokFisik)
  const selisih = hitungSelisih(dasar.stokSistem, fisik)

  return {
    ...dasar,
    stokFisik: fisik,
    selisih,
    status: statusSelisih(selisih),
    beda: selisih !== 0,
    nilaiSelisih: round2(selisih * dasar.hargaModal),
    alasan: alasanSelisih({
      nama: barang.nama,
      satuan: barang.satuan,
      stokSistem: dasar.stokSistem,
      stokFisik: fisik,
      selisih,
    }),
  }
}

/** Status selisih dari angkanya. */
export function statusSelisih(selisih: number | null): StatusSelisih {
  if (selisih === null || !Number.isFinite(selisih)) return "belum"
  if (selisih === 0) return "cocok"
  return selisih < 0 ? "kurang" : "lebih"
}

/**
 * Alasan singkat untuk satu barang, bahasa sehari-hari pemilik warung.
 */
export function alasanSelisih(item: {
  nama: string
  satuan: Satuan
  stokSistem: number
  stokFisik: number
  selisih: number
}): string {
  const selisih = round2(item.selisih)

  if (selisih === 0) {
    return `Sama persis dengan stok sistem, jadi ${item.nama} tidak ada yang hilang.`
  }

  if (selisih < 0) {
    return `Kurang ${formatJumlah(Math.abs(selisih))} ${item.satuan} dari stok sistem. Dicatat sebagai penyesuaian supaya angka stok kembali benar.`
  }

  return `Lebih ${formatJumlah(selisih)} ${item.satuan} dari stok sistem. Mungkin barangnya ketemu lagi, atau sebelumnya ada yang salah catat.`
}

/**
 * Baris penyesuaian yang harus disimpan.
 *
 * Barang yang selisihnya nol (atau belum dihitung) tidak ikut: penyesuaian
 * dibuat hanya untuk barang yang benar-benar berubah.
 */
export function barisPenyesuaian(hasil: HasilOpname[]): BarisPenyesuaian[] {
  return hasil
    .filter((item) => item.selisih !== null && item.selisih !== 0)
    .map((item) => ({
      barangId: item.barangId,
      nama: item.nama,
      satuan: item.satuan,
      delta: item.selisih as number,
      hargaSatuan: item.hargaModal,
      nilai: item.nilaiSelisih,
    }))
}

/**
 * Ringkasan sesi hitung: berapa yang sudah dihitung, berapa yang beda, dan
 * berapa nilai barang yang hilang.
 */
export function ringkasanOpname(hasil: HasilOpname[]): RingkasanOpname {
  const dihitung = hasil.filter((item) => item.selisih !== null)
  const beda = dihitung.filter((item) => item.beda)

  let susut = 0
  let lebih = 0
  for (const item of beda) {
    if ((item.selisih ?? 0) < 0) susut += item.nilaiSelisih
    else lebih += item.nilaiSelisih
  }
  susut = round2(susut)
  lebih = round2(lebih)

  return {
    barangDihitung: dihitung.length,
    barangBeda: beda.length,
    nilaiSusut: Math.abs(susut),
    nilaiLebih: lebih,
    nilaiBersih: round2(lebih + susut),
    rincian: beda,
  }
}

/** Angka untuk alasan: 2,5 tetap 2,5: bukan 2,50. */
function formatJumlah(nilai: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(nilai)
}

/** Pembulatan 2 desimal, menghindari galat floating point. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
