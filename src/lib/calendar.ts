/**
 * Kalender warung.
 *
 * Semua tanggal dihitung dalam zona waktu warung (Asia/Jakarta), bukan zona
 * waktu perangkat. Tanpa ini, transaksi jam 23:30 WIB akan dihitung sebagai
 *Besok: dan omzet harian, laba kotor, sampai "beli apa besok" jadi meleset.
 *
 * Bandingkan dengan `hariIniWib()`.
 */

const ZONA = "Asia/Jakarta"

/** Tanggal hari ini di warung, format YYYY-MM-DD. */
export function hariIniWib(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/**
 * Tanggal di warung dari timestamp ISO, format YYYY-MM-DD.
 *
 * Timestamp yang rusak mengembalikan string kosong, bukan melempar error.
 * `Intl.DateTimeFormat` melempar RangeError untuk tanggal tidak valid, dan
 * satu transaksi dengan tanggal rusak bisa membuat seluruh halaman mati.
 */
export function tanggalWib(iso: string): string {
  const tanggal = new Date(iso)
  if (Number.isNaN(tanggal.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tanggal)
}

/** Jam di warung, format HH:MM. Timestamp rusak -> string kosong. */
export function jamWib(iso: string): string {
  const tanggal = new Date(iso)
  if (Number.isNaN(tanggal.getTime())) return ""
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
  }).format(tanggal)
}

/**
 * Transaksi dianggap "hari ini" kalau tanggalnya sama dengan hari ini
 * di warung.
 */
export function transaksiHariIni(iso: string, now: Date = new Date()): boolean {
  return tanggalWib(iso) === hariIniWib(now)
}

/**
 * Jarak hari antara dua tanggal ISO, dihitung di zona waktu warung.
 *
 * Tanggal yang rusak dihitung sebagai 0, bukan melempar error.
 */
export function selisihHari(iso: string, now: Date = new Date()): number {
  const tanggalLalu = tanggalWib(iso)
  const hariIni = hariIniWib(now)
  if (!tanggalLalu || !hariIni) return 0
  const lalu = new Date(`${tanggalLalu}T00:00:00Z`).getTime()
  const ini = new Date(`${hariIni}T00:00:00Z`).getTime()
  if (Number.isNaN(lalu) || Number.isNaN(ini)) return 0
  return Math.round((ini - lalu) / 86_400_000)
}
