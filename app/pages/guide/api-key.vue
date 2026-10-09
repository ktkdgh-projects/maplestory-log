<script setup lang="ts">
useHead({ title: 'API 키 발급 안내 · 메이플스토리로그' })
</script>

<template>
  <GameWindow title="API 키 발급 안내">
    <div class="prose">
      <p>메이플스토리로그는 넥슨 로그인을 쓰지 않아요. 대신 내가 넥슨 Open API 사이트에서 직접 발급한 키를 등록하면, 그 키로 내 캐릭터 기록을 모아요.</p>

      <h2>발급 순서</h2>
      <ol>
        <li><a href="https://openapi.nexon.com/ko/" target="_blank" rel="noopener">넥슨 Open API</a>에 접속해 <b>기록할 캐릭터가 있는 넥슨 계정</b>으로 로그인해요.</li>
        <li>상단 메뉴의 애플리케이션 등록으로 들어가요.</li>
        <li>게임은 <b>메이플스토리</b>를 고르고, 이름과 설명을 적은 뒤 약관에 동의해 등록해요.</li>
        <li>등록이 끝나면 보이는 API 키(<code>live_</code> 또는 <code>test_</code>로 시작)를 복사해요.</li>
        <li><NuxtLink to="/login">키 등록 화면</NuxtLink>에 붙여넣으면 끝이에요.</li>
      </ol>

      <h2>알아두세요</h2>
      <ul>
        <li>스타포스·큐브 사용 기록은 키를 발급한 계정의 기록만 나와요. 그래서 꼭 내 계정에서 발급해야 해요.</li>
        <li>키는 서버에 암호화해서 보관하고, 화면에는 끝 네 자리만 보여줘요. 내 정보에서 언제든 지울 수 있어요.</li>
        <li>키를 다른 사람이나 다른 사이트에 보여주지 마세요. 키가 새어 나갔다면 넥슨 Open API 사이트에서 키를 다시 발급하고, 내 정보에서 새 키로 바꿔 주세요.</li>
      </ul>
    </div>
  </GameWindow>
</template>
