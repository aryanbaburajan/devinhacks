import { DataTexture, RGBAFormat, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping } from 'three'

// Tangent-space normals for the inset speaker holes and fine machined rim
// texture. Generated once locally; shared across all instances of each mesh.
export function createGrilleNormalMap(size = 64, brushed = false) {
  const data = new Uint8Array(size * size * 4)
  function height(u, v) {
    if (brushed) return 0.0008 * Math.sin(u * Math.PI * 32) + 0.0004 * Math.sin((v * 25 + u * 9) * Math.PI * 2)
    const radius = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2)
    const bowl = -0.22 * Math.exp(-((radius / 0.65) ** 4))
    const lip = 0.025 * Math.exp(-(((radius - 0.8) / 0.08) ** 2))
    return bowl + lip
  }
  const step = 1 / size
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size
    const nx = -(height(u + step, v) - height(u - step, v)) / (2 * step)
    const ny = -(height(u, v + step) - height(u, v - step)) / (2 * step)
    const length = Math.hypot(nx, ny, 1)
    const index = (y * size + x) * 4
    data[index] = Math.round((nx / length * 0.5 + 0.5) * 255)
    data[index + 1] = Math.round((ny / length * 0.5 + 0.5) * 255)
    data[index + 2] = Math.round((1 / length * 0.5 + 0.5) * 255)
    data[index + 3] = 255
  }
  const texture = new DataTexture(data, size, size, RGBAFormat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  if (brushed) texture.wrapS = texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}
