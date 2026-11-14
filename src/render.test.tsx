// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { renderToString } from "react-dom/server"
import App from "./App"
import { bacaTemaTersimpan, terapkanTema } from "./lib/theme"

/**
 * Uji asap: aplikasi harus bisa dirender tanpa error.
 *
 * Ini menangkap kesalahan yang tidak terlihat dari typecheck — misalnya
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

  it("bacaTemaTersimpan mengembalikan sistem saat belum ada pilihan", () => {
    expect(bacaTemaTersimpan()).toBe("sistem")
  })

  it("bacaTemaTersimpan mengembalikan pilihan yang tersimpan", () => {
    // Pilihan yang disimpan harus dipakai lagi saat halaman dimuat ulang.
    window.localStorage.setItem("warung-pintar-tema", "gelap")
    expect(bacaTemaTersimpan()).toBe("gelap")
    window.localStorage.removeItem("warung-pintar-tema")
  })
})
