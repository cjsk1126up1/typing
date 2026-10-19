import { practiceDate, validateUserId, userKey, measure, resultMetrics, summarize, nextQuestion } from './core.js';
import { questions } from './questions.js';
import { PracticeDatabase } from './firebase.js';

const $ = id => document.getElementById(id);
const db = new PracticeDatabase();
const settings = ['language', 'difficulty', 'mode', 'duration', 'target-count'];
const labels = { ko: '한글', en: '영문', short: '짧은 문장', words: '단어', long: '긴문장' };
let userId = '';
let day = practiceDate();
let entries = new Map();
let run = null;
let timer = null;
let saving = false;
let loggingIn = false;
let lastQuestion = '';
const decks = new Map();

for (let value = 30; value <= 300; value += 30) $('duration').add(new Option(`${value}초`, value));
for (let value = 5; value <= 50; value += 5) $('target-count').add(new Option(`${value}회`, value));
$('duration').value = '60';
$('target-count').value = '10';

function message(id, text, type = '') {
  $(id).textContent = text;
  if (id === 'feedback' || id === 'save-message') $(id).className = `feedback ${type}`.trim();
}
function prefix() { return `typing:v2:${userKey(userId)}:`; }
function store(entry) {
  entries.set(entry.attempt.id, entry);
  try { localStorage.setItem(prefix() + entry.attempt.id, JSON.stringify(entry)); }
  catch { message('save-message', '브라우저 임시 보관에 실패했습니다. 이 화면을 닫기 전에 작업종료로 저장해 주세요.', 'error'); }
}
function readLocal() {
  const result = new Map();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(prefix())) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key));
        if (entry.attempt.userId === userId && entry.attempt.id) result.set(entry.attempt.id, entry);
      } catch { /* 손상된 항목은 읽지 않습니다. */ }
    }
  } catch { /* 현재 화면의 메모리 기록을 사용합니다. */ }
  return result;
}
function todayAttempts() {
  return [...entries.values()].map(entry => entry.attempt).filter(attempt => attempt.date === day)
    .sort((a, b) => a.completedAt - b.completedAt || a.id.localeCompare(b.id));
}
function cells(body, values) {
  const row = document.createElement('tr');
  for (const value of values) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(cell);
  }
  body.append(row);
}
function renderToday() {
  $('today-date').textContent = day;
  const attempts = todayAttempts();
  const summary = summarize(attempts);
  $('best-score').textContent = `${summary.highestScore}점`;
  $('today-summary').textContent = attempts.length
    ? `${summary.attemptCount}회 완료 · 평균 ${summary.averageScore}점 · 최고 ${summary.highestScore}점 · 평균 ${summary.averageSpeed}타/분 · 정확도 ${summary.averageAccuracy}%`
    : '완료한 연습이 없습니다.';
  $('today-records').replaceChildren();
  [...attempts].reverse().forEach((attempt, index) => {
    const entry = entries.get(attempt.id);
    cells($('today-records'), [
      `${attempts.length - index}회`,
      new Date(attempt.completedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }),
      `${labels[attempt.language]} / ${labels[attempt.type]}`,
      attempt.mode === 'time' ? `${attempt.duration}초` : `${attempt.targetCount}회`,
      `${attempt.score}점`, `${attempt.speed}타/분`, `${attempt.accuracy}%`,
      entry.status === 'saved' ? '저장 완료' : entry.status === 'approved' ? '저장 대기' : '미저장'
    ]);
  });
  if (!attempts.length) cells($('today-records'), ['—', '완료한 연습이 없습니다.', '—', '—', '—', '—', '—', '—']);
  updateControls();
}
function updateControls() {
  const busy = Boolean(run) || saving || loggingIn || !userId;
  settings.forEach(id => { $(id).disabled = busy; });
  $('start-btn').disabled = busy;
  $('restart-btn').disabled = !run || saving;
  $('result-retry-btn').disabled = busy;
  $('finish-btn').disabled = busy;
  $('history-btn').disabled = !userId || loggingIn;
  $('ranking-btn').disabled = !userId || loggingIn;
}
function selectedConfig() {
  return { language: $('language').value, type: $('difficulty').value, mode: $('mode').value,
    duration: Number($('duration').value), targetCount: Number($('target-count').value) };
}
function elapsed() { return run ? Math.max(0, (Date.now() - run.startedAt) / 1000) : 0; }
function currentMetrics() {
  if (!run) return { accuracy: 100, speed: 0, score: 0, correct: 0 };
  const current = measure($('typing-input').value, run.question);
  const correct = run.correct + current.correct;
  return { ...resultMetrics(correct, run.typed, elapsed()), correct };
}
function updateStats() {
  const config = run || selectedConfig();
  const metrics = currentMetrics();
  const completed = run?.completedQuestions || 0;
  const remaining = Math.max(0, config.duration - elapsed());
  $('progress-label').textContent = config.mode === 'time' ? '남은 시간' : '완료한 문제';
  $('time').textContent = config.mode === 'time' ? `${Math.ceil(remaining)}초` : `${completed}/${config.targetCount}회`;
  $('speed').textContent = `${metrics.speed}타/분`;
  $('accuracy').textContent = `${metrics.accuracy}%`;
  const ratio = config.mode === 'time' ? remaining / config.duration : completed / config.targetCount;
  $('time-progress').style.width = `${ratio * 100}%`;
  $('question-progress').textContent = run ? `${completed}문제 제출 · Enter로 다음 문제` : 'Enter를 눌러 제출하세요';
}
function choose() {
  const key = `${run.language}:${run.type}`;
  if (!decks.has(key)) decks.set(key, []);
  run.question = nextQuestion(decks.get(key), questions[run.language][run.type], lastQuestion);
  lastQuestion = run.question;
  $('prompt').textContent = run.question;
}
function startGame() {
  checkDate();
  if (!userId || run || saving) return;
  run = { ...selectedConfig(), startedAt: Date.now(), date: day, question: '', correct: 0, typed: 0, previousLength: 0, completedQuestions: 0 };
  $('result-card').classList.add('hidden');
  $('typing-input').disabled = false;
  $('typing-input').value = '';
  $('game-status').textContent = '연습 중';
  $('game-status').classList.add('active');
  choose();
  updateControls();
  updateStats();
  message('feedback', '입력 후 Enter를 누르면 오타가 있어도 다음 문제로 넘어갑니다.');
  $('typing-input').focus();
  timer = setInterval(() => {
    checkDate();
    if (!run) return;
    if (run.mode === 'time' && elapsed() >= run.duration) completeGame();
    else updateStats();
  }, 100);
}
function handleTyping() {
  checkDate();
  if (!run) return;
  const value = $('typing-input').value;
  run.typed += Math.max(0, value.length - run.previousLength);
  run.previousLength = value.length;
  if (run.mode === 'time' && elapsed() >= run.duration) { completeGame(); return; }
  if (value === run.question) message('feedback', '정확합니다! Enter를 눌러 다음 문제로 넘어가세요.', 'success');
  else if (value && !run.question.startsWith(value)) message('feedback', '오타가 있어요. 수정하거나 Enter로 다음 문제로 넘어가세요.', 'error');
  else message('feedback', '좋아요. 이어서 입력하세요. 입력 후 Enter로 제출합니다.');
  updateStats();
}
function stopRun() {
  clearInterval(timer);
  timer = null;
  $('typing-input').disabled = true;
  $('game-status').classList.remove('active');
}
function completeGame() {
  if (!run) return;
  const seconds = run.mode === 'time' ? run.duration : Math.max(1, elapsed());
  const correct = run.correct + measure($('typing-input').value, run.question).correct;
  const metrics = resultMetrics(correct, run.typed, seconds);
  const attempt = { id: crypto.randomUUID(), userId, date: run.date, completedAt: Date.now(),
    startedAt: run.startedAt, elapsedSeconds: Math.round(seconds * 100) / 100,
    language: run.language, type: run.type, mode: run.mode, duration: run.duration, targetCount: run.targetCount,
    completedQuestions: run.completedQuestions, typedCharacters: run.typed, correctCharacters: correct, ...metrics };
  stopRun();
  store({ attempt, status: 'draft' });
  $('final-score').textContent = `${metrics.score}점`;
  $('final-speed').textContent = `${metrics.speed}타/분`;
  $('final-accuracy').textContent = `${metrics.accuracy}%`;
  $('final-characters').textContent = `${correct}자`;
  $('speed').textContent = `${metrics.speed}타/분`;
  $('accuracy').textContent = `${metrics.accuracy}%`;
  $('time').textContent = run.mode === 'time' ? '0초' : `${run.completedQuestions}/${run.targetCount}회`;
  $('time-progress').style.width = run.mode === 'time' ? '0%' : '100%';
  $('question-progress').textContent = `${run.completedQuestions}문제 제출 완료`;
  $('result-message').textContent = '오늘의 기록에 추가했어요. 작업종료를 눌러 DB에 저장해 주세요.';
  $('result-card').classList.remove('hidden');
  $('game-status').textContent = '연습 완료';
  run = null;
  renderToday();
  message('feedback', '연습이 완료되었습니다. 결과를 확인해 보세요.');
}
function cancelGame(reason = '연습을 취소했습니다. 취소한 연습은 기록하지 않습니다.') {
  if (!run) return;
  stopRun();
  run = null;
  $('typing-input').value = '';
  $('game-status').textContent = '시작 대기';
  $('prompt').textContent = '시작 버튼을 누르면 첫 번째 문제가 나타납니다.';
  updateControls();
  updateStats();
  message('feedback', reason);
}
$('typing-input').addEventListener('input', handleTyping);
$('typing-input').addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  checkDate();
  if (!run || event.repeat || !$('typing-input').value.trim()) return;
  if (run.mode === 'time' && elapsed() >= run.duration) { completeGame(); return; }
  // 브라우저의 마지막 input 이벤트가 반영된 값을 집계합니다.
  handleTyping();
  if (!run) return;
  const correct = measure($('typing-input').value, run.question).correct;
  const isExact = $('typing-input').value === run.question;
  run.correct += correct;
  run.completedQuestions++;
  run.previousLength = 0;
  $('typing-input').value = '';
  if (run.mode === 'count' && run.completedQuestions >= run.targetCount) { completeGame(); return; }
  choose();
  message('feedback', `${isExact ? '정확합니다!' : '다음 문제로 넘어갔어요.'} ${run.completedQuestions}문제를 제출했어요.`, isExact ? 'success' : '');
  updateStats();
});

