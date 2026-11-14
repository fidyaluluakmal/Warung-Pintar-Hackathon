import { defineConfig } from "vitest/config"

/**
 * Test berjalan di environment node, kecuali berkas yang butuh DOM
 * (mis. pengujian tema) yang menandai dirinya dengan `@vitest-environment`.
 */
export default defineConfig({
  test: {
    environment: "node",
  },
})
