import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { mintaSaran } from "../lib/api"
import { rupiah } from "../lib/format"
import { labaKotor, round2 } from "../lib/inventory"
import type { TipsAi } from "../lib/types"

const CONTOH_PERTANYAAN = [
  "Beli apa besok?",
  "Stok apa yang hampir habis?",
  "Omzet naik atau turun minggu ini?",
]

/**
 * Tanya AI + Ai Business Advisor.
 *
 * Angka dihitung aplikasi dari database, lalu dikirim ke AI untuk dirapikan
 * bahasanya. AI tidak pernah menghitung ulang dan tidak pernah mengarang
 * angka — itu aturan di system prompt.
 */
export function TanyaAi() {
  const { transaksi, baris, stok, saranBeli } = useWarung()
  const [pertanyaan, setPertanyaan] = useState("")
  const [jawaban, setJawaban] = useState("")
  const [tips, setTips] = useState<TipsAi[]>([])
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")

  // Angka untuk 7 hari terakhir, dihitung di kode.
  const angkaMingguIni = useMemo(() => {
    const batas = Date.now() - 7 * 86_400_000
    const mingguIni = transaksi.filter((t) => t.tipe === "jual" && new Date(t.tanggal).getTime() >= batas)
    const omzet = mingguIni.reduce((sum, t) => sum + t.total, 0)

    const hargaModal = new Map(stok.map((s) => [s.barang_id, s.harga_modal]))
    const idsMingguIni = new Set(mingguIni.map((t) => t.id))
    const modalTerjual = baris
      .filter((row) => idsMingguIni.has(row.transaksi_id))
      .reduce((sum, row) => sum + row.jumlah * (hargaModal.get(row.barang_id) ?? 0), 0)

    return {
      omzet: round2(omzet),
      labaKotor: labaKotor(omzet, modalTerjual),
      jumlahTransaksi: mingguIni.length,
    }
  }, [transaksi, baris, stok])

  async function tanya(pertanyaan: string) {
    if (!pertanyaan.trim()) return
    setSibuk(true)
    setGalat("")
    try {
      const hasil = await mintaSaran({
        omzetMingguIni: angkaMingguIni.omzet,
        labaKotorMingguIni: angkaMingguIni.labaKotor,
        stokTipis: stok
          .filter((s) => s.stok <= s.min_stok)
          .map((s) => ({ nama: s.nama, stok: s.stok, satuan: s.satuan })),
        saranBeli: saranBeli.map((s) => ({ nama: s.nama, qty: s.qty, satuan: s.satuan })),
      })

      if (hasil && hasil.length > 0) {
        setTips(hasil)
        setJawaban(
          hasil.map((tip) => `${tip.text} — ${tip.reason}`).join(" "),
        )
      } else {
        setGalat("AI belum menjawab. Coba lagi sebentar.")
      }
    } catch {
      setGalat("AI sedang tidak bisa menjawab. Angka di bawah tetap bisa dipakai.")
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Tanya warung</h1>
      <p className="form-note">
        AI menjawab dari catatan warungmu sendiri. Angkanya dihitung aplikasi, bukan ditebak AI.
      </p>

      <section className="panel">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="form-note">
              Omzet 7 hari
            </p>
            <p className="text-lg font-semibold">{rupiah(angkaMingguIni.omzet)}</p>
          </div>
          <div>
            <p className="form-note">
              Laba kotor 7 hari
            </p>
            <p className="text-lg font-semibold">{rupiah(angkaMingguIni.labaKotor)}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div>
          <label className="label" htmlFor="pertanyaan">
            Pertanyaan
          </label>
          <input
            id="pertanyaan"
            className="input"
            value={pertanyaan}
            onChange={(event) => setPertanyaan(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void tanya(pertanyaan)
            }}
            placeholder="mis. beli apa besok?"
          />
        </div>
        <button
          type="button"
          className="primary-action" style={{ width: "100%" }}
          onClick={() => void tanya(pertanyaan)}
          disabled={sibuk || !pertanyaan.trim()}
        >
          {sibuk ? "Thinking…" : "Tanya"}
        </button>
        <div className="flex flex-wrap gap-2">
          {CONTOH_PERTANYAAN.map((contoh) => (
            <button
              key={contoh}
              type="button"
              className="chip"
              onClick={() => {
                setPertanyaan(contoh)
                void tanya(contoh)
              }}
            >
              {contoh}
            </button>
          ))}
        </div>
      </section>

      {galat && (
        <p className="text-sm" >
          {galat}
        </p>
      )}

      {tips.length > 0 && (
        <section className="panel">
          <h2 className="text-sm font-semibold">Saran AI</h2>
          <ul className="mt-3 space-y-3">
            {tips.map((tip, index) => (
              <li key={index}>
                <p className="text-sm font-medium">{tip.text}</p>
                <p className="form-note">
                  {tip.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saranBeli.length > 0 && (
        <section className="panel">
          <h2 className="text-sm font-semibold">Saran belanja (dihitung kode)</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Angka ini dari mesin hitung, bukan dari AI. Dosanya bisa ditelusuri.
          </p>
          <ul className="mt-3 space-y-3">
            {saranBeli.slice(0, 5).map((saran) => (
              <li key={saran.barangId}>
                <p className="text-sm font-medium">
                  Beli {saran.qty} {saran.satuan} {saran.nama}
                </p>
                <p className="form-note">
                  {saran.alasan}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {jawaban && tips.length === 0 && (
        <section className="panel">
          <p className="text-sm">{jawaban}</p>
        </section>
      )}
    </div>
  )
}
