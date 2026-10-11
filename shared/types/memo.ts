export interface Memo {
  id: string
  title: string
  body: string
  updatedAt: string
}

export interface MemosResponse {
  memos: Memo[]
  // 브라우저 임시 저장 칸 이름. 한 브라우저에서 계정을 바꿔도 남의 메모가 섞이지 않게 계정마다 다르다
  owner: string
}
