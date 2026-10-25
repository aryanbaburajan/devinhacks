import { DataTexture, RGBAFormat, EquirectangularReflectionMapping, PMREMGenerator } from 'three'

export function createDisplayEnvironment(renderer) {
  const width = 512, height = 256
  const pixels = new Uint8Array(width * height * 4)
  // A broad studio softbox and a narrow edge light reflected by the glass.
  // This is only assigned to the display, leaving the chassis lighting fixed.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height
    const softbox = Math.exp(-(((u - 0.70) / 0.065) ** 8) - (((v - 0.48) / 0.16) ** 8))
    const strip = Math.exp(-(((u - 0.88) / 0.012) ** 4) - (((v - 0.55) / 0.24) ** 8))
    const intensity = Math.min(1, 0.015 + softbox * 0.9 + strip * 0.55)
    const index = (y * width + x) * 4
    pixels[index] = intensity * 230
    pixels[index + 1] = intensity * 245
    pixels[index + 2] = intensity * 255
    pixels[index + 3] = 255
  }
  const source = new DataTexture(pixels, width, height, RGBAFormat)
  source.mapping = EquirectangularReflectionMapping
  source.needsUpdate = true
  const generator = new PMREMGenerator(renderer)
  try { return generator.fromEquirectangular(source) }
  finally { source.dispose(); generator.dispose() }
}
