import type { SundayNotice, SundayResponse } from '#shared/types'
import type { SundayDoc } from './mongo'

// 공지 목록은 짧게만 캐시한다. 보통 금요일 10시(공휴일이면 목·수요일)에 올라와서 그 무렵에도 금방 보이게
const CHECK_MS = 10 * 60 * 1000
const HISTORY = 12
// 공지 원문 링크는 화면에서 href로 쓰이니 넥슨 홈페이지 주소만 믿고, 아니면 이벤트 목록으로 돌린다
const NOTICE_URL_FALLBACK = 'https://maplestory.nexon.com/News/Event'
const safeNoticeUrl = (url: string) => url.startsWith('https://maplestory.nexon.com/') ? url : NOTICE_URL_FALLBACK

const toNotice = (doc: SundayDoc): SundayNotice => ({
  id: doc._id,
  title: doc.title,
  url: safeNoticeUrl(doc.url),
  image: doc.image,
  start: doc.start.toISOString(),
  end: doc.end.toISOString(),
  publishedAt: doc.publishedAt.toISOString(),
  effects: doc.effects ?? null,
})

// 처음 보는 공지와 넥슨이 고칠 수 있는 아직 안 끝난 공지만 본문을 다시 받는다
async function collectSundays(apiKey: string) {
  const { sundays } = await useCollections()
  const now = Date.now()
  const notices = (await nexon.eventNotices(apiKey)).event_notice.filter(n => n.title.includes('썬데이 메이플'))
  const known = new Set((await sundays.find({ _id: { $in: notices.map(n => n.notice_id) } }, { projection: { _id: 1 } }).toArray()).map(d => d._id))
  for (const notice of notices.filter(n => !known.has(n.notice_id) || Date.parse(n.date_event_end) >= now)) {
    const detail = await nexon.eventNotice(apiKey, notice.notice_id)
    const image = detail.contents.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null
    await sundays.updateOne({ _id: notice.notice_id }, {
      $set: {
        title: notice.title,
        url: safeNoticeUrl(notice.url),
        image,
        start: new Date(notice.date_event_start),
        end: new Date(notice.date_event_end),
        publishedAt: new Date(notice.date),
      },
    }, { upsert: true })
  }
}

export async function sundayOverview(): Promise<SundayResponse> {
  const apiKey = useRuntimeConfig().nexonApiKey
  // 서버 키가 없거나 넥슨이 실패해도 지난번까지 모은 썬데이는 보여준다. 실패도 확인한 것으로 남겨 페이지를 열 때마다 다시 부르지 않게 한다
  if (apiKey) {
    await withCache('sunday-check', CHECK_MS, async () => {
      await collectSundays(apiKey).catch(error => console.warn('[sunday] 공지 확인 실패', redactApiKeys(String(error))))
      return new Date().toISOString()
    }).catch(error => console.warn('[sunday] 공지 확인 기록 실패', String(error)))
  }
  const { sundays } = await useCollections()
  const docs = await sundays.find().sort({ start: -1 }).limit(HISTORY + 1).toArray()
  const now = new Date()
  // 공지의 끝(23:59)에 1분을 더해 월요일 0시까지 이번 주로 본다
  const current = docs.find(d => sundayEndsAt(d.end.toISOString()) > now.getTime()) ?? null
  return {
    current: current ? toNotice(current) : null,
    history: docs.filter(d => d !== current).slice(0, HISTORY).map(toNotice),
    checkedAt: now.toISOString(),
  }
}
