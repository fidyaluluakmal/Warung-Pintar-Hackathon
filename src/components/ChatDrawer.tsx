import { useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "./Icon"
import { useWarung } from "../lib/store"
import { callAskWarung } from "../lib/api"

interface Pesan {
  id: string
  role: "user" | "assistant"
  text: string
}

interface Sesi {
  id: string
  judul: string
  pesan: Pesan[]
}

const KUNCI = "warung-pintar-sesi-asisten-v1"

const PERTANYAAN_CEPAT = [
  "Beli apa besok?",
  "Stok apa yang hampir habis?",
  "Omzet hari ini berapa?",
  "Siapa yang paling banyak utang?",
]

function bacaSesi(): Sesi[] {
  try {
    const mentah = window.localStorage.getItem(KUNCI)
    return mentah ? (JSON.parse(mentah) as Sesi[]) : []
  } catch {
    return []
  }
}

function simpanSesi(sesi: Sesi[]) {
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(sesi.slice(0, 20)))
  } catch {
    // Penyimpanan diblokir: sesi hanya berlaku di memori.
  }
}

/**
 * Drawer "Asisten warung".
 *
 * AI menjawab dari catatan warung sendiri. Angkanya dihitung aplikasi lalu
 * dikirim sebagai konteks, jadi model tidak pernah mengarang angka.
 */
