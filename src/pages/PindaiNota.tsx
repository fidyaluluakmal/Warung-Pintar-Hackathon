import { useRef, useState } from "react"
import { useWarung } from "../lib/store"
import { bacaNota } from "../lib/api"
import { rupiah } from "../lib/format"
import type { Satuan } from "../lib/types"

interface BarisNota {
  nama: string
  jumlah: number
  satuan: Satuan
  hargaSatuan: number
  perluDicek: boolean
}

/**
 * Pindai nota belanja.
 *
 * Foto nota -> model multimodal -> tabel koreksi -> simpan.
 * Total hasil baca dibandingkan dengan jumlah baris, jadi kalau tidak cocok
 * pengguna diberi tahu sebelum menyimpan.
 */
export function PindaiNota() {
  const { barang, simpanTransaksi } = useWarung()
  const [baris, setBaris] = useState<BarisNota[]>([])
  const [total, setTotal] = useState(0)
  const [totalBeda, setTotalBeda] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")
  const [pratinjau, setPratinjau] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function keBarang(nama: string) {
    const kunci = nama.toLowerCase().trim()
    return barang.find((b) => b.nama.toLowerCase() === kunci)
  }

  async function prosesFile(file: File) {
    setSibuk(true)
    setGalat("")
    try {
      const base64 = await menjadiBase64(file)
      setPratinjau(URL.createObjectURL(file))

      const hasil = await bacaNota(base64, file.type || "image/jpeg")
      if (!hasil || hasil.items.length === 0) {
        setGalat("Tidak ada baris yang terbaca. Coba foto lebih terang dan tidak blur.")
        return
      }

      setBaris(
        hasil.items.map((item) => {
          const barangDitemukan = keBarang(item.name)
          return {
            nama: barangDitemukan?.nama ?? item.name,
            jumlah: item.qty,
            satuan: item.unit,
            hargaSatuan: item.unitPrice || barangDitemukan?.harga_modal || 0,
            perluDicek: item.confidence < 0.7 || !barangDitemukan,
          }
        }),
      )
      setTotal(hasil.total)
      setTotalBeda(hasil.totalMismatch)
    } catch {
      setGalat("Gagal membaca nota. Coba lagi.")
    } finally {
      setSibuk(false)
    }
  }

  async function simpan() {
    const valid = baris.filter((b) => b.jumlah > 0 && b.hargaSatuan > 0 && b.nama)
    if (valid.length === 0) {
      setGalat("Isi dulu jumlah dan harga barangnya.")
      return
    }
    setSibuk(true)
    setGalat("")
    try {
      await simpanTransaksi({
        tipe: "beli",
        sumber: "nota",
        baris: valid.map((b) => {
          const barangDitemukan = keBarang(b.nama)
          return {
            barangId: barangDitemukan?.id ?? "",
            jumlah: b.jumlah,
            satuan: b.satuan,
            hargaSatuan: b.hargaSatuan,
          }
        }),
      })
      setBaris([])
      setTotal(0)
      setTotalBeda(false)
      setPratinjau(null)
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.")
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Pindai nota belanja</h1>
      <p className="text-sm" style={{ color: "var(--teks-lembut)" }}>
        Foto nota agen. AI baca baris barangnya, lalu kamu cek dulu.
      </p>

      <div className="kartu space-y-3 p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void prosesFile(file)
            event.target.value = ""
          }}
        />

        <button
          type="button"
          className="tombol-utama w-full !min-h-16"
          onClick={() => fileRef.current?.click()}
          disabled={sibuk}
        >
          {sibuk ? "Membaca nota…" : "📷 Ambil / pilih foto nota"}
        </button>

        {pratinjau && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pratinjau}
            alt="Pratinjau nota belanja"
            className="max-h-56 w-full rounded-lg object-contain"
            style={{ background: "var(--aksen-lembut)" }}
          />
        )}
      </div>

      {galat && (
        <p className="text-sm" style={{ color: "var(--bahaya)" }}>
          {galat}
        </p>
      )}

      {baris.length > 0 && (
        <section className="kartu p-4">
          <h2 className="text-sm font-semibold">Cek baris nota</h2>

          {totalBeda && (
            <p className="mt-2 text-xs" style={{ color: "var(--peringatan)" }}>
              Total tertulis ({rupiah(total)}) beda dari jumlah baris ({rupiah(
                baris.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0),
              )}). Periksa dulu.
            </p>
          )}

          <ul className="mt-3 space-y-3">
            {baris.map((item, index) => (
              <li key={`${item.nama}-${index}`} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    className="input flex-1"
                    value={item.nama}
                    onChange={(event) =>
                      setBaris((prev) =>
                        prev.map((b, i) => (i === index ? { ...b, nama: event.target.value } : b)),
                      )
                    }
                  />
                  {item.perluDicek && (
                    <span className="chip shrink-0" style={{ color: "var(--peringatan)" }}>
                      periksa
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    className="input w-24"
                    value={item.jumlah}
                    onChange={(event) =>
                      setBaris((prev) =>
                        prev.map((b, i) =>
                          i === index ? { ...b, jumlah: Number(event.target.value) } : b,
                        ),
                      )
                    }
                  />
                  <span className="text-xs" style={{ color: "var(--teks-lembut)" }}>
                    {item.satuan}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className="input flex-1"
                    value={item.hargaSatuan}
                    onChange={(event) =>
                      setBaris((prev) =>
                        prev.map((b, i) =>
                          i === index ? { ...b, hargaSatuan: Number(event.target.value) } : b,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="tombol-sekunder !min-h-11 !px-3"
                    onClick={() => setBaris((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Hapus ${item.nama}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <span className="text-sm" style={{ color: "var(--teks-lembut)" }}>
              Total
            </span>
            <span className="font-semibold">
              {rupiah(baris.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0))}
            </span>
          </div>

          <button type="button" className="tombol-utama mt-3 w-full" onClick={() => void simpan()} disabled={sibuk}>
            Simpan pembelian
          </button>
        </section>
      )}
    </div>
  )
}

/** Baca file jadi base64 tanpa prefix data URL. */
function menjadiBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const pembaca = new FileReader()
    pembaca.onerror = () => reject(new Error("Gagal membaca file."))
    pembaca.onload = () => {
      const hasil = String(pembaca.result ?? "")
      const koma = hasil.indexOf(",")
      resolve(koma >= 0 ? hasil.slice(koma + 1) : hasil)
    }
    pembaca.readAsDataURL(file)
  })
}
