// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { renderToString } from "react-dom/server"
import App from "./App"
import { bacaTemaTersimpan, terapkanTema } from "./lib/theme"
import { PenyediaWarung } from "./lib/store"
import { TitipJual } from "./pages/TitipJual"
import { AsistenAi } from "./pages/AsistenAi"

/**
 * Uji asap: aplikasi harus bisa dirender tanpa error.
 *
 * Ini menangkap kesalahan yang tidak terlihat dari typecheck: misalnya
 * komponen yang memanggil hook di luar React, atau nama yang salah ketik.
 */
describe("render aplikasi", () => {
  it("merender tanpa error", () => {
    const html = renderToString(<App />)
    expect(html.length).toBeGreaterThan(0)
  })

  it("menyiapkan keadaan awal saat data belum siap", () => {
    const html = renderToString(<App />)
    // Sesi dimuat di efek, jadi render pertama selalu menampilkan keadaan
    // awal. Efeknya tidak jalan di renderToString.
    expect(html).toContain("Menyiapkan warung")
  })

  it("merender halaman Titip Jual tanpa error", () => {
    const html = renderToString(
      <PenyediaWarung>
        <TitipJual />
      </PenyediaWarung>,
    )
    expect(html).toContain("Barang titipan")
  })

  it("merender halaman asisten tanpa error", () => {
    // `bangunKonteks` jalan saat render, jadi kalau ada data rusak di
    // sini halamannya akan mati -- dan itu tidak ketahuan kalau tidak
    // dirender.
    const html = renderToString(
      <PenyediaWarung>
        <AsistenAi />
      </PenyediaWarung>,
    )
    expect(html).toContain("Asisten warung")
  })
})

describe("tema", () => {
  it("menerapkan tema gelap ke elemen html", () => {
    const hasil = terapkanTema("gelap")
    expect(hasil).toBe("gelap")
    expect(document.documentElement.dataset.theme).toBe("dark")
  })

  it("menerapkan tema terang ke elemen html", () => {
    const hasil = terapkanTema("terang")
    expect(hasil).toBe("terang")
    expect(document.documentElement.dataset.theme).toBe("light")
  })

  it("bacaTemaTersimpan mengembalikan terang saat belum ada pilihan", () => {
    expect(bacaTemaTersimpan()).toBe("terang")
  })

  it("bacaTemaTersimpan menyelesaikan nilai lama sistem menjadi tema tetap", () => {
    // Dulu ada pilihan "Ikuti sistem". Nilai lamanya diselesaikan sekali
    // lalu disimpan sebagai pilihan tetap, supaya tampilan tidak berubah
    // diam-diam di tengah pemakaian.
    window.localStorage.setItem("warung-pintar-tema", "sistem")
    const hasil = bacaTemaTersimpan()
    expect(hasil === "terang" || hasil === "gelap").toBe(true)
    expect(window.localStorage.getItem("warung-pintar-tema")).toBe(hasil)
    window.localStorage.removeItem("warung-pintar-tema")
  })

  it("bacaTemaTersimpan mengembalikan pilihan yang tersimpan", () => {
    // Pilihan yang disimpan harus dipakai lagi saat halaman dimuat ulang.
    window.localStorage.setItem("warung-pintar-tema", "gelap")
    expect(bacaTemaTersimpan()).toBe("gelap")
    window.localStorage.removeItem("warung-pintar-tema")
  })
})