function approveDate(date) {
  for (const entry of entries.values()) {
    if (entry.attempt.date === date && entry.status === 'draft') store({ ...entry, status: 'approved' });
  }
}
async function syncApproved() {
  if (saving) return;
  const dates = [...new Set([...entries.values()].filter(entry => entry.status === 'approved').map(entry => entry.attempt.date))];
  if (!dates.length) { message('save-message', '새로 저장할 완료 기록이 없습니다.'); return; }
  saving = true;
  updateControls();
  message('save-message', '완료 기록을 DB에 저장하고 있습니다. 화면을 닫지 마세요.');
  try {
    for (const date of dates.sort()) {
      const pending = [...entries.values()].filter(entry => entry.attempt.date === date && entry.status === 'approved');
      const record = await db.saveDay(userId, date, pending.map(entry => entry.attempt));
      for (const attempt of Object.values(record.attempts || {})) store({ attempt, status: 'saved' });
    }
    message('cloud-status', 'Firebase Realtime Database 연결됨');
    message('save-message', '작업종료 완료! 날짜별 평균과 최고점수를 DB에 저장했습니다.', 'success');
  } catch (error) {
    const state = error.dailySaved ? '순위 저장을 마치지 못했습니다.' : '저장되지 않았습니다.';
    message('save-message', `${state} ${error.message} 완료 기록은 이 브라우저에 보관하며 작업종료로 재시도할 수 있습니다.`, 'error');
    message('cloud-status', db.available ? 'DB 연결 오류 · 저장 재시도가 필요합니다.' : 'Firebase 미설정 · 연습은 가능하지만 DB 저장과 조회에는 연결 설정이 필요합니다.');
  } finally {
    saving = false;
    renderToday();
  }
}
function checkDate() {
  const next = practiceDate();
  if (!userId || next === day) return;
  const previous = day;
  cancelGame('날짜가 변경되어 진행 중 연습을 취소했습니다. 새 날짜로 다시 시작해 주세요.');
  approveDate(previous);
  day = next;
  $('result-card').classList.add('hidden');
  renderToday();
  updateStats();
  // 화면이 열려 날짜가 넘어간 경우에만 전날 완료 기록을 자동 정산합니다.
  void syncApproved();
}
async function finishWork() {
  checkDate();
  if (!userId || run || saving) return;
  approveDate(day);
  await syncApproved();
}
async function loadRemoteToday() {
  if (!db.available) return;
  const history = await db.history(userId);
  const today = history.find(record => record.practiceDate === day);
  for (const attempt of Object.values(today?.attempts || {})) store({ attempt, status: 'saved' });
  message('cloud-status', 'Firebase Realtime Database 연결됨');
  renderToday();
}

