import { useMemo } from "react"
import { useWarung } from "../lib/store"
import { rupiah } from "../lib/format"

/** Stok barang: daftar lengkap dengan penanda stok menipis. */
export function StokBarang({ cari = "" }: { cari?: string }) {
  const { stok, keluar } = useWarung()

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
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Stok Barang</span>
          <h1>Daftar stok</h1>
          <p>Stok dihitung dari history transaksi, bukan angka yang diketik.</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => void keluar()}>
          Keluar
        </button>
      </div>

      <section className="panel">
        <ul className="stock-list" style={{ marginTop: 0 }}>
          {daftar.map((barang) => {
            const tipis = barang.stok <= barang.min_stok
            const persen = barang.min_stok > 0 ? Math.min(100, (barang.stok / (barang.min_stok * 2)) * 100) : 100
            return (
              <li className="stock-item" key={barang.barang_id}>
                <div className="product-code">{barang.satuan.slice(0, 2).toUpperCase()}</div>
                <div className="stock-info">
                  <div>
                    <strong>{barang.nama}</strong>
                    {tipis && <span>tipis</span>}
                  </div>
                  <small>
                    Jual {rupiah(barang.harga_jual)} · modal {rupiah(barang.harga_modal)} · min{" "}
                    {barang.min_stok} {barang.satuan}
                  </small>
                  <div className="progress">
                    <i className={tipis ? "low" : ""} style={{ width: `${persen}%` }} />
                  </div>
                </div>
                <b style={{ fontSize: 14, whiteSpace: "nowrap" }}>
                  {barang.stok} {barang.satuan}
                </b>
              </li>
            )
          })}
        </ul>

        {daftar.length === 0 && (
          <p className="form-note" style={{ marginTop: 16 }}>
            Tidak ada barang yang cocok.
          </p>
        )}
      </section>
    </div>
  )
}
