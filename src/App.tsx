import { useEffect, useState } from "react"
import { PenyediaWarung, useWarung } from "./lib/store"
import { AppHeader } from "./components/AppHeader"
import { MobileNav } from "./components/MobileNav"
import { Sidebar } from "./components/Sidebar"
import { LayarMasuk } from "./pages/LayarMasuk"
import { Beranda } from "./pages/Beranda"
import { Kasir } from "./pages/Kasir"
import { CatatSuara } from "./pages/CatatSuara"
import { PindaiNota } from "./pages/PindaiNota"
import { PenjagaMargin } from "./pages/PenjagaMargin"
import { SimpenDulu } from "./pages/SimpenDulu"
import { StokBarang } from "./pages/StokBarang"
import { TanyaAi } from "./pages/TanyaAi"
import type { NavLabel } from "./lib/nav"

const SIDEBAR_KEY = "warung-pintar-sidebar"
const TEMA_KEY = "warung-pintar-tema"

export default function App() {
  return (
    <PenyediaWarung>
      <Kerangka />
    </PenyediaWarung>
  )
}

function Kerangka() {
  const { siap, sesi } = useWarung()
  const [nav, setNav] = useState<NavLabel>("Beranda")
  const [cari, setCari] = useState("")
  const [sidebarCiut, setSidebarCiut] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === "collapsed"
    } catch {
      return false
    }
  })

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const terapkan = () => {
      let tersimpan: string | null = null
      try {
        tersimpan = window.localStorage.getItem(TEMA_KEY)
      } catch {
        tersimpan = null
      }
      const pilihan = tersimpan === "dark" ? "dark" : media.matches ? "dark" : "light"
      document.documentElement.dataset.theme = pilihan
    }
    terapkan()
    media.addEventListener("change", terapkan)
    return () => media.removeEventListener("change", terapkan)
  }, [])

  function buka(navigasi: NavLabel) {
    setNav(navigasi)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function tutupSidebar() {
    setSidebarCiut((sekarang) => {
      const berikut = !sekarang
      try {
        window.localStorage.setItem(SIDEBAR_KEY, berikut ? "collapsed" : "expanded")
      } catch {
        // Penyimpanan diblokir: pilihan hanya berlaku di sesi ini.
      }
      return berikut
    })
  }

  if (!siap) {
    return (
      <div className="auth-loading" style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        Menyiapkan warung…
      </div>
    )
  }

  if (!sesi) {
    return <LayarMasuk />
  }

  const nama = sesi.pemilik || "Pemilik Warung"
  const warung = sesi.warung || "Warung Saya"

  return (
    <div className="app-shell">
      <Sidebar
        activeNav={nav}
        onNavigate={buka}
        collapsed={sidebarCiut}
        onToggle={tutupSidebar}
        nama={nama}
        warung={warung}
      />

      <main className={sidebarCiut ? "sidebar-collapsed" : ""}>
        <AppHeader
          query={cari}
          onQueryChange={setCari}
          onNavigate={buka}
          onBukaAi={() => buka("Tanya AI")}
          nama={nama}
          warung={warung}
        />

        <div className="content">
          {nav === "Beranda" && <Beranda onPindah={buka} />}
          {nav === "Kasir" && <Kasir />}
          {nav === "Catat Suara" && <CatatSuara />}
          {nav === "Foto Nota" && <PindaiNota />}
          {nav === "Tanya AI" && <TanyaAi />}
          {nav === "Stok Barang" && <StokBarang cari={cari} />}
          {nav === "Simpen Dulu" && <SimpenDulu />}
          {nav === "Penjaga Margin" && <PenjagaMargin />}
        </div>
      </main>

      <MobileNav activeNav={nav} onNavigate={buka} />
    </div>
  )
}
