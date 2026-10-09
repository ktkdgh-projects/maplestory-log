export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const ocid = getRouterParam(event, 'ocid')
  if (ocid === user.mainOcid) throw createError({ statusCode: 400, message: '대표 캐릭터는 뺄 수 없어요. 내 정보에서 대표를 먼저 바꿔 주세요.' })

  // 모은 스냅샷은 ocid 기준 공개 데이터라 남기고, 이 사용자의 추적과 대기 작업만 지운다
  const { userCharacters, jobs } = await useCollections()
  await userCharacters.deleteOne({ userId: user._id, ocid })
  await jobs.deleteMany({ userId: user._id, ocid, status: { $in: ['pending', 'failed'] } })
  return { ok: true }
})
