import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { useWarung } from "../lib/store"
import { angka, rupiah } from "../lib/format"
import { round2 } from "../lib/inventory"
import { bagiPembayaran } from "../lib/margin"
import type { Satuan } from "../lib/types"

/** Satu baris di keranjang kasir. */
interface BarisKeranjang {
  barangId: string
  jumlah: number
  satuan: Satuan
  hargaSatuan: number
  /** Barang dicatat di buku utang, bukan dibayar sekarang. */
  simpenDulu: boolean
}

/**
 * Kasir — jalur utama Warung Pintar.
 *
 * Semua transaksi lahir dari ketukan pemilik warung, jadi tidak pernah ada
 * "hampir benar" yang diam-diam jadi transaksi. Barang yang dibayar sebagian
 * ditandai "simpen dulu": barang tetap keluar untuk seluruh jumlah, tapi
 * uang yang belum dibayar dicatat sebagai utang pelanggan.
 */
export function Kasir() {
  const { barang, alias, stok, simpanTransaksi, simpanSimpenDulu } = useWarung()
  const [keranjang, setKeranjang] = useState<BarisKeranjang[]>([])
  const [cari, setCari] = useState("")
  const [pelanggan, setPelanggan] = useState("")
  const [dibayar, setDibayar] = useState("")
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")
  const [pesan, setPesan] = useState("")

  const stokById = useMemo(() => new Map(stok.map((s) => [s.barang_id, s.stok])), [stok])

  const aliasById = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of alias) {
      const daftar = map.get(item.barang_id)
      if (daftar) daftar.push(item.alias)
      else map.set(item.barang_id, [item.alias])
    }
    return map
  }, [alias])

  const daftar = useMemo(() => {
    const kunci = cari.toLowerCase().trim()
    const hasil = barang.filter((item) => {
      if (!kunci) return true
      const kandidat = [item.nama, ...(aliasById.get(item.id) ?? [])].map((nilai) =>
        nilai.toLowerCase(),
      )
      return kandidat.some((nilai) => nilai.includes(kunci))
    })
    return [...hasil].sort((a, b) => a.nama.localeCompare(b.nama, "id"))
  }, [aliasById, barang, cari])

  const total = useMemo(
    () => round2(keranjang.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0)),
    [keranjang],
  )

  const adaUtang = keranjang.some((b) => b.simpenDulu)

  // Barang yang dibayar didahulukan, baru barang yang disimpan dulu.
  // Pembagian uang memakai urutan ini, jadi cash selalu menutup barang bayar
  // dulu dan utang jatuh tepat di barang yang ditandai ngutang.
  const barisUrut = useMemo(() => {
    const bayar = keranjang.filter((b) => !b.simpenDulu)
    const utang = keranjang.filter((b) => b.simpenDulu)
    return [...bayar, ...utang]
  }, [keranjang])

  const uang = useMemo(() => Number(dibayar.replace(/\D/g, "")) || 0, [dibayar])

  const bagi = useMemo(
    () =>
      bagiPembayaran(
        barisUrut.map((b) => ({
          barangId: b.barangId,
          qty: b.jumlah,
          satuan: b.satuan,
          hargaSatuan: b.hargaSatuan,
        })),
        uang,
      ),
    [barisUrut, uang],
  )

  const dibayarSekarang = adaUtang ? bagi.dibayar : total
  const sisaUtang = adaUtang ? bagi.utang : 0

  function tambah(barangId: string) {
    setGalat("")
    setPesan("")
    setKeranjang((prev) => {
      const ada = prev.find((b) => b.barangId === barangId)
      if (ada) {
        return prev.map((b) =>
          b.barangId === barangId ? { ...b, jumlah: round2(b.jumlah + langkah(b.satuan)) } : b,
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
          simpenDulu: false,
        },
      ]
    })
  }

  function ubahJumlah(barangId: string, arah: 1 | -1) {
    setGalat("")
    setPesan("")
    setKeranjang((prev) =>
      prev
        .map((b) =>
          b.barangId === barangId
            ? { ...b, jumlah: round2(b.jumlah + arah * langkah(b.satuan)) }
            : b,
        )
        .filter((b) => b.jumlah > 0),
    )
  }

  function ubahHarga(barangId: string, harga: number) {
    setGalat("")
    setPesan("")
    setKeranjang((prev) =>
      prev.map((b) => (b.barangId === barangId ? { ...b, hargaSatuan: harga } : b)),
    )
  }

  function toggleSimpenDulu(barangId: string) {
    setGalat("")
    setPesan("")
    setKeranjang((prev) =>
      prev.map((b) => (b.barangId === barangId ? { ...b, simpenDulu: !b.simpenDulu } : b)),
    )
  }

  function hapus(barangId: string) {
    setGalat("")
    setPesan("")
    setKeranjang((prev) => prev.filter((b) => b.barangId !== barangId))
  }

  function kosongkan() {
    setGalat("")
    setPesan("")
    setKeranjang([])
  }

  async function simpan() {
    if (keranjang.length === 0) {
      setGalat("Keranjang masih kosong.")
      return
    }
    const hargaKosong = keranjang.find((b) => !(b.hargaSatuan > 0))
    if (hargaKosong) {
      setGalat("Harga jual barang ini belum diisi. Isi dulu harga jualnya.")
      return
    }
    if (adaUtang && sisaUtang > 0 && !pelanggan.trim()) {
      setGalat("Isi dulu nama pelanggan yang menyimpan barang ini.")
      return
    }

    const barisSimpan = barisUrut.map((b) => ({
      barangId: b.barangId,
      jumlah: b.jumlah,
      satuan: b.satuan,
      hargaSatuan: b.hargaSatuan,
    }))

    setSibuk(true)
    setGalat("")
    setPesan("")
    try {
      if (adaUtang) {
        await simpanSimpenDulu({
          dibayar: uang,
          pelanggan: pelanggan.trim() || "Tanpa nama",
          sumber: "manual",
          baris: barisSimpan,
        })
        setPesan(
          `${keranjang.length} barang tercatat. Dibayar ${rupiah(bagi.dibayar)}, ` +
            `sisanya ${rupiah(bagi.utang)} dicatat sebagai utang${pelanggan.trim() ? ` ${pelanggan.trim()}` : ""}.`,
        )
      } else {
        await simpanTransaksi({
          tipe: "jual",
          sumber: "manual",
          baris: barisSimpan,
        })
        setPesan(`${keranjang.length} barang tersimpan, ${rupiah(total)} masuk kas.`)
      }
      setKeranjang([])
      setPelanggan("")
      setDibayar("")
    } catch (kesalahan) {
      setGalat(
        kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan penjualan.",
      )
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="cashier-page">
      <section className="page-title">
        <div>
          <span className="date-label">Kasir warung</span>
          <h1>Kasir</h1>
          <p>Ketuk barang untuk masuk keranjang. Tandai “simpen dulu” kalau dibayar utang.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={kosongkan}
            disabled={keranjang.length === 0}
          >
            <Icon name="trash" size={16} /> Kosongkan keranjang
          </button>
        </div>
      </section>

      <div className="cashier-layout">
        <section className="cashier-catalog">
          <div className="cashier-search">
            <Icon name="search" size={18} />
            <input
              value={cari}
              onChange={(event) => setCari(event.target.value)}
              placeholder="Cari barang..."
              aria-label="Cari barang"
            />
          </div>

          {daftar.length === 0 ? (
            <p className="cashier-empty">
              {barang.length === 0
                ? "Belum ada barang. Tambah barang dulu di menu Stok Barang."
                : "Barang tidak ditemukan. Coba kata kunci lain."}
            </p>
          ) : (
            <div className="cashier-grid">
              {daftar.map((item) => {
                const sisaStok = stokById.get(item.id) ?? item.stok_awal
                const habis = sisaStok <= 0
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="cashier-tile"
                    onClick={() => tambah(item.id)}
                    disabled={habis}
                  >
                    <strong>{item.nama}</strong>
                    <span className="cashier-price">{rupiah(item.harga_jual)}</span>
                    <small className={habis ? "stock-out" : ""}>
                      {habis
                        ? "Stok habis"
                        : `${angka(sisaStok, sisaStok % 1 === 0 ? 0 : 2)} ${item.satuan} siap`}
                    </small>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <aside className="cashier-cart">
          <div className="cashier-cart-head">
            <h2>Keranjang</h2>
            <span>{keranjang.length} barang</span>
          </div>

          {keranjang.length === 0 ? (
            <p className="cashier-empty">
              Belum ada barang. Ketuk barang di sebelah untuk mulai mencatat.
            </p>
          ) : (
            <ul className="cart-list">
              {keranjang.map((baris) => {
                const asal = barang.find((b) => b.id === baris.barangId)
                return (
                  <li key={baris.barangId} className={baris.simpenDulu ? "cart-line deferred" : "cart-line"}>
                    <div className="cart-line-head">
                      <strong>{asal?.nama ?? "Barang"}</strong>
                      <button
                        type="button"
                        className="cart-remove"
                        onClick={() => hapus(baris.barangId)}
                        aria-label={`Hapus ${asal?.nama ?? "barang"}`}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                    <div className="cart-line-body">
                      <div className="qty-stepper">
                        <button
                          type="button"
                          onClick={() => ubahJumlah(baris.barangId, -1)}
                          aria-label={`Kurangi ${asal?.nama ?? "barang"}`}
                        >
                          −
                        </button>
                        <span>{angka(baris.jumlah, baris.jumlah % 1 === 0 ? 0 : 2)}</span>
                        <button
                          type="button"
                          onClick={() => ubahJumlah(baris.barangId, 1)}
                          aria-label={`Tambah ${asal?.nama ?? "barang"}`}
                        >
                          <Icon name="plus" size={13} />
                        </button>
                      </div>
                      <label className="cart-price">
                        <span>Harga</span>
                        <input
                          inputMode="numeric"
                          value={baris.hargaSatuan || ""}
                          placeholder="0"
                          onChange={(event) =>
                            ubahHarga(
                              baris.barangId,
                              Number(event.target.value.replace(/\D/g, "")) || 0,
                            )
                          }
                        />
                      </label>
                      <span className="cart-total">
                        {rupiah(baris.jumlah * baris.hargaSatuan)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={baris.simpenDulu ? "cart-defer active" : "cart-defer"}
                      onClick={() => toggleSimpenDulu(baris.barangId)}
                    >
                      {baris.simpenDulu ? (
                        <>
                          <Icon name="check" size={13} /> Disimpan dulu (utang)
                        </>
                      ) : (
                        "Simpen dulu (ngutang)"
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {adaUtang && (
            <>
              <div>
                <label className="label" htmlFor="kasir-pelanggan">
                  Nama yang menyimpan
                </label>
                <input
                  id="kasir-pelanggan"
                  className="input"
                  value={pelanggan}
                  onChange={(event) => setPelanggan(event.target.value)}
                  placeholder="Contoh: Pak Yono"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label" htmlFor="kasir-dibayar">
                  Uang diterima sekarang
                </label>
                <input
                  id="kasir-dibayar"
                  className="input"
                  inputMode="numeric"
                  value={dibayar}
                  onChange={(event) => setDibayar(event.target.value)}
                  placeholder="mis. 50000"
                />
              </div>
              <p className="form-note">
                Stok tetap turun untuk seluruh barang. Sisa yang belum dibayar (
                {rupiah(bagi.utang)}) dicatat sebagai utang di buku pelanggan.
              </p>
            </>
          )}

          {pesan && (
            <div className="cashier-saved">
              <Icon name="check" size={16} />
              <span>{pesan}</span>
            </div>
          )}

          {galat && <div className="form-error">{galat}</div>}

          <div className="cashier-totals">
            <div>
              <span>Dibayar sekarang</span>
              <strong>{rupiah(dibayarSekarang)}</strong>
            </div>
            <div>
              <span>Disimpan dulu</span>
              <strong>{rupiah(sisaUtang)}</strong>
            </div>
            <div className="cashier-total">
              <span>Total</span>
              <strong>{rupiah(total)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="primary-action full"
            onClick={() => void simpan()}
            disabled={sibuk || keranjang.length === 0}
          >
            {sibuk
              ? "Menyimpan…"
              : adaUtang
                ? `Simpan — ${rupiah(bagi.dibayar)} dibayar, ${rupiah(bagi.utang)} ngutang`
                : `Simpan ${keranjang.length} barang`}
            {!sibuk && <Icon name="check" size={16} />}
          </button>
        </aside>
      </div>

      {keranjang.length > 0 && (
        <button
          type="button"
          className="cashier-sticky-bar"
          onClick={() =>
            document.querySelector(".cashier-cart")?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <span>{keranjang.length} barang</span>
          <strong>{rupiah(total)}</strong>
          <span>Lihat keranjang</span>
        </button>
      )}
    </div>
  )
}

/**
 * Langkah tombol tambah/kurang.
 *
 * Barang yang dijual per kilogram atau per liter tidak dihitung per bungkus,
 * jadi langkahnya setengah. Satuan lain satu per satu.
 */
function langkah(satuan: Satuan): number {
  return satuan === "kg" || satuan === "liter" ? 0.5 : 1
}
