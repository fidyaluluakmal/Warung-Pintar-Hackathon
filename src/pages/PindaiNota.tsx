import { useRef, useState } from "react"
import { useWarung } from "../lib/store"
import { bacaNota } from "../lib/api"
import { rupiah } from "../lib/format"
import { pesanUntukUser } from "../lib/pesan"
import { Icon } from "../components/Icon"
import { Modal } from "../components/Modal"
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
export function PindaiNota({ onClose }: { onClose?: () => void }) {
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
      setGalat(pesanUntukUser(kesalahan, "Gagal menyimpan. Periksa koneksi, lalu coba lagi."))
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal label="Pindai nota belanja" onClose={() => onClose?.()}>
      <span className="modal-kicker">FOTO NOTA, STOK OTOMATIS</span>
      <h2>Pindai nota belanja</h2>
      <p>
        Foto nota agen, lalu AI baca baris barangnya. Anda yang memutuskan
        apa yang benar sebelum stok berubah.
      </p>

      <div className="scan-area">
        <Icon name="camera" size={26} />
        <strong>Ambil atau pilih foto nota</strong>
        <span>Bisa juga nota tulisan tangan, selama tulisan terbaca.</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Pilih foto nota belanja"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void prosesFile(file)
            event.target.value = ""
          }}
        />
      </div>

      {pratinjau && (
        <img
          src={pratinjau}
          alt="Pratinjau nota belanja"
          className="nota-preview"
          style={{ marginTop: 18, maxHeight: 220, width: "100%", objectFit: "contain" }}
        />
      )}

      {galat && <div className="form-error">{galat}</div>}

      {baris.length > 0 && (
        <>
          <span className="modal-kicker" style={{ marginTop: 22, display: "block" }}>
            PERIKSA DULU, LALU SIMPAN
          </span>
          {totalBeda && (
            <div className="form-error">
              Total tertulis ({rupiah(total)}) beda dari jumlah baris (
              {rupiah(baris.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0))}). Periksa
              dulu.
            </div>
          )}
          <div className="confirm-editor">
            <div className="confirm-head">
              <span>Barang</span>
              <span>Jumlah</span>
              <span>Harga</span>
              <span />
            </div>
            {baris.map((item, index) => (
              <div className="confirm-row" key={`${item.nama}-${index}`}>
                <div className="confirm-product">
                  <input
                    value={item.nama}
                    aria-label={`Barang baris ${index + 1}`}
                    onChange={(event) =>
                      setBaris((prev) =>
                        prev.map((b, i) => (i === index ? { ...b, nama: event.target.value } : b)),
                      )
                    }
                  />
                  <div className="confirm-meta">
                    {item.perluDicek ? (
                      <span className="confidence low">periksa lagi</span>
                    ) : (
                      <span className="confidence">yakin</span>
                    )}
                    <span>{item.satuan}</span>
                  </div>
                </div>
                <div className="confirm-qty">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={item.jumlah}
                    onChange={(event) =>
                      setBaris((prev) =>
                        prev.map((b, i) =>
                          i === index ? { ...b, jumlah: Number(event.target.value) } : b,
                        ),
                      )
                    }
                    aria-label={`Jumlah ${item.nama}`}
                  />
                </div>
                <div className="confirm-price">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={item.hargaSatuan}
                    onChange={(event) =>
                      setBaris((prev) =>
                        prev.map((b, i) =>
                          i === index ? { ...b, hargaSatuan: Number(event.target.value) } : b,
                        ),
                      )
                    }
                    aria-label={`Harga ${item.nama}`}
                  />
                </div>
                <button
                  type="button"
                  className="confirm-remove"
                  onClick={() => setBaris((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Hapus ${item.nama}`}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            <div className="confirm-total">
              <span>Total</span>
              <strong>
                {rupiah(baris.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0))}
              </strong>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setBaris([])}
              disabled={sibuk}
            >
              Batal
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => void simpan()}
              disabled={sibuk}
            >
              <Icon name="check" size={16} /> Simpan pembelian
            </button>
          </div>
        </>
      )}
    </Modal>
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
