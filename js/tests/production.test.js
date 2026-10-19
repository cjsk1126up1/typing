// 운영 URL의 실제 리소스와 화면 검증. 기본 실행은 DB에 기록을 쓰지 않습니다.
// --database를 추가하면 검증용 아이디의 완료 기록 1개를 실제 DB에 남깁니다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const toolsPath = process.env.TYPING_TEST_TOOLS || path.join(process.env.LOCALAPPDATA, 'CodexTypingTestTools');
const require = createRequire(path.join(toolsPath, 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless:true, channel:process.env.TYPING_TEST_BROWSER || 'msedge' });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page = await browser.newPage({ viewport:{width:1280,height:1000} });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const database = process.argv.includes('--database');
const userId = database ? `배포검증_${Date.now()}` : '배포화면확인';
try {
  await page.goto('https://typing-xi-nine.vercel.app/');
  assert(await page.locator('#login-dialog').isVisible());
  assert(await page.locator('#ranking-btn').isDisabled());
  await page.locator('#user-id').fill(userId);
  await page.locator('#login-form button').click();
  await page.waitForFunction(() => !document.getElementById('start-btn').disabled);
  assert.equal(await page.locator('#current-user').textContent(), `${userId}님`);
  assert(await page.locator('#ranking-btn').isEnabled());
  console.log('PASS: deployed ID popup, ID display and ranking button');
  await page.locator('#mode').selectOption('count');
  await page.locator('#target-count').selectOption('5');
  await page.locator('#language').selectOption('en');
  await page.locator('#difficulty').selectOption('words');
  await page.locator('#start-btn').click();
  for(let index=0;index<5;index++) {
    const question = await page.locator('#prompt').textContent();
    assert.match(question,/^[a-z]+$/);
    await page.locator('#typing-input').fill(index === 0 ? `X${question.slice(1)}` : question);
    assert.equal(await page.locator('#prompt').textContent(),question);
    await page.locator('#typing-input').press('Enter');
  }
  assert.equal(await page.locator('#game-status').textContent(),'연습 완료');
  assert.equal(await page.locator('#time').textContent(),'5/5회');
  assert.equal(await page.locator('#today-records tr').count(),1);
  console.log('PASS: deployed English typing, Enter-only submission, typo and count completion');
  if(database) {
    await page.locator('#finish-btn').click();
    await page.waitForFunction(() => !document.getElementById('finish-btn').disabled);
    assert.match(await page.locator('#save-message').textContent(),/^작업종료 완료/);
    await page.locator('#history-btn').click();
    await page.waitForFunction(() => !document.getElementById('history-btn').disabled);
    assert.equal(await page.locator('#history-records tr').count(),1);
    assert.equal(await page.locator('#history-chart circle').count(),1);
    await page.locator('#ranking-btn').click();
    await page.waitForFunction(() => !document.getElementById('ranking-btn').disabled);
    assert.match(await page.locator('#ranking-records tr.my-ranking').textContent(),/\(나\)/);
    await page.locator('#ranking-card').screenshot({path:path.join(root,'images/tests/production-ranking.png')});
    console.log(`PASS: live Firebase save, history, chart, public ranking (${userId})`);
  } else {
    console.log('DB writes intentionally skipped; connection status:',await page.locator('#cloud-status').textContent());
    await page.locator('#history-btn').click();
    await page.waitForFunction(() => !document.getElementById('history-btn').disabled);
    console.log('Live history status:',await page.locator('#history-message').textContent());
  }
  assert.deepEqual(errors,[]);
  await page.locator('#history-close').click();
  await page.screenshot({path:path.join(root,'images/tests/production-screen.png'), fullPage:true});
  console.log('PASS: no page JavaScript errors');
} finally { await browser.close(); }
