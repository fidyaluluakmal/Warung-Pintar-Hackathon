import { useEffect, useState } from "react"

/**
 * Waktu sekarang, diperbarui tiap menit.
 *
 * Layar yang menghitung "hari ini" memakai nilai ini sebagai dependensi.
 * Kalau tidak, angka "hari ini" beku di waktu layar pertama dibuka: warung
 * yang dibiarkan semalaman masih menampilkan angka kemarin.
 */
export function useSekarang(): Date {
  const [sekarang, setSekarang] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setSekarang(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return sekarang
}
