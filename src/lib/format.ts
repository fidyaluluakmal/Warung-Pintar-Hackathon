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
  if (angka >= 1_000_000_000) return `${(nilai / 1_000_000_000).toFixed(1)} M`
  if (angka >= 1_000_000) return `${(nilai / 1_000_000).toFixed(1)} jt`
  if (angka >= 1_000) return `${Math.round(nilai / 1_000)} rb`
  return String(Math.round(nilai))
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

const HARI = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
})

export function tanggalPanjang(iso: string): string {
  return TANGGAL_PANJANG.format(new Date(iso))
}

export function tanggalShort(iso: string): string {
  return TANGGAL_SHORT.format(new Date(iso))
}

export function hariIni(): string {
  return HARI.format(new Date())
}

/** Jam HH:MM dalam zona waktu warung. */
export function jam(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
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

/** Inisial untuk avatar. */
export function inisial(nama: string): string {
  return nama
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? "")
    .join("")
}
