/**
 * Tema tampilan: terang atau gelap.
 *
 * Pilihan disimpan di localStorage, jadi tema yang dipilih tetap sama
 * setelah aplikasi dimuat ulang.
 */

import { useEffect, useState } from "react"

export type Tema = "terang" | "gelap"

const KUNCI = "warung-pintar-tema"

/**
 * Baca tema yang tersimpan.
 *
 * Nilai lama "sistem" (dulu ada pilihan "Ikuti sistem") diselesaikan ke
 * tema perangkat sekali ini, lalu disimpan sebagai pilihan tetap. Jadi
 * pengguna lama tidak kehilangan tampilan yang mereka pakai, cuma tidak
 * lagi ikut berubah sendiri.
 */
export function bacaTemaTersimpan(): Tema {
  try {
    const nilai = window.localStorage.getItem(KUNCI)
    if (nilai === "gelap" || nilai === "terang") return nilai
    if (nilai === "sistem") {
      const tema = sistemGelap() ? "gelap" : "terang"
      window.localStorage.setItem(KUNCI, tema)
      return tema
    }
    return "terang"
  } catch {
    return "terang"
  }
}

export function simpanTema(tema: Tema) {
  try {
    window.localStorage.setItem(KUNCI, tema)
  } catch {
    // Penyimpanan diblokir: tema hanya berlaku di sesi ini.
  }
}

/** Terapkan tema ke elemen <html>. */
export function terapkanTema(tema: Tema): "terang" | "gelap" {
  const gelap = tema === "gelap"
  // `document` tidak ada saat render di server. Lewati saja: tema berlaku
  // begitu aplikasi jalan di browser.
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = gelap ? "dark" : "light"
  }
  return gelap ? "gelap" : "terang"
}

/** Apakah perangkat ini memilih tema gelap. */
export function sistemGelap(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/**
 * Hook tema. Mengembalikan tema yang aktif dan cara mengubahnya.
 */
export function useTema(): {
  tema: Tema
  aktif: "terang" | "gelap"
  ganti: (tema: Tema) => void
} {
  // Pilihan tersimpan harus langsung dipakai, kalau tidak pilihan yang
  // disimpan hilang begitu halaman dimuat ulang.
  const [tema, setTema] = useState<Tema>(() =>
    typeof window === "undefined" ? "terang" : bacaTemaTersimpan(),
  )
  const [aktif, setAktif] = useState<"terang" | "gelap">(() =>
    typeof window === "undefined" ? "terang" : bacaTemaTersimpan(),
  )

  useEffect(() => {
    setAktif(terapkanTema(tema))
  }, [tema])

  function ganti(berikutnya: Tema) {
    setTema(berikutnya)
    simpanTema(berikutnya)
  }

  return { tema, aktif, ganti }
}
