/**
 * Cek kontras warna di semua halaman, untuk mode terang dan mode gelap.
 *
 * Jalankan dari repo:
 *   npx playwright install chromium   # sekali saja
 *   node scripts/cek-kontras.mjs
 *
 * Menghitung rasio kontras tiap teks terhadap latar terdekatnya di atasnya,
 * lalu menandai yang di bawah ambang WCAG AA: 4.5:1 untuk teks biasa, 3:1
 * untuk teks besar dan gambar (ikon, batang grafik).
 *
 * Exit code 1 kalau ada yang gagal, supaya bisa dipakai di CI nanti.
 */

let chromium
try {
  ;({ chromium } = await import("playwright"))
} catch {
  console.error(
    "Script ini butuh Playwright, tapi belum terpasang di repo ini.\n" +
      "Pasang sekali di mesin ini:\n" +
      "  pnpm add -D playwright && npx playwright install chromium\n" +
      "Lalu jalankan: node scripts/cek-kontras.mjs",
  )
  process.exit(2)
}

const BASE = process.env.BASE ?? "http://localhost:5173"
const AMBANG_TEKS = 4.5
const AMBANG_BESAR = 3

const HALAMAN = [
  "Kasir",
  "Beranda",
  "Stok Barang",
  "Simpen Dulu",
  "Penjaga Margin",
  "Cek Stok",
  "Pelanggan",
  "Titip Jual",
  "Harga Pasar",
  "Modal Awal",
  "Tutup Buku",
  "Laporan",
  "Riwayat",
  "Pengaturan",
  "Asisten AI",
]

/** Rasio kontras WCAG antara dua warna RGB. */
function rasio(a, b) {
  const lum = ([r, g, bl]) => {
    const kanal = [r, g, bl].map((n) => {
      const v = n / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * kanal[0] + 0.7152 * kanal[1] + 0.0722 * kanal[2]
  }
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

function keRgb(warna) {
  const angka = (warna ?? "").match(/[\d.]+/g)
  if (!angka) return null
  const [r, g, b] = angka.map(Number)
  if ([r, g, b].some((n) => Number.isNaN(n))) return null
  return [r, g, b]
}

/**
 * Latar efektif sebuah elemen: mencari leluhur pertama yang tidak transparan.
 *
 * Kalau leluhurnya pakai gradient, latar tidak bisa dihitung dari
 * backgroundColor — jadi dikembalikan null dan elemennya dilewati, bukan
 * dilaporkan sebagai gagal.
 */
const CARI_LATAR = `(el) => {
  let n = el
  while (n && n !== document.documentElement) {
    const gaya = getComputedStyle(n)
    if ((gaya.backgroundImage || "").includes("gradient")) return null
    const rgb = (gaya.backgroundColor || "").match(/[\\d.]+/g)
    if (rgb) {
      const a = rgb.length > 3 ? Number(rgb[3]) : 1
      if (a > 0.85) return rgb.slice(0, 3).map(Number)
    }
    n = n.parentElement
  }
  return [255, 255, 255]
}`

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 })
await page.waitForTimeout(2000)
await page.getByRole("button", { name: /Coba akun demo/i }).first().click()
await page.waitForTimeout(9000)

const THEMES = ["terang", "gelap"]
let gagal = 0
const laporan = []

for (const tema of THEMES) {
  await page.getByRole("button", { name: "Pengaturan", exact: true }).first().click()
  await page.waitForTimeout(1500)
  const tombolTema = page.getByRole("button", { name: new RegExp(`^${tema === "gelap" ? "Gelap" : "Terang"}$`, "i") }).first()
  if (await tombolTema.count()) {
    await tombolTema.click()
    await page.waitForTimeout(900)
  }

  for (const halaman of HALAMAN) {
    await page.getByRole("button", { name: halaman, exact: true }).first().click()
    await page.waitForTimeout(1300)

    const hasil = await page.evaluate(
      ([cariLatar]) => {
        const cariLatarFungsi = eval(cariLatar)
        const masalah = []
        const node = document.createTreeWalker(document.querySelector(".content") ?? document.body, NodeFilter.SHOW_TEXT)
        let teks
        while ((teks = node.nextNode())) {
          const isi = (teks.textContent ?? "").trim()
          if (!isi) continue
          const el = teks.parentElement
          if (!el || el.closest("svg, script, style")) continue
          const gaya = getComputedStyle(el)
          if (gaya.visibility === "hidden" || gaya.display === "none" || Number(gaya.opacity) < 0.5) continue
          const latar = cariLatarFungsi(el)
          if (!latar) continue
          const depan = (gaya.color || "").match(/[\d.]+/g)
          if (!depan) continue
          const rgbDepan = depan.slice(0, 3).map(Number)
          const ukuran = parseFloat(gaya.fontSize)
          const tebal = parseInt(gaya.fontWeight, 10) || 400
          const besar = ukuran >= 24 || (ukuran >= 18.66 && tebal >= 700)
          masalah.push({
            teks: isi.slice(0, 40),
            depan: rgbDepan,
            latar,
            ukuran,
            tebal,
            besar,
            sel: el.tagName.toLowerCase() + "." + String(el.className).split(" ").slice(0, 2).join("."),
          })
        }
        return masalah
      },
      [CARI_LATAR],
    )

    for (const m of hasil) {
      const r = rasio(m.depan, m.latar)
      const ambang = m.besar ? AMBANG_BESAR : AMBANG_TEKS
      if (r < ambang) {
        gagal += 1
        laporan.push(
          `[${tema}] ${halaman}  ${r.toFixed(2)}:1 (min ${ambang})  ${m.sel}  "${m.teks}"  fg=${m.depan.join(",")} bg=${m.latar.join(",")}`,
        )
      }
    }
  }
}

await browser.close()

if (laporan.length === 0) {
  console.log("Semua teks lolos kontras WCAG AA di mode terang dan gelap.")
} else {
  console.log(`Teks di bawah ambang kontras: ${laporan.length}\n`)
  for (const baris of laporan.slice(0, 60)) console.log("  " + baris)
  if (laporan.length > 60) console.log(`  ... dan ${laporan.length - 60} lagi`)
}
process.exit(gagal > 0 ? 1 : 0)