function drawChart(history) {
  const container = $('history-chart');
  container.replaceChildren();
  if (!history.length) return;
  const data = [...history].sort((a, b) => a.practiceDate.localeCompare(b.practiceDate));
  const width = Math.max(600, data.length * 70 + 100);
  const height = 280;
  const left = 55, right = 35, top = 35, bottom = 65;
  const max = Math.max(10, ...data.map(item => item.highestScore)) * 1.15;
  const x = index => data.length === 1 ? width / 2 : left + index / (data.length - 1) * (width - left - right);
  const y = value => height - bottom - value / max * (height - top - bottom);
  const ns = 'http://www.w3.org/2000/svg';
  const node = (name, attrs, text) => {
    const el = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const svg = node('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': '날짜별 최고점수 꺾은선 그래프. 상세 값은 위의 기록 표에서도 확인할 수 있습니다.' });
  for (let step = 0; step <= 4; step++) {
    const value = max * step / 4;
    svg.append(node('line', { x1: left, x2: width - right, y1: y(value), y2: y(value), stroke: '#e6ebf0' }));
    svg.append(node('text', { x: left - 8, y: y(value) + 4, 'text-anchor': 'end', fill: '#7c8796', 'font-size': 11 }, Math.round(value)));
  }
  svg.append(node('polyline', { points: data.map((item, i) => `${x(i)},${y(item.highestScore)}`).join(' '), fill: 'none', stroke: '#238f86', 'stroke-width': 3 }));
  data.forEach((item, i) => {
    const dot = node('circle', { cx: x(i), cy: y(item.highestScore), r: 5, fill: '#238f86' });
    dot.append(node('title', {}, `${item.practiceDate}: ${item.highestScore}점`));
    svg.append(dot);
    svg.append(node('text', { x: x(i), y: y(item.highestScore) - 12, 'text-anchor': 'middle', fill: '#24364b', 'font-size': 11 }, item.highestScore));
    const label = node('text', { x: x(i), y: height - bottom + 20, 'text-anchor': 'end', transform: `rotate(-30 ${x(i)} ${height - bottom + 20})`, fill: '#7c8796', 'font-size': 11 }, item.practiceDate);
    svg.append(label);
  });
  container.append(svg);
}
async function showHistory() {
  $('history-card').hidden = false;
  $('history-records').replaceChildren();
  $('history-chart').replaceChildren();
  message('history-message', 'DB에서 연습 기록을 불러오고 있습니다.');
  $('history-btn').disabled = true;
  try {
    const history = await db.history(userId);
    message('history-message', history.length ? `${userId}님의 날짜별 기록입니다.` : '이전자료가 없습니다.');
    for (const record of history) cells($('history-records'), [record.practiceDate, `${record.attemptCount}회`, `${record.averageScore}점`, `${record.highestScore}점`, `${record.averageSpeed}타/분`, `${record.averageAccuracy}%`]);
    drawChart(history);
  } catch (error) {
    message('history-message', `기록을 불러오지 못했습니다. ${error.message}`);
  } finally { $('history-btn').disabled = false; }
  $('history-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function showRanking() {
  if (!userId) return;
  $('ranking-card').hidden = false;
  $('ranking-records').replaceChildren();
  message('ranking-message', '전체 사용자의 순위를 불러오고 있습니다.');
  $('ranking-btn').disabled = true;
  try {
    const users = await db.leaderboard();
    message('ranking-message', users.length ? `총 ${users.length}명이 연습했어요. 내 기록은 강조되어 표시됩니다.` : '아직 저장된 연습 기록이 없습니다. 첫 번째 기록에 도전해 보세요.');
    for (const record of users) {
      cells($('ranking-records'), [
        `${record.rank}위`, record.userId === userId ? `${record.userId} (나)` : record.userId,
        `${record.highestScore}점`, `${record.averageSpeed}타/분`, `${record.averageAccuracy}%`,
        `${record.attemptCount}회`, record.lastPracticeDate
      ]);
      if (record.userId === userId) $('ranking-records').lastElementChild.classList.add('my-ranking');
    }
  } catch (error) {
    message('ranking-message', `순위를 불러오지 못했습니다. ${error.message}`);
  } finally { $('ranking-btn').disabled = false; }
  $('ranking-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { userId = validateUserId($('user-id').value); }
  catch (error) { message('login-error', error.message); return; }
  day = practiceDate();
  loggingIn = true;
  entries = readLocal();
  $('current-user').textContent = `${userId}님`;
  $('login-dialog').close();
  renderToday();
  try {
    await loadRemoteToday();
    if ([...entries.values()].some(entry => entry.status === 'approved')) await syncApproved();
  } catch (error) { message('cloud-status', `DB 연결을 확인해 주세요. ${error.message}`); }
  loggingIn = false;
  updateControls();
  message('feedback', '준비가 되면 연습 시작을 눌러 주세요.');
});
$('login-dialog').addEventListener('cancel', event => event.preventDefault());
$('start-btn').addEventListener('click', startGame);
$('restart-btn').addEventListener('click', () => cancelGame());
$('result-retry-btn').addEventListener('click', startGame);
$('finish-btn').addEventListener('click', finishWork);
$('history-btn').addEventListener('click', showHistory);
$('history-close').addEventListener('click', () => { $('history-card').hidden = true; });
$('ranking-btn').addEventListener('click', showRanking);
$('ranking-close').addEventListener('click', () => { $('ranking-card').hidden = true; });
settings.forEach(id => $(id).addEventListener('change', () => {
  $('duration-field').hidden = $('mode').value !== 'time';
  $('count-field').hidden = $('mode').value !== 'count';
  updateStats();
}));
window.addEventListener('storage', event => {
  if (!userId || !event.key?.startsWith(prefix()) || !event.newValue) return;
  try {
    const entry = JSON.parse(event.newValue);
    if (entry.attempt.userId === userId) { entries.set(entry.attempt.id, entry); renderToday(); }
  } catch { /* 손상된 항목은 무시 */ }
});
window.addEventListener('focus', checkDate);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDate(); });
// 창 닫기와 새로고침에는 DB 쓰기를 요청하지 않습니다.
setInterval(checkDate, 1000);
message('cloud-status', db.available ? 'Firebase 연결 준비 · 아이디를 입력해 주세요.' : 'Firebase 미설정 · 연습은 가능하지만 DB 저장과 조회에는 연결 설정이 필요합니다.');
updateStats();
$('login-dialog').showModal();
