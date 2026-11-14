import { useState } from "react"
import { PenyediaWarung, useWarung } from "./lib/store"
import { AppHeader } from "./components/AppHeader"
import { ChatDrawer } from "./components/ChatDrawer"
import { MobileMenu } from "./components/MobileMenu"
import { MobileNav } from "./components/MobileNav"
import { Sidebar } from "./components/Sidebar"
import { LayarMasuk } from "./pages/LayarMasuk"
import { Beranda } from "./pages/Beranda"
import { CekStok } from "./pages/CekStok"
import { HargaPasar } from "./pages/HargaPasar"
import { Pelanggan } from "./pages/Pelanggan"
import { Kasir } from "./pages/Kasir"
import { CatatSuara } from "./pages/CatatSuara"
import { PindaiNota } from "./pages/PindaiNota"
import { PenjagaMargin } from "./pages/PenjagaMargin"
import { SimpenDulu } from "./pages/SimpenDulu"
import { StokBarang } from "./pages/StokBarang"
import { TitipJual } from "./pages/TitipJual"
import { Laporan } from "./pages/Laporan"
import { ModalAwal } from "./pages/ModalAwal"
import { Pengaturan } from "./pages/Pengaturan"
import { Riwayat } from "./pages/Riwayat"
import { TutupBuku } from "./pages/TutupBuku"
import type { NavLabel } from "./lib/nav"
import { useTema } from "./lib/theme"

const SIDEBAR_KEY = "warung-pintar-sidebar"

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
  const [modal, setModal] = useState<"suara" | "nota" | null>(null)
  const [asisten, setAsisten] = useState(false)
  const [menuHp, setMenuHp] = useState(false)
  const [cari, setCari] = useState("")
  const { aktif, ganti } = useTema()
  const [sidebarCiut, setSidebarCiut] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === "collapsed"
    } catch {
      return false
    }
  })

  function buka(navigasi: NavLabel) {
    // Suara dan nota dibuka sebagai modal, bukan halaman terpisah.
    if (navigasi === "Catat Suara") {
      setModal("suara")
      return
    }
    if (navigasi === "Foto Nota") {
      setModal("nota")
      return
    }
    if (navigasi === "Tanya AI" || navigasi === "Asisten AI") {
      setAsisten(true)
      return
    }
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
          onBukaAi={() => setAsisten(true)}
          nama={nama}
          warung={warung}
          tema={aktif}
          onGantiTema={() => ganti(aktif === "terang" ? "gelap" : "terang")}
          onBukaMenu={() => setMenuHp(true)}
        />

        <div className="content">
          {nav === "Beranda" && <Beranda onPindah={buka} />}
          {nav === "Kasir" && <Kasir />}
          {nav === "Stok Barang" && <StokBarang cari={cari} onPindah={buka} />}
          {nav === "Simpen Dulu" && <SimpenDulu />}
          {nav === "Penjaga Margin" && <PenjagaMargin />}
          {nav === "Cek Stok" && <CekStok />}
          {nav === "Pelanggan" && <Pelanggan onPindah={buka} />}
          {nav === "Titip Jual" && <TitipJual />}
          {nav === "Harga Pasar" && <HargaPasar />}
          {nav === "Modal Awal" && <ModalAwal />}
          {nav === "Tutup Buku" && <TutupBuku onPindah={buka} />}
          {nav === "Riwayat" && <Riwayat />}
          {nav === "Laporan" && <Laporan onPindah={buka} />}
          {nav === "Pengaturan" && <Pengaturan />}
        </div>
      </main>

      <MobileNav activeNav={nav} onNavigate={buka} />

      {menuHp && (
        <MobileMenu activeNav={nav} onNavigate={buka} onClose={() => setMenuHp(false)} />
      )}

      {asisten && <ChatDrawer onClose={() => setAsisten(false)} />}

      {modal === "suara" && <CatatSuara onClose={() => setModal(null)} />}
      {modal === "nota" && <PindaiNota onClose={() => setModal(null)} />}
    </div>
  )
}
