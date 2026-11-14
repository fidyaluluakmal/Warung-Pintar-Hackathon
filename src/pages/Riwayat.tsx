import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { rupiah, tanggalPanjang, jam } from "../lib/format"

/**
 * Riwayat — jejak setiap transaksi.
 *
 * Penting untuk pemilik: barang masuk dari nota tetap ada buktinya — siapa
 * yang mencatat, dari mana, dan isinya apa.
 */
export function Riwayat() {
  const { transaksi, baris, barang, stok } = useWarung()
  const [filter, setFilter] = useState<"semua" | "jual" | "beli">("semua")

  const daftar = useMemo(() => {
    const terfilter = transaksi.filter((t) => (filter === "semua" ? true : t.tipe === filter))
    return terfilter.slice(0, 40)
  }, [transaksi, filter])

  const namaBarang = useMemo(
    () => new Map(barang.map((b) => [b.id, b.nama])),
    [barang],
  )
  const modalBarang = useMemo(
    () => new Map(stok.map((s) => [s.barang_id, s.harga_modal])),
    [stok],
  )

  const total = useMemo(
    () =>
      daftar.reduce((sum, t) => {
        const barisT = baris.filter((b) => b.transaksi_id === t.id)
        const modal = barisT.reduce(
          (s, b) => s + b.jumlah * (modalBarang.get(b.barang_id) ?? 0),
          0,
        )
        const laba = t.tipe === "jual" ? t.total - modal : 0
        return sum + laba
      }, 0),
    [daftar, baris, modalBarang],
  )

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Riwayat</span>
          <h1>Jejak transaksi</h1>
          <p>Setiap transaksi, dari mana, dan isinya apa.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{daftar.length} transaksi terakhir</h2>
            <p>Laba kotor dari transaksi yang tampil: {rupiah(total)}</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["semua", "jual", "beli"] as const).map((pilihan) => (
              <button
                key={pilihan}
                type="button"
                className={filter === pilihan ? "small-action brand" : "small-action"}
                onClick={() => setFilter(pilihan)}
              >
                {pilihan === "semua" ? "Semua" : pilihan === "jual" ? "Jual" : "Beli"}
              </button>
            ))}
          </div>
        </div>

        {daftar.length === 0 ? (
          <p className="form-note" style={{ marginTop: 20 }}>
            Belum ada transaksi.
          </p>
        ) : (
          <ul className="stock-list">
            {daftar.map((trx) => {
              const isi = baris.filter((b) => b.transaksi_id === trx.id)
              const sumber = trx.sumber === "suara" ? "Suara" : trx.sumber === "nota" ? "Nota" : "Manual"
              const tipe = trx.tipe === "jual" ? "Penjualan" : trx.tipe === "beli" ? "Pembelian" : "Penyesuaian"
              return (
                <li className="stock-item" key={trx.id}>
                  <div className="product-code">{sumber.slice(0, 2).toUpperCase()}</div>
                  <div className="stock-info">
                    <div>
                      <strong>{tipe}</strong>
                      <span>{sumber}</span>
                    </div>
                    <small>
                      {tanggalPanjang(trx.tanggal)} · {jam(trx.tanggal)}
                      {isi.length > 0 &&
                        ` · ${isi
                          .map((b) => `${namaBarang.get(b.barang_id) ?? "?"} ${b.jumlah}`)
                          .join(", ")}`}
                    </small>
                  </div>
                  <b style={{ fontSize: 13 }}>{rupiah(trx.total)}</b>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
