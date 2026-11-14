/**
 * Buku pelanggan — warung mengingat orangnya, bukan cuma angkanya.
 *
 * Pelanggan warung sering tidak punya nomor telepon. Yang ada cuma nama
 * panggilan: "Pak Yono". Karena itu modul ini menjadikan nama panggilan
 * sebagai identitas, lalu menghitung siapa yang datang, berapa belanja,
 * barang favoritnya, dan berapa utangnya.
 *
 * Isi file ini dua bagian:
 *  1. Logika murni — tanpa React, tanpa jaringan, bisa diuji sendiri.
 *  2. Pembacaan dan penyimpanan data lewat Supabase.
 *
 * Cara mengaitkan penjualan dengan pelanggan: tabel `transaksi` tidak punya
 * kolom pelanggan. Jadi penjualan dicocokkan dari `teks_mentah` — kalimat
 * suara atau nota yang menyebut nama panggilan pelanggan. Penjualan yang
 * tidak menyebut pelanggan mana pun dihitung "tanpa pelanggan" dan tidak
 * ikut masuk hitungan per pelanggan.
 */

import { supabase } from "./supabase"
import { ambilSemua } from "./supabaseQuery"
import type { BarisTransaksi, Transaksi } from "./types"

/* --------------------------------------------------------------------- tipe */

export interface DataPelanggan {
  id: string
  owner_id: string | null
  nama: string
  telepon: string | null
  catatan: string | null
  dibuat_pada?: string | null
}

/** Barang cukup nama dan id-nya saja untuk buku pelanggan. */
export interface BarangRingkas {
  id: string
  nama: string
}

/** Baris utang dari tabel `utang` atau view `utang_berjalan`. */
export interface UtangRingkas {
  pelanggan: string
  total: number
  dibayar: number
  status?: string
  /** Tanggal utangnya dibuat. Dipakai untuk menghitung umur utang. */
  tanggal?: string | null
}

/** Satu baris pembelian yang dilakukan pelanggan. */
export interface PembelianPelanggan {
  transaksiId: string
  namaBarang: string
  jumlah: number
  satuan: string
  hargaSatuan: number
  total: number
  tanggal: string
}

/** Semua yang perlu ditampilkan untuk satu pelanggan. */
export interface RingkasanPelanggan {
  id: string
  nama: string
  telepon: string | null
  catatan: string | null
  initials: string
  /** Total belanja = jumlah × harga satuan, dijumlahkan dari semua baris. */
  totalBelanja: number
  /** Banyaknya kunjungan (tiap transaksi jual dihitung sekali). */
  jumlahKunjungan: number
  /** Tanggal kunjungan paling akhir, null kalau belum pernah datang. */
  kunjunganTerakhir: string | null
  /** Barang paling sering diambil, null kalau belum ada pembelian. */
  barangFavorit: string | null
  qtyFavorit: number
  /** Sisa utang yang harus dibayar. */
  totalUtang: number
  /**
   * Tanggal utang paling lama yang masih belum lunas.
   *
   * Dipakai untuk tahu sudah berapa lama pelanggan menunggak. Null kalau
   * pelanggan ini tidak punya utang berjalan.
   */
  utangTerlama: string | null
  labelKunjungan: string
  labelUtang: string
  /** Riwayat pembelian, terbaru dulu. */
  pembelian: PembelianPelanggan[]
}

/* --------------------------------------------------------------- ambang batas */

/** Minimal kunjungan supaya disebut "Rutin datang". */
export const BATAS_RUTIN = 5

/** Lebih dari ini hari tanpa datang = "Jarang datang". */
export const BATAS_JARANG_HARI = 30

/* ------------------------------------------------------------ logika murni */

/**
 * Nama dibersihkan supaya bisa dibandingkan: spasi dirapikan, huruf kecil
 * semua. "  Pak   Yono " dan "pak yono" jadi satu orang.
 */
export function normalisasiNama(nama: string): string {
  return nama.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID")
}

/**
 * Gabung nama-nama yang sama (case-insensitive) jadi satu.
 *
 * Nama yang dipakai untuk ditampilkan mengikuti kemunculan pertama, jadi
 * urutan input menentukan tampilan. "pak yono" dan "Pak Yono" jadi satu nama.
 */
export function gabungNamaDuplikat(daftar: string[]): string[] {
  const seen = new Set<string>()
  const hasil: string[] = []
  for (const nama of daftar) {
    const bersih = nama.trim().replace(/\s+/g, " ")
    if (!bersih) continue
    const kunci = normalisasiNama(bersih)
    if (seen.has(kunci)) continue
    seen.add(kunci)
    hasil.push(bersih)
  }
  return hasil
}