export function ChatDrawer({ onClose }: { onClose: () => void }) {
  const { transaksi, baris, stok, utang, saranBeli } = useWarung()
  const [sesi, setSesi] = useState<Sesi[]>([])

  const [aktifId, setAktifId] = useState<string>("")
  const [riwayatBuka, setRiwayatBuka] = useState(false)
  const [input, setInput] = useState("")
  const [sibuk, setSibuk] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tersimpan = bacaSesi()
    setSesi(tersimpan)
    if (tersimpan.length > 0) setAktifId(tersimpan[0].id)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    panelRef.current?.querySelector<HTMLElement>("input")?.focus()
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [sesi, sibuk])

  const aktif = useMemo(
    () => sesi.find((s) => s.id === aktifId) ?? null,
    [sesi, aktifId],
  )

  // Konteks angka: semua dihitung di aplikasi, bukan oleh model.
  const konteks = useMemo(() => {
    const omzetMingguIni = transaksi
      .filter((t) => t.tipe === "jual")
      .reduce((sum, t) => sum + t.total, 0)
    const stokTipis = stok.filter((s) => s.stok <= s.min_stok)
    const utangJalan = utang.filter((u) => u.status === "belum_lunas")
    return {
      omzetMingguIni,
      labaKotorMingguIni: omzetMingguIni,
      stokTipis: stokTipis.map((s) => ({ nama: s.nama, stok: s.stok, satuan: s.satuan })),
      saranBeli: saranBeli.map((s) => ({ nama: s.nama, qty: s.qty, satuan: s.satuan })),
      pelangganUtang: utangJalan.map((u) => ({
        nama: u.pelanggan,
        sisa: Math.max(u.total - u.dibayar, 0),
      })),
      totalTransaksi: transaksi.length,
      jumlahBaris: baris.length,
    }
  }, [transaksi, baris, stok, utang, saranBeli])

  async function tanya(pertanyaan: string) {
    const teks = pertanyaan.trim()
    if (!teks || sibuk) return

    const idSesi = aktifId || `sesi-${Date.now()}`
    const pesanBaru: Pesan = { id: `p-${Date.now()}`, role: "user", text: teks }

    const sesiBaru: Sesi = {
      id: idSesi,
      judul: sesi.find((s) => s.id === idSesi)?.judul ?? teks.slice(0, 40),
      pesan: [...(sesi.find((s) => s.id === idSesi)?.pesan ?? []), pesanBaru],
    }

    const semuaBaru = [
      sesiBaru,
      ...sesi.filter((s) => s.id !== idSesi),
    ]
    setSesi(semuaBaru)
    setAktifId(idSesi)
    simpanSesi(semuaBaru)
    setInput("")
    setSibuk(true)

    try {
      const hasil = await callAskWarung(teks, konteks)
      const balasan: Pesan = {
        id: `p-${Date.now()}-a`,
        role: "assistant",
        text:
          hasil?.answer ??
          "AI belum menjawab. Angka di panel lain tetap bisa dipakai.",
      }
      const denganBalasan: Sesi = {
        ...sesiBaru,
        pesan: [...sesiBaru.pesan, balasan],
      }
      const semuaAkhir = [
        denganBalasan,
        ...sesi.filter((s) => s.id !== idSesi),
      ]
      setSesi(semuaAkhir)
      simpanSesi(semuaAkhir)
    } catch {
      const gagal: Pesan = {
        id: `p-${Date.now()}-a`,
        role: "assistant",
        text: "AI sedang tidak bisa menjawab. Angka di panel lain tetap bisa dipakai.",
      }
      const denganGagal: Sesi = { ...sesiBaru, pesan: [...sesiBaru.pesan, gagal] }
      const semuaAkhir = [denganGagal, ...sesi.filter((s) => s.id !== idSesi)]
      setSesi(semuaAkhir)
      simpanSesi(semuaAkhir)
    } finally {
      setSibuk(false)
    }
  }

  function sesiBaru() {
    const id = `sesi-${Date.now()}`
    setSesi([{ id, judul: "Sesi baru", pesan: [] }, ...sesi])
    setAktifId(id)
    setRiwayatBuka(false)
  }

  return (
    <div
      className="chat-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Asisten warung"
      ref={panelRef}
    >
        <div className="chat-head">
          <div>
            <span className="modal-kicker">Asisten warung</span>
            <strong>Tanya apa saja soal warung ini</strong>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">
            <Icon name="close" />
          </button>
        </div>

        <div className="chat-toolbar">
          <button className="secondary-action" onClick={sesiBaru}>
            <Icon name="plus" size={15} /> Sesi baru
          </button>
          <button
            className={riwayatBuka ? "secondary-action active" : "secondary-action"}
            onClick={() => setRiwayatBuka((sekarang) => !sekarang)}
          >
            <Icon name="clock" size={15} /> Riwayat
          </button>
        </div>

        {riwayatBuka && (
          <div className="chat-history">
            {sesi.length === 0 && <p className="cashier-empty">Belum ada sesi.</p>}
            {sesi.map((s) => (
              <div
                key={s.id}
                className={s.id === aktifId ? "chat-session active" : "chat-session"}
              >
                <button
                  className="chat-session-title"
                  onClick={() => {
                    setAktifId(s.id)
                    setRiwayatBuka(false)
                  }}
                >
                  <span>{s.judul}</span>
                  <small>{s.pesan.length} pesan</small>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="chat-messages" ref={scrollRef}>
          {!aktif || aktif.pesan.length === 0 ? (
            <div className="chat-empty">
              <span className="success-orb">
                <Icon name="spark" size={24} />
              </span>
              <p>
                Tanya apa saja: penjualan, stok, utang, atau kapan sebaiknya kulakan. Semua angka
                diambil dari catatan warung Anda sendiri.
              </p>
              <div className="ask-chips">
                {PERTANYAAN_CEPAT.map((pertanyaan) => (
                  <button key={pertanyaan} onClick={() => void tanya(pertanyaan)}>
                    {pertanyaan}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            aktif.pesan.map((pesan) => (
              <div key={pesan.id} className={`chat-bubble ${pesan.role}`}>
                <span>{pesan.text}</span>
              </div>
            ))
          )}
          {sibuk && (
            <div className="chat-bubble assistant typing">
              <span>Menghitung dari data warung…</span>
            </div>
          )}
        </div>

        <form
          className="chat-input"
          onSubmit={(event) => {
            event.preventDefault()
            void tanya(input)
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Contoh: laba bulan ini berapa?"
            aria-label="Pertanyaan untuk asisten"
            maxLength={300}
          />
          <button type="submit" disabled={sibuk || input.trim().length === 0}>
            {sibuk ? "Menjawab…" : "Tanya"}
          </button>
        </form>
        <small className="chat-note">
          Sesi tersimpan di perangkat ini. AI hanya menjelaskan angka dari catatanmu.
        </small>
    </div>
  )
}
