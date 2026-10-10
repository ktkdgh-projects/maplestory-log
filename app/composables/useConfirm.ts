// 지우기 전에 띄우는 공용 확인 모달. ask()가 고른 결과(true면 진행)를 돌려준다. 모달은 레이아웃의 ConfirmHost가 그린다
export interface ConfirmRequest {
  title: string
  // 무엇을 지우는지(굵게)
  name: string
  // 이름 아래 작은 글씨(날짜 등)
  detail?: string
  // 같이 보여 줄 메소. 들어온 메소는 양수
  amount?: number | null
  // 지우면 어떻게 되는지
  note?: string
  // 확인 버튼 글자
  action?: string
}

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void }

// 버튼을 누를 때만 쓰므로 브라우저 안에서 하나만 둔다
const current = shallowRef<Pending | null>(null)

export function useConfirm() {
  function ask(request: ConfirmRequest): Promise<boolean> {
    current.value?.resolve(false)
    return new Promise((resolve) => {
      current.value = { ...request, resolve }
    })
  }
  function settle(ok: boolean) {
    current.value?.resolve(ok)
    current.value = null
  }
  return { ask, current, settle }
}