/**
 * Gabung catatan pelanggan yang namanya sama (case-insensitive).
 *
 * Data yang masih kosong diisi dari baris duplikat berikutnya: jadi nomor
 * telepon tetap ketemu walau cuma diisi di salah satu baris.
 */
export function gabungPelangganDuplikat(daftar: DataPelanggan[]): DataPelanggan[] {
  const hasil: DataPelanggan[] = []
  const indeks = new Map<string, number>()

  for (const pelanggan of daftar) {
    const kunci = normalisasiNama(pelanggan.nama)
    if (!kunci) continue
    const posisi = indeks.get(kunci)
    if (posisi === undefined) {
      indeks.set(kunci, hasil.length)
      hasil.push({ ...pelanggan, nama: pelanggan.nama.trim().replace(/\s+/g, " ") })
      continue
    }
    const lama = hasil[posisi]
    hasil[posisi] = {
      ...lama,
      telepon: isiTeks(lama.telepon, pelanggan.telepon),
      catatan: isiTeks(lama.catatan, pelanggan.catatan),
    }
  }

  return hasil
}

/** Isi yang kosong dianggap belum ada, lalu ambil dari cadangan. */
function isiTeks(utama: string | null | undefined, cadangan: string | null | undefined): string | null {
  if (utama && utama.trim()) return utama
  if (cadangan && cadangan.trim()) return cadangan
  return null
}

/**
 * Inisial untuk avatar: huruf pertama dari maksimal dua kata.
 * "Pak Yono" -> "PY", "yono" -> "Y". Nama kosong -> "?".
 */
export function inisialPelanggan(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean)
  if (kata.length === 0) return "?"
  if (kata.length === 1) return (kata[0][0] ?? "?").toLocaleUpperCase("id-ID")
  return `${kata[0][0] ?? ""}${kata[1][0] ?? ""}`.toLocaleUpperCase("id-ID")
}

/**
 * Apakah nama pelanggan disebut di dalam teks (suara / nota)?
 *
 * Dicocokkan per kata dan mengabaikan huruf besar-kecil, jadi "pak yono"
 * ketemu di kalimat "Beli minyak buat pak yono". Nama yang lebih panjang
 * menang kalau ada beberapa yang cocok — lihat `pelangganDariTeks`.
 */
export function cocokNamaPelanggan(teks: string | null | undefined, nama: string): boolean {
  if (!teks) return false
  const target = normalisasiNama(nama)
  if (!target) return false
  const kataTujuan = target.split(" ")
  const kataTeks = normalisasiNama(teks)
    .split(" ")
    .map((kata) => kata.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)

  for (let i = 0; i + kataTujuan.length <= kataTeks.length; i++) {
    let cocok = true
    for (let j = 0; j < kataTujuan.length; j++) {
      if (kataTeks[i + j] !== kataTujuan[j]) {
        cocok = false
        break
      }
    }
    if (cocok) return true
  }
  return false
}

/**
 * Label singkat untuk pelanggan, dari jumlah kunjungan dan kapan dia datang.
 *
 * Aturannya (berturutan):
 *  1. belum pernah datang  -> "Pelanggan baru"
 *  2. kunjungan >= BATAS_RUTIN -> "Rutin datang"
 *  3. terakhir datang lebih dari BATAS_JARANG_HARI hari lalu -> "Jarang datang"
 *  4. tepat satu kunjungan -> "Sekali datang"
 *  5. sisanya -> "Kadang datang"
 */
export function labelKunjungan(
  jumlahKunjungan: number,
  kunjunganTerakhir: string | null,
  hariIni: Date = new Date(),
): string {
  if (jumlahKunjungan <= 0) return "Pelanggan baru"
  if (jumlahKunjungan >= BATAS_RUTIN) return "Rutin datang"
  if (kunjunganTerakhir && selisihHari(kunjunganTerakhir, hariIni) > BATAS_JARANG_HARI) {
    return "Jarang datang"
  }
  if (jumlahKunjungan === 1) return "Sekali datang"
  return "Kadang datang"
}

/** Label utang: masih ada sisa -> "Punya utang", sudah bersih -> "Kulang". */
export function labelUtang(totalUtang: number): string {
  return totalUtang > 0 ? "Punya utang" : "Kulang"
}

