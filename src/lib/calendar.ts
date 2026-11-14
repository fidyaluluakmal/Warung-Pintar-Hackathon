/**
 * Kalender warung.
 *
 * Semua tanggal dihitung dalam zona waktu warung (Asia/Jakarta), bukan zona
 * waktu perangkat. Tanpa ini, transaksi jam 23:30 WIB akan dihitung sebagai
 *Besok — dan omzet harian, laba kotor, sampai "beli apa besok" jadi meleset.
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

/** Tanggal di warung dari timestamp ISO, format YYYY-MM-DD. */
export function tanggalWib(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

/** Jam di warung, format HH:MM. */
export function jamWib(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

/**
 * Transaksi dianggap "hari ini" kalau tanggalnya sama dengan hari ini
 * di warung.
 */
export function transaksiHariIni(iso: string, now: Date = new Date()): boolean {
  return tanggalWib(iso) === hariIniWib(now)
}

/** Jarak hari antara dua tanggal ISO, dihitung di zona waktu warung. */
export function selisihHari(iso: string, now: Date = new Date()): number {
  const lalu = new Date(tanggalWib(iso) + "T00:00:00Z").getTime()
  const ini = new Date(hariIniWib(now) + "T00:00:00Z").getTime()
  return Math.round((ini - lalu) / 86_400_000)
}
