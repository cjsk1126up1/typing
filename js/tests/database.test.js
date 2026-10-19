// Firebase Authentication / Realtime Database 공식 에뮬레이터가 필요합니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PracticeDatabase } from '../firebase.js';
import { userKey } from '../core.js';
const namespace = 'demo-typing-game-default-rtdb';
const config = { apiKey: 'fake-api-key', projectId: 'demo-typing-game', databaseURL: 'https://demo-typing-game.firebaseio.com' };
function localRequest(url, options) {
  const parsed = new URL(url);
  if (parsed.hostname.endsWith('googleapis.com')) {
    return fetch(`http://127.0.0.1:9099/${parsed.host}${parsed.pathname}${parsed.search}`, options);
  }
  parsed.searchParams.set('ns', namespace);
  return fetch(`http://127.0.0.1:9000${parsed.pathname}${parsed.search}`, options);
}
test('DB 규칙은 인증 없는 읽기와 쓰기를 거절', async () => {
  const url = `http://127.0.0.1:9000/practice/unauthorized/days/2026-10-19.json?ns=${namespace}`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { method:'PUT', body:'{}' })).status, 401);
});
test('인증된 요청도 필수 필드가 없는 일일 기록은 저장 불가', async () => {
  const db = new PracticeDatabase(config, localRequest);
  const token = await db.token();
  const url = `http://127.0.0.1:9000/practice/invalid/days/2026-10-19.json?ns=${namespace}&auth=${token}`;
  const response = await fetch(url, { method:'PUT', body:JSON.stringify({ userId:'invalid', practiceDate:'2026-10-19' }) });
  assert.equal(response.status, 401);
});
test('서로 다른 클라이언트 동시 저장은 두 회차를 모두 보존하고 재전송 중복 방지', async () => {
  const userId = `동시저장_${Date.now()}`;
  const first = new PracticeDatabase(config, localRequest);
  const second = new PracticeDatabase(config, localRequest);
  const attempt = (id, score) => ({ id, userId, date:'2026-10-19', completedAt:Date.now(), score, speed:score * 2, accuracy:90, elapsedSeconds:60, completedQuestions:5 });
  const a = attempt('a', 100), b = attempt('b', 200);
  await Promise.all([first.saveDay(userId, a.date, [a]), second.saveDay(userId, b.date, [b])]);
  await second.saveDay(userId, b.date, [b]);
  const history = await first.history(userId);
  assert.equal(history.length, 1);
  assert.equal(history[0].attemptCount, 2);
  assert.equal(history[0].averageScore, 150);
  assert.equal(history[0].highestScore, 200);
  assert.equal(Object.keys(history[0].attempts).length, 2);
  assert.match(userKey(userId), /^[a-f0-9]+$/);
});
