import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { rupiah } from "../lib/format"

/** Stok barang: daftar lengkap dengan penanda stok menipis. */
export function StokBarang() {
  const { stok, transaksi, keluar } = useWarung()
  const [cari, setCari] = useState("")

  const daftar = useMemo(() => {
    const kunci = cari.toLowerCase().trim()
    const urut = [...stok].sort((a, b) => {
      const aTipis = a.stok <= a.min_stok ? 0 : 1
      const bTipis = b.stok <= b.min_stok ? 0 : 1
      if (aTipis !== bTipis) return aTipis - bTipis
      return a.nama.localeCompare(b.nama, "id")
    })
    if (!kunci) return urut
    return urut.filter((b) => b.nama.toLowerCase().includes(kunci))
  }, [stok, cari])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Stok barang</h1>
        <button type="button" className="tombol-sekunder !min-h-9 !px-3 text-xs" onClick={() => void keluar()}>
          Keluar
        </button>
      </div>

      <input
        className="input"
        value={cari}
        onChange={(event) => setCari(event.target.value)}
        placeholder="Cari barang…"
        aria-label="Cari barang"
      />

      <p className="text-xs" style={{ color: "var(--teks-lembut)" }}>
        {stok.length} barang · {transaksi.length} transaksi tercatat
      </p>

      <ul className="space-y-2">
        {daftar.map((barang) => {
          const tipis = barang.stok <= barang.min_stok
          return (
            <li key={barang.barang_id} className="kartu p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{barang.nama}</p>
                  <p className="text-xs" style={{ color: "var(--teks-lembut)" }}>
                    Jual {rupiah(barang.harga_jual)} · Modal {rupiah(barang.harga_modal)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">
                    {barang.stok} {barang.satuan}
                  </p>
                  <p className="text-xs" style={{ color: "var(--teks-lembut)" }}>
                    min {barang.min_stok}
                  </p>
                </div>
              </div>
              {tipis && (
                <span className="chip mt-2" style={{ color: "var(--peringatan)" }}>
                  perlu dibeli
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {daftar.length === 0 && (
        <p className="text-sm" style={{ color: "var(--teks-lembut)" }}>
          Tidak ada barang yang cocok.
        </p>
      )}
    </div>
  )
}
