// 모달은 레이아웃의 ConfirmHost가 그린다
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
  // 있으면 확인을 누른 뒤 모달을 연 채로 실행하고, 실패하면 오류를 보여 주며 그대로 둔다
  run?: () => Promise<unknown>
}

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void }

// 버튼을 누를 때만 쓰므로 브라우저 안에서 하나만 둔다
const current = shallowRef<Pending | null>(null)
const busy = ref(false)
const failure = ref('')

export function useConfirm() {
  function ask(request: ConfirmRequest): Promise<boolean> {
    if (busy.value) return Promise.resolve(false)
    current.value?.resolve(false)
    failure.value = ''
    return new Promise((resolve) => {
      current.value = { ...request, resolve }
    })
  }
  function settle(ok: boolean) {
    if (busy.value) return
    current.value?.resolve(ok)
    current.value = null
  }
  async function confirm() {
    const request = current.value
    if (!request || busy.value) return
    if (!request.run) return settle(true)
    busy.value = true
    failure.value = ''
    try {
      await request.run()
      busy.value = false
      if (current.value === request) settle(true)
    }
    catch (error) {
      failure.value = errorMessage(error)
    }
    finally {
      busy.value = false
    }
  }
  return { ask, current, busy, failure, settle, confirm }
}
