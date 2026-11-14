/**
 * Tema tampilan: terang, gelap, atau ikut sistem.
 *
 * Pilihan disimpan di localStorage. Mode "sistem" membuat aplikasi
 * otomatis mengikuti saat perangkat berubah.
 */

import { useEffect, useState } from "react"

export type Tema = "terang" | "gelap" | "sistem"

const KUNCI = "warung-pintar-tema"

export function bacaTemaTersimpan(): Tema {
  try {
    const nilai = window.localStorage.getItem(KUNCI)
    return nilai === "gelap" || nilai === "terang" ? nilai : "sistem"
  } catch {
    return "sistem"
  }
}

export function simpanTema(tema: Tema) {
  try {
    window.localStorage.setItem(KUNCI, tema)
  } catch {
    // Penyimpanan diblokir: tema hanya berlaku di sesi ini.
  }
}

/**
 * Terapkan tema ke elemen <html>.
 *
 * "sistem" diselesaikan ke tema yang sedang aktif di perangkat, jadi
 * fungsi ini aman dipanggil dengan nilai apa pun.
 */
export function terapkanTema(tema: Tema): "terang" | "gelap" {
  const gelap = tema === "sistem" ? sistemGelap() : tema === "gelap"
  // `document` tidak ada saat render di server. Lewati saja — tema berlaku
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
 *
 * Kalau tema "sistem", perubahan pengaturan perangkat langsung diikuti.
 */
export function useTema(): {
  tema: Tema
  aktif: "terang" | "gelap"
  ganti: (tema: Tema) => void
} {
  // Pilihan tersimpan harus langsung dipakai, kalau tidak pilihan yang
  // disimpan hilang begitu halaman dimuat ulang.
  const [tema, setTema] = useState<Tema>(() =>
    typeof window === "undefined" ? "sistem" : bacaTemaTersimpan(),
  )
  // Keadaan awal ikut tema sistem, bukan selalu terang. Kalau tema yang
  // disimpan "sistem" dan perangkatnya gelap, aplikasi sempat menampilkan
  // tema terang sebelum efek berjalan — kedipan putih di layar.
  const [aktif, setAktif] = useState<"terang" | "gelap">(() =>
    typeof window === "undefined"
      ? "terang"
      : tema === "sistem"
        ? sistemGelap()
          ? "gelap"
          : "terang"
        : tema === "gelap"
          ? "gelap"
          : "terang",
  )

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")

    const terapkan = () => {
      const pilihan = tema === "sistem" ? (media.matches ? "gelap" : "terang") : tema
      setAktif(terapkanTema(pilihan))
    }

    terapkan()
    media.addEventListener("change", terapkan)
    return () => media.removeEventListener("change", terapkan)
  }, [tema])

  function ganti(berikutnya: Tema) {
    setTema(berikutnya)
    simpanTema(berikutnya)
  }

  return { tema, aktif, ganti }
}
