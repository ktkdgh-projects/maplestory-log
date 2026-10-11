import type { Memo, MemosResponse } from '#shared/types'

// 고침은 브라우저에 바로 남기고 DB엔 손을 뗀 뒤·창을 닫을 때·페이지를 나갈 때 모아 보낸다
const IDLE_SAVE_MS = 3000

interface Draft {
  title: string
  body: string
  at: number
}
export type MemoSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'failed'

let drafts: Record<string, Draft> = {}
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

const draftKey = (owner: string) => `memo-drafts:${owner}`
function readDrafts(owner: string): Record<string, Draft> {
  try {
    return JSON.parse(localStorage.getItem(draftKey(owner)) ?? '{}')
  }
  catch {
    return {}
  }
}
function writeDrafts(owner: string) {
  try {
    if (Object.keys(drafts).length) localStorage.setItem(draftKey(owner), JSON.stringify(drafts))
    else localStorage.removeItem(draftKey(owner))
  }
  catch {}
}

export function useMemos() {
  const memos = useState<Memo[] | null>('memos', () => null)
  const owner = useState<string | null>('memos-owner', () => null)
  const state = useState<MemoSaveState>('memos-state', () => 'idle')
  const failure = useState('memos-failure', () => '')
  const busy = useState('memos-busy', () => false)
  const router = useRouter()

  async function load() {
    try {
      const res = await $fetch<MemosResponse>('/api/memos')
      owner.value = res.owner
      // 저장 못 한 채 꺼진 고침이 있으면 서버 것보다 새것만 다시 얹는다
      drafts = readDrafts(res.owner)
      for (const [id, draft] of Object.entries(drafts)) {
        const memo = res.memos.find(m => m.id === id)
        if (memo && draft.at > Date.parse(memo.updatedAt) && (memo.title !== draft.title || memo.body !== draft.body)) Object.assign(memo, { title: draft.title, body: draft.body })
        else delete drafts[id]
      }
      writeDrafts(res.owner)
      memos.value = res.memos
      failure.value = ''
      if (Object.keys(drafts).length) schedule()
    }
    catch (e) {
      failure.value = errorMessage(e)
      memos.value ??= []
    }
    listen()
  }

  function schedule() {
    state.value = 'pending'
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, IDLE_SAVE_MS)
  }

  function edit(memo: Memo, key: 'title' | 'body', value: string) {
    memo[key] = value
    drafts[memo.id] = { title: memo.title, body: memo.body, at: Date.now() }
    if (owner.value) writeDrafts(owner.value)
    schedule()
  }

  // keepalive는 창을 닫는 순간에도 요청을 끝까지 보낸다. 결과는 못 받으니 임시본은 다음에 열 때 정리한다
  async function flush(keepalive = false) {
    if (timer) clearTimeout(timer)
    timer = null
    const sent = Object.entries(drafts)
    if (!sent.length || !owner.value) return
    const body = JSON.stringify({ memos: sent.map(([id, d]) => ({ id, title: d.title, body: d.body })) })
    if (keepalive) {
      fetch('/api/memos', { method: 'PUT', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
      // 탭만 가렸다 돌아온 거면 결과를 모르니 평소 저장으로 한 번 더 보내 상태를 맞춘다
      schedule()
      return
    }
    state.value = 'saving'
    try {
      const { updatedAt } = await $fetch<{ updatedAt: string }>('/api/memos', { method: 'PUT', headers: { 'content-type': 'application/json' }, body })
      for (const [id, d] of sent) {
        // 보내는 사이에 또 고쳤으면 그건 다음 저장에 보낸다
        if (drafts[id]?.at === d.at) delete drafts[id]
        const memo = memos.value?.find(m => m.id === id)
        if (memo) memo.updatedAt = updatedAt
      }
      writeDrafts(owner.value)
      failure.value = ''
      if (Object.keys(drafts).length) schedule()
      else state.value = 'saved'
    }
    catch (e) {
      failure.value = `${errorMessage(e)} 고친 내용은 브라우저에 남아 있어요.`
      state.value = 'failed'
    }
  }

  function listen() {
    if (listening || !import.meta.client) return
    listening = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush(true)
    })
    window.addEventListener('pagehide', () => flush(true))
    router.beforeEach(() => {
      flush()
    })
  }

  async function create() {
    busy.value = true
    try {
      const memo = await $fetch<Memo>('/api/memos', { method: 'POST', body: {} })
      memos.value = [memo, ...(memos.value ?? [])]
      failure.value = ''
      return memo
    }
    catch (e) {
      failure.value = errorMessage(e)
      return null
    }
    finally {
      busy.value = false
    }
  }

  // 실패하면 그대로 던져서 확인 모달이 오류를 보여 주게 한다
  async function remove(memo: Memo) {
    busy.value = true
    try {
      await $fetch(`/api/memos/${memo.id}`, { method: 'DELETE' })
      delete drafts[memo.id]
      if (owner.value) writeDrafts(owner.value)
      memos.value = (memos.value ?? []).filter(m => m.id !== memo.id)
    }
    finally {
      busy.value = false
    }
  }

  // 로그아웃 뒤 부른다. 같은 브라우저를 쓰는 다음 사람에게 남지 않게 임시본을 모두 지운다
  function forget() {
    drafts = {}
    if (timer) clearTimeout(timer)
    timer = null
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('memo-drafts:')) localStorage.removeItem(key)
    }
    catch {}
    memos.value = null
    owner.value = null
    state.value = 'idle'
  }

  return { memos, state, failure, busy, load, edit, flush, create, remove, forget }
}
