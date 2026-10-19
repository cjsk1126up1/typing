import { test } from 'node:test';
import assert from 'node:assert/strict';
import { practiceDate, validateUserId, userKey, measure, resultMetrics, summarize, mergeDaily, mergeLeaderboard, rankUsers, nextQuestion } from '../core.js';
import { questions } from '../questions.js';
import { PracticeDatabase } from '../firebase.js';

const attempt = (id, score = 100) => ({ id, userId: '테스트', date: '2026-10-19', score, speed: score * 2, accuracy: 90, elapsedSeconds: 60, completedQuestions: 5 });
test('한국 자정 전후를 다른 날짜로 분리', () => {
  assert.equal(practiceDate(Date.parse('2026-10-19T14:59:59Z')), '2026-10-19');
  assert.equal(practiceDate(Date.parse('2026-10-19T15:00:00Z')), '2026-10-20');
});
test('아이디 정규화와 안전한 DB 경로', () => {
  assert.equal(validateUserId(' 사용자_1 '), '사용자_1');
  for (const value of ['', 'a/b', 'a.b', '<script>', 'a'.repeat(33)]) assert.throws(() => validateUserId(value));
  assert.match(userKey('한글ID'), /^[a-f0-9]+$/);
  assert.notEqual(userKey('A'), userKey('a'));
});
test('두 언어 각각 문제 최소 개수와 중복 여부', () => {
  for (const types of Object.values(questions)) {
    for (const [type, minimum] of [['words', 300], ['short', 100], ['long', 40]]) {
      assert(types[type].length >= minimum);
      assert.equal(new Set(types[type]).size, types[type].length);
      assert(types[type].every(text => text.trim().length > 0));
    }
  }
});
test('한 목록 소진 전 중복 없이 출제하고 다음 목록 시작에서도 연속 중복 방지', () => {
  const deck = [], source = ['가', '나', '다'];
  let previous;
  for (let cycle = 0; cycle < 20; cycle++) {
    const drawn = [];
    for (let i = 0; i < source.length; i++) {
      const question = nextQuestion(deck, source, previous);
      assert.notEqual(question, previous);
      drawn.push(question);
      previous = question;
    }
    assert.equal(new Set(drawn).size, source.length);
  }
});
test('오타는 점수와 정확도에 반영', () => {
  assert.deepEqual(measure('abXd', 'abcd'), { typed: 4, correct: 3 });
  assert.deepEqual(resultMetrics(3, 4, 30), { accuracy: 75, speed: 6, score: 2 });
  assert.equal(resultMetrics(0, 0, 60).score, 0);
});
test('일일 평균과 최고점수는 모든 회차 기준이며 재저장 중복 방지', () => {
  const first = mergeDaily(null, '테스트', '2026-10-19', [attempt('one')]);
  const second = mergeDaily(first, '테스트', '2026-10-19', [attempt('one'), attempt('two', 200)]);
  assert.equal(second.attemptCount, 2);
  assert.equal(second.averageScore, 150);
  assert.equal(second.highestScore, 200);
  assert.equal(second.averageSpeed, 300);
  assert.equal(second.totalQuestions, 10);
  assert.equal(summarize([]).highestScore, 0);
  assert.throws(() => mergeDaily(second, '다른사용자', '2026-10-19', [attempt('one')]));
  assert.throws(() => mergeDaily(second, '테스트', '2026-10-20', [attempt('one')]));
});
test('Firebase 미설정 상태는 저장 성공으로 표시하지 않음', async () => {
  const db = new PracticeDatabase({});
  assert.equal(db.available, false);
  await assert.rejects(() => db.history('테스트'), /Firebase 설정/);
});
test('Firebase ETag 충돌 시 다시 읽어 동시 기록을 합산', async () => {
  let reads = 0, writes = 0;
  const db = new PracticeDatabase({ apiKey: 'test', databaseURL: 'https://test.firebaseio.com' }, async (url, options) => {
    if (options.method === 'PUT') {
      writes++;
      if (writes === 1) return new Response('{}', { status: 412 });
      const data = JSON.parse(options.body);
      assert.equal(data.attemptCount, 2);
      assert.equal(data.averageScore, 150);
      assert.equal(options.headers['if-match'], '"two"');
      return new Response(JSON.stringify(data));
    }
    reads++;
    return new Response(JSON.stringify(reads === 1 ? null : mergeDaily(null, '테스트', '2026-10-19', [attempt('other', 200)])), { headers: { ETag: reads === 1 ? '"one"' : '"two"' } });
  });
  db.session = { idToken: 'test', expiresAt: Date.now() + 3600000 };
  db.publishLeaderboard = async () => {};
  const saved = await db.saveDay('테스트', '2026-10-19', [attempt('mine')]);
  assert.equal(reads, 2);
  assert.equal(writes, 2);
  assert.equal(saved.highestScore, 200);
});
test('여러 날짜 순위는 역대 최고와 회차별 평균을 유지하고 오래된 응답은 무시', () => {
  const first = mergeDaily(null, '테스트', '2026-10-19', [attempt('a', 100)]);
  const full = mergeDaily(first, '테스트', '2026-10-19', [attempt('b', 200)]);
  let ranked = mergeLeaderboard(null, full);
  ranked = mergeLeaderboard(ranked, first);
  assert.equal(ranked.attemptCount, 2);
  assert.equal(ranked.highestScore, 200);
  const next = { ...attempt('c', 300), date:'2026-10-20' };
  ranked = mergeLeaderboard(ranked, mergeDaily(null, '테스트', next.date, [next]));
  assert.equal(ranked.attemptCount, 3);
  assert.equal(ranked.averageScore, 200);
  assert.equal(ranked.practiceDays, 2);
  assert.equal(ranked.bestDate, '2026-10-20');
});
test('최고점수 내림차순 및 동점 공동순위, 미연습 사용자 제외', () => {
  const result = rankUsers({ a:{userId:'가', highestScore:100, attemptCount:1}, b:{userId:'나', highestScore:200, attemptCount:1}, c:{userId:'다', highestScore:200, attemptCount:2}, d:{userId:'미연습', highestScore:0, attemptCount:0} });
  assert.deepEqual(result.map(user => user.rank), [1, 1, 3]);
  assert.deepEqual(result.map(user => user.highestScore), [200, 200, 100]);
});
