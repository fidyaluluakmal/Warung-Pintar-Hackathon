import { useMemo } from "react"
import { useWarung } from "../lib/store"
import { selisihHari } from "../lib/calendar"
import { rupiah } from "../lib/format"

/**
 * Simpen Dulu: buku utang pelanggan.
 *
 * Pelanggan warung sering tidak punya nomor telepon, cuma nama panggilan:
 * "Pak Yono". Karena itu buku ini menyimpan nama, bukan kontak.
 */
export function SimpenDulu() {
  const { utang, lunasiUtang } = useWarung()

  const belumLunas = useMemo(
    // View `utang_berjalan` sudah hanya memuat yang belum lunas.
    () => utang,
    [utang],
  )

  const totalSisa = useMemo(
    () => belumLunas.reduce((sum, item) => sum + Math.max(item.total - item.dibayar, 0), 0),
    [belumLunas],
  )

  const perPelanggan = useMemo(() => {
    const peta = new Map<
      string,
      { total: number; jumlah: number; terakhir: string; terlama: string }
    >()
    for (const item of belumLunas) {
      const entry = peta.get(item.pelanggan)
      const sisa = Math.max(item.total - item.dibayar, 0)
      if (entry) {
        entry.total += sisa
        entry.jumlah += 1
        if (item.tanggal > entry.terakhir) entry.terakhir = item.tanggal
        if (item.tanggal < entry.terlama) entry.terlama = item.tanggal
      } else {
        peta.set(item.pelanggan, {
          total: sisa,
          jumlah: 1,
          terakhir: item.tanggal,
          terlama: item.tanggal,
        })
      }
    }
    return [...peta.entries()]
      .map(([nama, data]) => ({ nama, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [belumLunas])

  /** Pelanggan dengan utang paling lama: bukan yang utangnya paling besar. */
  const palingLama = useMemo(() => {
    let hasil: (typeof perPelanggan)[number] | null = null
    for (const entry of perPelanggan) {
      if (!hasil || entry.terlama < hasil.terlama) hasil = entry
    }
    return hasil
  }, [perPelanggan])

  const hariLalu = (tanggal: string) => {
    const selisih = selisihHari(tanggal)
    if (selisih <= 0) return "hari ini"
    if (selisih === 1) return "kemarin"
    return `${selisih} hari lalu`
  }

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Simpen Dulu</span>
          <h1>Buku utang pelanggan</h1>
          <p>Yang bayar sebagian, sisanya dicatat di sini.</p>
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon revenue">Rp</div>
            <span className="trend warning">belum lunas</span>
          </div>
          <span className="stat-label">Total utang berjalan</span>
          <strong>{rupiah(totalSisa)}</strong>
          <small>Dari {perPelanggan.length} pelanggan</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon profit">#</div>
            <span className="trend positive">catatan</span>
          </div>
          <span className="stat-label">Baris barang diutangkan</span>
          <strong>{belumLunas.length}</strong>
          <small>Setiap baris = satu barang</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon inventory">Rp</div>
            <span className="trend warning">terlama</span>
          </div>
          <span className="stat-label">Utang terlama</span>
          <strong>{palingLama ? rupiah(palingLama.total) : rupiah(0)}</strong>
          <small>
            {palingLama
              ? `${palingLama.nama} · ${selisihHari(palingLama.terlama)} hari`
              : "belum ada"}
          </small>
        </article>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Per pelanggan</h2>
              <p>Urut dari yang paling besar utangnya</p>
            </div>
          </div>

          {perPelanggan.length === 0 ? (
            <p className="form-note" style={{ marginTop: 20 }}>
              Buku utang bersih. Semua penjualan sudah dibayar penuh.
            </p>
          ) : (
            <ul className="debt-list">
              {perPelanggan.map((entry) => (
                <li className="debt-item" key={entry.nama}>
                  <div className="debt-avatar">
                    {entry.nama
                      .split(" ")
                      .slice(0, 2)
                      .map((k) => k[0]?.toUpperCase() ?? "")
                      .join("")}
                  </div>
                  <div>
                    <strong>{entry.nama}</strong>
                    <small>
                      {entry.jumlah} barang · terakhir {hariLalu(entry.terakhir)}
                    </small>
                  </div>
                  <b>{rupiah(entry.total)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Rincian barang</h2>
              <p>Yang masih harus dibayar</p>
            </div>
          </div>

          {belumLunas.length === 0 ? (
            <p className="form-note" style={{ marginTop: 20 }}>
              Tidak ada barang yang diutangkan.
            </p>
          ) : (
            <ul className="debt-list">
              {belumLunas.map((item) => {
                const sisa = Math.max(item.total - item.dibayar, 0)
                const lama = selisihHari(item.tanggal)
                return (
                  <li className="debt-item" key={item.id}>
                    <div className="debt-avatar">{item.pelanggan.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{item.nama_barang}</strong>
                      <small>
                        {item.pelanggan} · {item.qty} {item.satuan}
                        {item.dibayar > 0 ? ` · bayar ${rupiah(item.dibayar)}` : ""}
                      </small>
                    </div>
                    <span className={lama > 7 ? "debt-days" : "debt-days recent"}>
                      {lama} hari
                    </span>
                    <b>{rupiah(sisa)}</b>
                    <button
                      type="button"
                      className="small-action brand"
                      onClick={() => void lunasiUtang(item.id)}
                    >
                      Lunas
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="form-note">
            Pelanggan warung sering cuma punya nama panggilan, bukan nomor telepon.
            Karena itu buku ini menyimpan nama, bukan kontak.
          </p>
        </section>
      </div>
    </div>
  )
}
