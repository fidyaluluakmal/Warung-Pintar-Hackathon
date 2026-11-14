import { useEffect, useState } from "react"
import { PenyediaWarung, useWarung } from "./lib/store"
import { LayarMasuk } from "./pages/LayarMasuk"
import { Beranda } from "./pages/Beranda"
import { CatatSuara } from "./pages/CatatSuara"
import { PindaiNota } from "./pages/PindaiNota"
import { TanyaAi } from "./pages/TanyaAi"
import { StokBarang } from "./pages/StokBarang"

type Halaman = "beranda" | "suara" | "nota" | "tanya" | "stok"

const MENU: Array<{ id: Halaman; label: string; ikon: string }> = [
  { id: "beranda", label: "Beranda", ikon: "🏠" },
  { id: "suara", label: "Catat", ikon: "🎙️" },
  { id: "nota", label: "Nota", ikon: "📷" },
  { id: "tanya", label: "Tanya AI", ikon: "💬" },
  { id: "stok", label: "Stok", ikon: "📦" },
]

export default function App() {
  return (
    <PenyediaWarung>
      <Kerangka />
    </PenyediaWarung>
  )
}

function Kerangka() {
  const { siap, sesi } = useWarung()
  const [halaman, setHalaman] = useState<Halaman>("beranda")
  const [tema, setTema] = useState<"terang" | "gelap">("terang")

  useTema(tema)

  if (!siap) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ color: "var(--teks)" }}>
        <p className="text-sm" style={{ color: "var(--teks-lembut)" }}>
          Menyiapkan warung…
        </p>
      </div>
    )
  }

  if (!sesi) {
    return <LayarMasuk />
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: "var(--latar)", borderBottom: "1px solid var(--garis)" }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{sesi.warung}</p>
          <p className="truncate text-xs" style={{ color: "var(--teks-lembut)" }}>
            {sesi.pemilik}
          </p>
        </div>
        <button
          type="button"
          className="tombol-sekunder shrink-0 !min-h-9 !px-3 text-xs"
          onClick={() => setTema(tema === "terang" ? "gelap" : "terang")}
          aria-label="Ganti tema terang dan gelap"
        >
          {tema === "terang" ? "🌙" : "☀️"}
        </button>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">
        {halaman === "beranda" && <Beranda onPindah={setHalaman} />}
        {halaman === "suara" && <CatatSuara />}
        {halaman === "nota" && <PindaiNota />}
        {halaman === "tanya" && <TanyaAi />}
        {halaman === "stok" && <StokBarang />}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex border-t"
        style={{ background: "var(--permukaan)", borderColor: "var(--garis)" }}
        aria-label="Navigasi utama"
      >
        {MENU.map((menu) => {
          const aktif = halaman === menu.id
          return (
            <button
              key={menu.id}
              type="button"
              onClick={() => setHalaman(menu.id)}
              aria-current={aktif ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.6875rem] font-medium"
              style={{ color: aktif ? "var(--aksen)" : "var(--teks-lembut)" }}
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {menu.ikon}
              </span>
              {menu.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function useTema(tema: "terang" | "gelap") {
  useEffect(() => {
    document.documentElement.dataset.theme = tema
  }, [tema])
}
