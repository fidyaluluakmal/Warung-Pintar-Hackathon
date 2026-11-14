/**
 * Format tampilan.
 *
 * Semua angka uang dan tanggal dalam bahasa Indonesia, zona waktu warung
 * (Asia/Jakarta) — bukan zona waktu perangkat.
 */

const RUPIAH = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

export function rupiah(nilai: number): string {
  return RUPIAH.format(nilai || 0)
}

/** Angka ringkas: 15000 -> "15 rb". Untuk kartu ringkasan yang sempit. */
export function rupiahRingkas(nilai: number): string {
  const angka = Math.abs(nilai || 0)
  if (angka >= 1_000_000_000) return `${angkaDesimal(nilai / 1_000_000_000)} M`
  if (angka >= 1_000_000) return `${angkaDesimal(nilai / 1_000_000)} jt`
  if (angka >= 1_000) return `${Math.round(nilai / 1_000)} rb`
  return String(Math.round(nilai))
}

/**
 * Angka desimal dengan pemisah koma.
 *
 * `toFixed(1)` memakai titik — "7.2 jt". Angka yang dibaca orang di Indonesia
 * pakai koma sebagai pemisah desimal.
 */
export function angkaDesimal(nilai: number, desimal = 1): string {
  return angka(nilai, desimal)
}

/**
 * Jumlah barang: bulat tanpa desimal, pecahan dengan maksimal 2 desimal.
 *
 * 12 -> "12", 2.5 -> "2,5". `angka(x, 2)` selalu menambah ",00" — buat
 * jumlah barang itu kelihatan aneh.
 */
export function angkaRapi(nilai: number): string {
  return angka(nilai, Number.isInteger(nilai) ? 0 : 2)
}

/**
 * Persen dengan pemisah koma, tanpa ",0" di ekor.
 *
 * 10 -> "10%", 12.5 -> "12,5%".
 */
export function persen(nilai: number, desimal = 1): string {
  const bulat = Number.isInteger(nilai)
  return `${angka(nilai, bulat ? 0 : desimal)}%`
}

/** Angka biasa dengan pemisah ribuan, tanpa simbol mata uang. */
export function angka(nilai: number, desimal = 0): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  }).format(nilai || 0)
}

const TANGGAL_PANJANG = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

const TANGGAL_SHORT = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
})

/**
 * Tanggal panjang, mis. "Sabtu, 14 November 2026".
 *
 * Tanggal yang rusak tidak boleh membuat halaman mati. `Intl.DateTimeFormat`
 * melempar RangeError untuk tanggal tidak valid, dan satu tanggal rusak sudah
 * cukup untuk membuat seluruh layar kosong. Jadi dikembalikan sebagai teks
 * apa adanya.
 */
export function tanggalPanjang(iso: string): string {
  return formatTanggal(TANGGAL_PANJANG, iso)
}

export function tanggalShort(iso: string): string {
  return formatTanggal(TANGGAL_SHORT, iso)
}

function formatTanggal(format: Intl.DateTimeFormat, iso: string): string {
  const tanggal = new Date(iso)
  if (Number.isNaN(tanggal.getTime())) return iso || "tanggal tidak diketahui"
  return format.format(tanggal)
}

/** Sapaan sesuai jam warung. */
export function sapaan(now: Date = new Date()): string {
  const jamAngka = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  )
  if (jamAngka < 11) return "Selamat pagi"
  if (jamAngka < 15) return "Selamat siang"
  if (jamAngka < 18) return "Selamat sore"
  return "Selamat malam"
}
