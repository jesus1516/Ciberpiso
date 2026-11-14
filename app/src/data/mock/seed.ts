export function seeded(lat: number, lon: number, salt = 0) {
  let a = Math.floor((lat + 90) * 1000) * 73856093 ^ Math.floor((lon + 180) * 1000) * 19349663 ^ salt
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
