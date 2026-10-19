// 실행: node js/tests/browser.test.js
// 테스트 도구는 프로젝트 밖에 설치합니다. docs/SETUP.md를 참고하세요.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const toolsPath = process.env.TYPING_TEST_TOOLS || path.join(process.env.LOCALAPPDATA, 'CodexTypingTestTools');
const requireTool = createRequire(path.join(toolsPath, 'package.json'));
const { chromium } = requireTool('playwright');
const base = process.env.TYPING_TEST_URL || 'http://127.0.0.1:8765';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const screenshots = path.join(root, 'images', 'tests');
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.TYPING_TEST_BROWSER ? { channel: process.env.TYPING_TEST_BROWSER } : {}) });
let checks = 0;
const errors = [];
const ok = description => { checks++; console.log(`PASS ${checks}: ${description}`); };
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
let putCount = 0;
let rejectWrites = false;
await context.route('**/js/firebase-config.js', route => route.fulfill({
  contentType: 'application/javascript',
  body: `export const firebaseConfig = {apiKey:'fake-api-key',projectId:'demo-typing-game',databaseURL:'https://demo-typing-game.firebaseio.com'};`
}));
await context.route(/https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//, async route => {
  const original = new URL(route.request().url());
  const response = await route.fetch({ url: `http://127.0.0.1:9099/${original.host}${original.pathname}${original.search}` });
  await route.fulfill({ response });
});
await context.route('https://demo-typing-game.firebaseio.com/**', async route => {
  const original = new URL(route.request().url());
  if (route.request().method() === 'PUT') {
    putCount++;
    if (rejectWrites) { await route.fulfill({ status: 503, body: '{"error":"test offline"}', contentType: 'application/json' }); return; }
  }
  original.searchParams.set('ns', 'demo-typing-game-default-rtdb');
  const response = await route.fetch({ url: `http://127.0.0.1:9000${original.pathname}${original.search}` });
  await route.fulfill({ response });
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
await page.clock.install({ time: new Date('2026-10-19T03:00:00Z') });
const id = `자동테스트_${Date.now()}`;
async function login(target = page, value = id) {
  await target.locator('#login-dialog').waitFor({ state: 'visible' });
  await target.locator('#user-id').fill(value);
  await target.locator('#login-form button').click();
  await target.locator('#start-btn').waitFor({ state: 'visible' });
  await target.waitForFunction(() => !document.getElementById('start-btn').disabled);
}
async function five(target = page, typo = false) {
  await target.locator('#mode').selectOption('count');
  await target.locator('#target-count').selectOption('5');
  await target.locator('#start-btn').click();
  for (let i = 0; i < 5; i++) {
    const question = await target.locator('#prompt').textContent();
    await target.locator('#typing-input').fill(typo && i === 0 ? `X${question.slice(1)}` : question);
    assert.equal(await target.locator('#prompt').textContent(), question);
    await target.locator('#typing-input').press('Enter');
  }
  await target.locator('#result-card').waitFor({ state: 'visible' });
}
async function historyCount() {
  await page.locator('#history-btn').click();
  await page.waitForFunction(() => !document.getElementById('history-btn').disabled);
  return page.locator('#history-records tr').count();
}
try {
  await page.goto(base);
  assert(await page.locator('#login-dialog').isVisible());
  await page.locator('#user-id').fill('bad/id');
  await page.locator('#login-form button').click();
  assert.match(await page.locator('#login-error').textContent(), /아이디는/);
  await login();
  assert.equal(await page.locator('#current-user').textContent(), `${id}님`);
  ok('최초 아이디 팝업, 입력 검증, 상단 아이디');
  assert.equal(await page.locator('#duration').inputValue(), '60');
  assert.equal(await page.locator('#target-count').inputValue(), '10');
  assert.deepEqual(await page.locator('#duration option').evaluateAll(nodes => nodes.map(node => Number(node.value))), [30,60,90,120,150,180,210,240,270,300]);
  assert.deepEqual(await page.locator('#target-count option').evaluateAll(nodes => nodes.map(node => Number(node.value))), [5,10,15,20,25,30,35,40,45,50]);
  ok('시간 및 진행횟수 옵션 전체와 기본값');
  assert.equal(await historyCount(), 0);
  assert.equal(await page.locator('#history-message').textContent(), '이전자료가 없습니다.');
  await page.locator('#history-close').click();
  ok('새 아이디의 빈 DB 기록 안내');
  await page.locator('#mode').selectOption('count');
  await page.locator('#target-count').selectOption('5');
  await page.locator('#start-btn').click();
  const first = await page.locator('#prompt').textContent();
  await page.locator('#typing-input').press('Enter');
  assert.equal(await page.locator('#time').textContent(), '0/5회');
  await page.locator('#typing-input').fill(first);
  assert.equal(await page.locator('#prompt').textContent(), first);
  assert.match(await page.locator('#feedback').textContent(), /Enter/);
  await page.locator('#typing-input').dispatchEvent('keydown', {key:'Enter',isComposing:true});
  assert.equal(await page.locator('#time').textContent(), '0/5회');
  await page.locator('#typing-input').dispatchEvent('keydown', {key:'Enter',repeat:true});
  assert.equal(await page.locator('#time').textContent(), '0/5회');
  await page.locator('#typing-input').press('Enter');
  assert.equal(await page.locator('#time').textContent(), '1/5회');
  ok('정답 자동 진행 방지, 빈 Enter·한글 조합·반복 Enter 방지');
  const second = await page.locator('#prompt').textContent();
  await page.locator('#typing-input').fill(`X${second.slice(1)}`);
  await page.locator('#typing-input').press('Enter');
  assert.equal(await page.locator('#time').textContent(), '2/5회');
  for (let i=0;i<3;i++) {
    await page.locator('#typing-input').fill(await page.locator('#prompt').textContent());
    await page.locator('#typing-input').press('Enter');
  }
  assert.equal(await page.locator('#game-status').textContent(), '연습 완료');
  assert.equal(await page.locator('#time').textContent(), '5/5회');
  assert.equal(await page.locator('#today-records tr').count(), 1);
  assert(Number((await page.locator('#final-accuracy').textContent()).replace('%','')) < 100);
  assert.equal(putCount, 0);
  ok('오타 포함 5회 완료, 정확도, 작업종료 이전 DB 쓰기 없음');
  await page.reload();
  await login();
  assert.equal(await page.locator('#today-records tr').count(), 1);
  assert.equal(putCount, 0);
  ok('작업종료 없는 재접속은 DB에 쓰지 않고 당일 임시 기록 복원');
  await page.locator('#language').selectOption('en');
  await page.locator('#difficulty').selectOption('words');
  await five();
  assert.match(await page.locator('#prompt').textContent(), /^[a-z]+$/);
  assert.equal(await page.locator('#today-records tr').count(), 2);
  assert.equal(await page.locator('#today-records tr:first-child td:first-child').textContent(), '2회');
  ok('영문 단어와 여러 회차 최신순 표시');
  await page.locator('#finish-btn').click();
  await page.waitForFunction(() => document.getElementById('save-message').textContent.startsWith('작업종료 완료'));
  assert.equal(putCount, 1);
  assert.equal(await page.locator('#today-records tr').filter({hasText:'저장 완료'}).count(), 2);
  assert.equal(await historyCount(), 1);
  assert.match(await page.locator('#history-records tr').textContent(), /2회/);
  assert.equal(await page.locator('#history-chart circle').count(), 1);
  await page.locator('#history-close').click();
  await page.locator('#finish-btn').click();
  assert.equal(putCount, 1);
  ok('실제 Firebase 에뮬레이터 저장·조회·단일 날짜 그래프·재저장 중복 방지');
  await page.reload();
  await login();
  assert.equal(await page.locator('#today-records tr').count(), 2);
  await page.locator('#language').selectOption('ko');
  await page.locator('#difficulty').selectOption('long');
  await five(page, true);
  rejectWrites = true;
  await page.locator('#finish-btn').click();
  await page.waitForFunction(() => document.getElementById('save-message').textContent.startsWith('저장되지 않았습니다.'));
  assert.match(await page.locator('#today-records tr:first-child').textContent(), /저장 대기/);
  rejectWrites = false;
  await page.locator('#finish-btn').click();
  await page.waitForFunction(() => document.getElementById('save-message').textContent.startsWith('작업종료 완료'));
  assert.equal(await historyCount(), 1);
  assert.match(await page.locator('#history-records tr').textContent(), /3회/);
  await page.locator('#history-close').click();
  ok('저장 실패 시 기록 유지와 재시도, 같은 날짜 3회 합산');
  await page.locator('#mode').selectOption('time');
  await page.locator('#duration').selectOption('30');
  await page.locator('#start-btn').click();
  await page.locator('#typing-input').fill(await page.locator('#prompt').textContent());
  await page.clock.fastForward(30010);
  assert.equal(await page.locator('#game-status').textContent(), '연습 완료');
  assert.equal(await page.locator('#time').textContent(), '0초');
  assert.equal(await page.locator('#today-records tr').count(), 4);
  ok('30초 시간 모드 종료, 미제출 입력 집계 및 기록');
  await page.locator('#start-btn').click();
  await page.locator('#typing-input').fill('취소할 내용');
  await page.locator('#restart-btn').click();
  assert.equal(await page.locator('#today-records tr').count(), 4);
  ok('중도 취소 연습은 완료 기록에 미포함');
  await page.clock.setSystemTime(new Date('2026-10-19T15:00:01Z'));
  await page.clock.runFor(1100);
  await page.waitForFunction(() => document.getElementById('save-message').textContent.startsWith('작업종료 완료'));
  assert.equal(await page.locator('#today-date').textContent(), '2026-10-20');
  assert.match(await page.locator('#today-summary').textContent(), /완료한 연습이 없습니다/);
  assert.equal(await historyCount(), 1);
  assert.match(await page.locator('#history-records tr').textContent(), /4회/);
  await page.locator('#history-close').click();
  ok('한국 자정 전날 평균 자동 정산과 새 날짜 화면 초기화');
  await page.locator('#difficulty').selectOption('short');
  await five();
  await page.locator('#finish-btn').click();
  await page.waitForFunction(() => document.getElementById('save-message').textContent.startsWith('작업종료 완료'));
  assert.equal(await historyCount(), 2);
  assert.equal(await page.locator('#history-records tr:first-child td:first-child').textContent(), '2026-10-20');
  assert.equal(await page.locator('#history-records tr:last-child td:first-child').textContent(), '2026-10-19');
  assert.equal(await page.locator('#history-chart circle').count(), 2);
  ok('날짜별 기록 내림차순 및 최고점수 꺾은선 그래프');
  await page.screenshot({ path: path.join(screenshots, 'desktop-history.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(screenshots, 'mobile-history.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  ok('390px 모바일 화면 가로 넘침 없음');
  // 새 기기(새 localStorage)에서도 같은 아이디의 DB 기록 조회 가능.
  const device = await browser.newContext();
  const fresh = await device.newPage();
  await fresh.route('**/js/firebase-config.js', route => route.fulfill({ contentType:'application/javascript', body:`export const firebaseConfig = {apiKey:'fake-api-key',projectId:'demo-typing-game',databaseURL:'https://demo-typing-game.firebaseio.com'};` }));
  await fresh.route(/https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//, async route => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url:`http://127.0.0.1:9099/${url.host}${url.pathname}${url.search}` }) });
  });
  await fresh.route('https://demo-typing-game.firebaseio.com/**', async route => {
    const url = new URL(route.request().url()); url.searchParams.set('ns','demo-typing-game-default-rtdb');
    await route.fulfill({ response: await route.fetch({ url:`http://127.0.0.1:9000${url.pathname}${url.search}` }) });
  });
  await fresh.goto(base);
  await login(fresh);
  await fresh.locator('#history-btn').click();
  await fresh.waitForFunction(() => !document.getElementById('history-btn').disabled);
  assert.equal(await fresh.locator('#history-records tr').count(), 2);
  await device.close();
  ok('새 브라우저에서 같은 아이디의 과거 기록 조회');
  await page.setViewportSize({ width:1280, height:1000 });
  await page.locator('#history-close').click();
  for (const language of ['ko', 'en']) {
    for (const type of ['words', 'short', 'long']) {
      await page.locator('#language').selectOption(language);
      await page.locator('#difficulty').selectOption(type);
      await five();
      assert.equal(await page.locator('#final-accuracy').textContent(), '100%');
      assert.match(await page.locator('#prompt').textContent(), language === 'ko' ? /[가-힣]/ : /[a-z]/i);
    }
  }
  ok('한글·영문 × 단어·짧은 문장·긴문장 전체 6종 정상 완료');
  const beforeAbnormalClose = putCount;
  await page.close();
  const reopen = await context.newPage();
  await reopen.clock.install({ time:new Date('2026-10-20T15:00:01Z') });
  await reopen.goto(base);
  await login(reopen);
  assert.equal(putCount, beforeAbnormalClose);
  assert.match(await reopen.locator('#today-summary').textContent(), /완료한 연습이 없습니다/);
  ok('창을 닫은 뒤 다음날 접속해도 전날 미승인 기록을 DB에 자동 저장하지 않음');
  await reopen.locator('#mode').selectOption('count');
  await reopen.locator('#target-count').selectOption('5');
  await reopen.locator('#start-btn').click();
  await reopen.locator('#typing-input').fill(await reopen.locator('#prompt').textContent());
  await reopen.clock.setSystemTime(new Date('2026-10-21T15:00:01Z'));
  await reopen.clock.runFor(1100);
  assert.equal(await reopen.locator('#game-status').textContent(), '시작 대기');
  assert.match(await reopen.locator('#feedback').textContent(), /날짜가 변경/);
  assert.equal(await reopen.locator('#today-date').textContent(), '2026-10-22');
  assert.equal(putCount, beforeAbnormalClose);
  ok('자정에 진행 중인 미완료 연습 취소 및 DB 저장 제외');
  assert.deepEqual(errors, []);
  ok('브라우저 JavaScript 실행 오류 없음');
  console.log(`\n${checks} browser checks passed against Python HTTP server + Firebase emulators.`);
} finally { await browser.close(); }
