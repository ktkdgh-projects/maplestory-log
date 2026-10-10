// 모의 실험용 난수. 시드를 고정해 서버와 브라우저가 같은 결과를 그리게 한다 (mulberry32)
export function seededRandom(seed = 20261010): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
