import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { rupiah } from "../lib/format"
import { bagiPembayaran } from "../lib/margin"
import type { Satuan } from "../lib/types"

interface BarisKeranjang {
  barangId: string
  jumlah: number
  satuan: Satuan
  hargaSatuan: number
}

/**
 * Kasir — mencatat penjualan, termasuk "simpen dulu" (ngutang).
 *
 * Bedanya dengan kasir digital biasa: pelanggan warung sering Buying
 * sebagian lalu bilang "nanti ya". Di sini barang tetap keluar untuk seluruh
 * jumlah, tapi uang yang belum dibayar dicatat sebagai utang.
 */
export function Kasir({ onSelesai }: { onSelesai?: () => void }) {
  const { barang, simpanTransaksi, simpanSimpenDulu } = useWarung()
  const [keranjang, setKeranjang] = useState<BarisKeranjang[]>([])
  const [terpilih, setTerpilih] = useState<string>("")
  const [modeSimpen, setModeSimpen] = useState(false)
  const [pelanggan, setPelanggan] = useState("")
  const [dibayar, setDibayar] = useState("")
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")

  const total = useMemo(
    () => round2(keranjang.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0)),
    [keranjang],
  )

  function tambah(barangId: string) {
    setGalat("")
    setKeranjang((prev) => {
      const ada = prev.find((b) => b.barangId === barangId)
      if (ada) {
        return prev.map((b) =>
          b.barangId === barangId ? { ...b, jumlah: round2(b.jumlah + 1) } : b,
        )
      }
      const asal = barang.find((b) => b.id === barangId)
      if (!asal) return prev
      return [
        ...prev,
        {
          barangId,
          jumlah: 1,
          satuan: asal.satuan,
          hargaSatuan: asal.harga_jual,
        },
      ]
    })
  }

  function ubahJumlah(barangId: string, jumlah: number) {
    setKeranjang((prev) =>
      jumlah <= 0
        ? prev.filter((b) => b.barangId !== barangId)
        : prev.map((b) => (b.barangId === barangId ? { ...b, jumlah } : b)),
    )
  }

  async function simpan() {
    if (keranjang.length === 0) {
      setGalat("Keranjang masih kosong.")
      return
    }
    setSibuk(true)
    setGalat("")
    try {
      if (modeSimpen) {
        const uang = Number(dibayar.replace(/\D/g, ""))
        if (!Number.isFinite(uang) || uang < 0) {
          setGalat("Isi dulu berapa yang dibayar.")
          return
        }
        if (Number.isFinite(uang) && uang >= total) {
          // Dibayar penuh: ini bukan simpen dulu.
          await simpanTransaksi({
            tipe: "jual",
            sumber: "manual",
            baris: keranjang.map((b) => ({
              barangId: b.barangId,
              jumlah: b.jumlah,
              satuan: b.satuan,
              hargaSatuan: b.hargaSatuan,
            })),
          })
        } else {
          await simpanSimpenDulu({
            dibayar: uang,
            pelanggan,
            sumber: "manual",
            baris: keranjang.map((b) => ({
              barangId: b.barangId,
              jumlah: b.jumlah,
              satuan: b.satuan,
              hargaSatuan: b.hargaSatuan,
            })),
          })
        }
      } else {
        await simpanTransaksi({
          tipe: "jual",
          sumber: "manual",
          baris: keranjang.map((b) => ({
            barangId: b.barangId,
            jumlah: b.jumlah,
            satuan: b.satuan,
            hargaSatuan: b.hargaSatuan,
          })),
        })
      }
      setKeranjang([])
      setTerpilih("")
      setModeSimpen(false)
      setPelanggan("")
      setDibayar("")
      onSelesai?.()
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.")
    } finally {
      setSibuk(false)
    }
  }

  const bagi = useMemo(
    () =>
      bagiPembayaran(
        keranjang.map((b) => ({
          barangId: b.barangId,
          qty: b.jumlah,
          satuan: b.satuan,
          hargaSatuan: b.hargaSatuan,
        })),
        Number(dibayar.replace(/\D/g, "")) || 0,
      ),
    [keranjang, dibayar],
  )

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Kasir</span>
          <h1>Catat penjualan</h1>
          <p>Ketuk barang, ubah jumlah, lalu simpan.</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 0 }}>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Keranjang</h2>
              <p>{keranjang.length} baris</p>
            </div>
            {keranjang.length > 0 && (
              <button onClick={() => setKeranjang([])}>Kosongkan</button>
            )}
          </div>

          {keranjang.length === 0 ? (
            <p className="form-note" style={{ marginTop: 20 }}>
              Belum ada barang. Pilih dari daftar di sebelah.
            </p>
          ) : (
            <ul className="stock-list">
              {keranjang.map((baris) => {
                const asal = barang.find((b) => b.id === baris.barangId)
                return (
                  <li className="stock-item" key={baris.barangId}>
                    <div className="product-code">{baris.satuan.slice(0, 2).toUpperCase()}</div>
                    <div className="stock-info">
                      <div>
                        <strong>{asal?.nama ?? "Barang"}</strong>
                      </div>
                      <small>
                        {rupiah(baris.hargaSatuan)} / {baris.satuan} ·{" "}
                        {rupiah(baris.jumlah * baris.hargaSatuan)}
                      </small>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="input"
                      style={{ width: 78 }}
                      value={baris.jumlah}
                      onChange={(event) =>
                        ubahJumlah(baris.barangId, Number(event.target.value))
                      }
                      aria-label={`Jumlah ${asal?.nama ?? "barang"}`}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          <div className="confirm-total">
            <span>Total</span>
            <strong>{rupiah(total)}</strong>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Pilih barang</h2>
              <p>Ketuk untuk menambah</p>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="label" htmlFor="pilih-barang">
              Cari barang
            </label>
            <select
              id="pilih-barang"
              className="input"
              value={terpilih}
              onChange={(event) => setTerpilih(event.target.value)}
            >
              <option value="">— pilih barang —</option>
              {barang.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nama} ({rupiah(b.harga_jual)}/{b.satuan})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="primary-action"
              style={{ width: "100%", marginTop: 10 }}
              disabled={!terpilih}
              onClick={() => {
                tambah(terpilih)
                setTerpilih("")
              }}
            >
              Tambah ke keranjang
            </button>
          </div>

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
            <label
              className="label"
              htmlFor="mode-simpen"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <input
                id="mode-simpen"
                type="checkbox"
                checked={modeSimpen}
                onChange={(event) => {
                  setModeSimpen(event.target.checked)
                  if (!event.target.checked) {
                    setPelanggan("")
                    setDibayar("")
                  }
                }}
              />
              Simpen dulu (p pelanggan bayar sebagian)
            </label>

            {modeSimpen && (
              <div className="space-y-3" style={{ marginTop: 12 }}>
                <div>
                  <label className="label" htmlFor="pelanggan">
                    Nama peminjam
                  </label>
                  <input
                    id="pelanggan"
                    className="input"
                    value={pelanggan}
                    onChange={(event) => setPelanggan(event.target.value)}
                    placeholder="mis. Pak Yono"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="dibayar">
                    Dibayar sekarang
                  </label>
                  <input
                    id="dibayar"
                    className="input"
                    inputMode="numeric"
                    value={dibayar}
                    onChange={(event) => setDibayar(event.target.value)}
                    placeholder="mis. 50000"
                  />
                  {dibayar !== "" && (
                    <p className="form-note">
                      Dibayar {rupiah(bagi.dibayar)} · sisa jadi utang{" "}
                      <strong>{rupiah(bagi.utang)}</strong>
                    </p>
                  )}
                </div>
                <p className="form-note">
                  Stok tetap turun untuk seluruh barang, termasuk yang diutangkan.
                </p>
              </div>
            )}
          </div>

          {galat && (
            <p className="form-error" style={{ marginTop: 14 }}>
              {galat}
            </p>
          )}

          <button
            type="button"
            className="primary-action"
            style={{ width: "100%", marginTop: 16 }}
            disabled={sibuk || keranjang.length === 0}
            onClick={() => void simpan()}
          >
            {sibuk ? "Menyimpan…" : "Simpan penjualan"}
          </button>
        </section>
      </div>
    </div>
  )
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
