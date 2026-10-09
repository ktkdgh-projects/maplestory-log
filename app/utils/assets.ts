// import.meta.glob 결과를 파일 이름(확장자 뺀 것) → URL로 바꾼다
export function assetsByName(modules: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(modules).map(([path, url]) => [path.split('/').at(-1)!.replace(/\.\w+$/, ''), url]))
}