/**
 * Selisih hari antara sebuah tanggal dan hari ini, dihitung di zona waktu
 * warung (Asia/Jakarta) — bukan zona waktu perangkat.
 */
export function selisihHari(tanggal: string, hariIni: Date = new Date()): number {
  const dari = hariDalamZonaWarung(tanggal)
  const sampai = hariDalamZonaWarung(hariIni)
  if (!dari || !sampai) return 0
  return Math.round((Date.parse(sampai) - Date.parse(dari)) / 86_400_000)
}

function hariDalamZonaWarung(nilai: string | Date): string {
  const tanggal = typeof nilai === "string" ? new Date(nilai) : nilai
  if (Number.isNaN(tanggal.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tanggal)
}

/**
 * Hitung ringkasan setiap pelanggan.
 *
 * - Total belanja  : jumlah × harga satuan dari setiap baris penjualan.
 * - Kunjungan      : setiap transaksi jual yang menyebut nama pelanggan.
 * - Kunjungan terakhir : tanggal paling akhir dari transaksi itu.
 * - Barang favorit: barang dengan quantity terbanyak yang dibeli pelanggan.
 *   Kalau seri, yang paling sering dibeli; kalau masih seri, urutan nama.
 * - Utang          : sisa (total − dibayar) dari baris utang yang belum lunas.
 */
export function hitungRingkasanPelanggan(
  pelanggan: DataPelanggan[],
  transaksi: Transaksi[],
  baris: BarisTransaksi[],
  barang: BarangRingkas[],
  utang: UtangRingkas[],
  hariIni: Date = new Date(),
): RingkasanPelanggan[] {
  const daftar = gabungPelangganDuplikat(pelanggan)
  const namaBarang = new Map(barang.map((b) => [b.id, b.nama]))

  const barisPerTransaksi = new Map<string, BarisTransaksi[]>()
  for (const row of baris) {
    const list = barisPerTransaksi.get(row.transaksi_id)
    if (list) list.push(row)
    else barisPerTransaksi.set(row.transaksi_id, [row])
  }

  const akumulator = new Map<string, Akumulator>()
  for (const c of daftar) {
    akumulator.set(c.id, {
      pelanggan: c,
      totalBelanja: 0,
      kunjungan: new Set<string>(),
      kunjunganTerakhir: null,
      favorit: new Map<string, { qty: number; kali: number }>(),
      pembelian: [],
      utang: 0,
      utangTerlama: null,
    })
  }

  // Penjualan: cari pelanggan yang disebut di teks mentah.
  for (const t of transaksi) {
    if (t.tipe !== "jual") continue
    const c = pelangganDariTeks(t.teks_mentah, daftar)
    if (!c) continue
    const ak = akumulator.get(c.id)
    if (!ak) continue

    ak.kunjungan.add(t.id)
    if (!ak.kunjunganTerakhir || t.tanggal > ak.kunjunganTerakhir) {
      ak.kunjunganTerakhir = t.tanggal
    }

    for (const row of barisPerTransaksi.get(t.id) ?? []) {
      const totalBaris = round2(row.jumlah * row.harga_satuan)
      ak.totalBelanja = round2(ak.totalBelanja + totalBaris)
      const nama = namaBarang.get(row.barang_id) ?? "Barang"
      ak.pembelian.push({
        transaksiId: t.id,
        namaBarang: nama,
        jumlah: row.jumlah,
        satuan: row.satuan,
        hargaSatuan: row.harga_satuan,
        total: totalBaris,
        tanggal: t.tanggal,
      })
      const fav = ak.favorit.get(nama) ?? { qty: 0, kali: 0 }
      fav.qty = round2(fav.qty + row.jumlah)
      fav.kali += 1
      ak.favorit.set(nama, fav)
    }
  }

  /** Utang: dicocokkan dari nama pada baris utang. */
  const pelangganPerNama = new Map<string, DataPelanggan>()
  for (const c of daftar) pelangganPerNama.set(normalisasiNama(c.nama), c)

  for (const row of utang) {
    // `utang_berjalan` sudah hanya memuat yang belum lunas.
    const c = pelangganPerNama.get(normalisasiNama(row.pelanggan))
    if (!c) continue
    const ak = akumulator.get(c.id)
    if (!ak) continue
    const sisa = Math.max(row.total - row.dibayar, 0)
    if (sisa <= 0) continue
    ak.utang = round2(ak.utang + sisa)
    // Utang paling lama = yang paling lama belum dibayar.
    if (row.tanggal && (!ak.utangTerlama || row.tanggal < ak.utangTerlama)) {
      ak.utangTerlama = row.tanggal
    }
  }

  const hasil: RingkasanPelanggan[] = []
  for (const ak of akumulator.values()) {
    const jumlahKunjungan = ak.kunjungan.size
    const favorit = pilihFavorit(ak.favorit)
    hasil.push({
      id: ak.pelanggan.id,
      nama: ak.pelanggan.nama,
      telepon: ak.pelanggan.telepon,
      catatan: ak.pelanggan.catatan,
      initials: inisialPelanggan(ak.pelanggan.nama),
      totalBelanja: round2(ak.totalBelanja),
      jumlahKunjungan,
      kunjunganTerakhir: ak.kunjunganTerakhir,
      barangFavorit: favorit?.nama ?? null,
      qtyFavorit: favorit?.qty ?? 0,
      totalUtang: round2(ak.utang),
      utangTerlama: ak.utangTerlama,
      labelKunjungan: labelKunjungan(jumlahKunjungan, ak.kunjunganTerakhir, hariIni),
      labelUtang: labelUtang(ak.utang),
      pembelian: [...ak.pembelian].sort((a, b) => {
        if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1
        return a.namaBarang.localeCompare(b.namaBarang, "id")
      }),
    })
  }

  return hasil
}

/**
 * Rata-rata belanja per pelanggan.
 *
 * Yang dihitung cuma pelanggan yang sudah pernah belanja, supaya pelanggan
 * yang baru masuk buku tidak turunin rata-ratanya.
 */
export function rataRataBelanja(daftar: RingkasanPelanggan[]): number {
  const yangBelanja = daftar.filter((p) => p.jumlahKunjungan > 0)
  if (yangBelanja.length === 0) return 0
  const total = yangBelanja.reduce((sum, p) => sum + p.totalBelanja, 0)
  return round2(total / yangBelanja.length)
}

export type UrutanPelanggan = "utang" | "belanja" | "nama"

/** Urutkan daftar pelanggan. Bawaan: yang utangnya paling besar dulu. */
export function urutPelanggan(
  daftar: RingkasanPelanggan[],
  urutan: UrutanPelanggan = "utang",
): RingkasanPelanggan[] {
  const salinan = [...daftar]
  if (urutan === "nama") {
    return salinan.sort((a, b) => a.nama.localeCompare(b.nama, "id"))
  }
  if (urutan === "belanja") {
    return salinan.sort(
      (a, b) => b.totalBelanja - a.totalBelanja || b.totalUtang - a.totalUtang || a.nama.localeCompare(b.nama, "id"),
    )
  }
  return salinan.sort(
    (a, b) => b.totalUtang - a.totalUtang || b.totalBelanja - a.totalBelanja || a.nama.localeCompare(b.nama, "id"),
  )
}

/* ------------------------------------------------------------------ internal */

interface Akumulator {
  pelanggan: DataPelanggan
  totalBelanja: number
  kunjungan: Set<string>
  kunjunganTerakhir: string | null
  favorit: Map<string, { qty: number; kali: number }>
  pembelian: PembelianPelanggan[]
  utang: number
  utangTerlama: string | null
}

/** Pelanggan yang namanya disebut di teks. Nama paling panjang menang. */
function pelangganDariTeks(
  teks: string | null,
  daftar: DataPelanggan[],
): DataPelanggan | null {
  if (!teks) return null
  let terbaik: DataPelanggan | null = null
  for (const c of daftar) {
    if (!cocokNamaPelanggan(teks, c.nama)) continue
    if (!terbaik || c.nama.trim().length > terbaik.nama.trim().length) terbaik = c
  }
  return terbaik
}

/** Barang paling banyak dibeli; seri dipecah lewat jumlah pembelian. */
function pilihFavorit(
  favorit: Map<string, { qty: number; kali: number }>,
): { nama: string; qty: number } | null {
  let terbaik: { nama: string; qty: number; kali: number } | null = null
  for (const [nama, data] of favorit) {
    if (!terbaik) {
      terbaik = { nama, qty: data.qty, kali: data.kali }
      continue
    }
    if (data.qty > terbaik.qty) {
      terbaik = { nama, qty: data.qty, kali: data.kali }
      continue
    }
    if (data.qty === terbaik.qty) {
      if (data.kali > terbaik.kali) {
        terbaik = { nama, qty: data.qty, kali: data.kali }
        continue
      }
      if (data.kali === terbaik.kali && nama.localeCompare(terbaik.nama, "id") < 0) {
        terbaik = { nama, qty: data.qty, kali: data.kali }
      }
    }
  }
  return terbaik ? { nama: terbaik.nama, qty: terbaik.qty } : null
}

/** Pembulatan 2 desimal, menghindari galat floating point. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/* ------------------------------------------------------------- akses database */

export interface DataBukuPelanggan {
  pelanggan: DataPelanggan[]
  transaksi: Transaksi[]
  baris: BarisTransaksi[]
  barang: BarangRingkas[]
  utang: UtangRingkas[]
}

export interface HasilSimpanPelanggan {
  ok: boolean
  pesan: string
}

/**
 * Ambil semua data yang dibutuhkan buku pelanggan.
 *
 * Pembacaan memakai `owner_id` dari sesi, dan RLS database yang memastikan
 * satu akun hanya melihat warungnya sendiri.
 */
export async function muatBukuPelanggan(): Promise<DataBukuPelanggan> {
  if (!supabase) throw new Error("Supabase belum terhubung.")

  const { data: sesi, error: errorSesi } = await supabase.auth.getUser()
  if (errorSesi) throw errorSesi
  const ownerId = sesi.user?.id
  if (!ownerId) throw new Error("Belum masuk ke akun warung.")

  const [daftarPelanggan, daftarTransaksi, daftarBaris, daftarBarang, daftarUtang] =
    await Promise.all([
      supabase.from("pelanggan").select("*").eq("owner_id", ownerId).order("nama"),
      ambilSemua<Transaksi>("transaksi", "*", "tanggal", false, {
        kolom: "owner_id",
        nilai: ownerId,
      }),
      ambilSemua<BarisTransaksi>("baris_transaksi", "*", undefined, false, {
        kolom: "owner_id",
        nilai: ownerId,
      }),
      supabase.from("barang").select("id, nama").eq("owner_id", ownerId),
      supabase.from("utang_berjalan").select("*").eq("owner_id", ownerId),
    ])

  if (daftarPelanggan.error) throw daftarPelanggan.error
  if (daftarBarang.error) throw daftarBarang.error
  if (daftarUtang.error) throw daftarUtang.error

  const barisUtang = (daftarUtang.data ?? []) as Array<{
    pelanggan: string
    total: number
    dibayar: number
    tanggal: string | null
  }>

  return {
    pelanggan: (daftarPelanggan.data ?? []) as DataPelanggan[],
    transaksi: daftarTransaksi.filter((t) => t.tipe === "jual") as Transaksi[],
    baris: daftarBaris,
    barang: (daftarBarang.data ?? []) as BarangRingkas[],
    utang: barisUtang.map((row) => ({
      pelanggan: row.pelanggan,
      total: Number(row.total),
      dibayar: Number(row.dibayar),
      status: "belum_lunas",
      tanggal: row.tanggal ?? null,
    })),
  }
}

/**
 * Simpan pelanggan baru.
 *
 * `owner_id` selalu ikut di payload insert, sesuai aturan satu akun = satu
 * warung. Nama yang sama untuk pemilik yang sama ditolak database (unik
 * dengan `lower(nama)`), jadi pesan errornya diterjemahkan ke bahasa warung.
 */
export async function simpanPelanggan(input: {
  nama: string
  telepon?: string
  catatan?: string
}): Promise<HasilSimpanPelanggan> {
  const nama = input.nama.trim().replace(/\s+/g, " ")
  if (!nama) return { ok: false, pesan: "Nama panggilan pelanggan belum diisi." }
  if (!supabase) {
    return { ok: false, pesan: "Supabase belum terhubung, jadi pelanggan belum bisa disimpan." }
  }

  const { data: sesi, error: errorSesi } = await supabase.auth.getUser()
  if (errorSesi) return { ok: false, pesan: "Gagal membaca sesi masuk. Coba masuk ulang." }
  const ownerId = sesi.user?.id
  if (!ownerId) return { ok: false, pesan: "Belum masuk ke akun warung." }

  const { error } = await supabase.from("pelanggan").insert({
    owner_id: ownerId,
    nama,
    telepon: input.telepon?.trim() || null,
    catatan: input.catatan?.trim() || null,
  })

  if (error) {
    if (error.code === "23505") {
      return { ok: false, pesan: `Sudah ada pelanggan bernama "${nama}".` }
    }
    return { ok: false, pesan: error.message }
  }

  return { ok: true, pesan: `${nama} sudah masuk buku pelanggan.` }
}
