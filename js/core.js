export function practiceDate(time = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(time));
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type).value).join("-");
}

export function validateUserId(value) {
  const id = value.normalize("NFC").trim();
  if (!/^[\p{L}\p{N}_-]{1,32}$/u.test(id)) {
    throw new Error("아이디는 한글·영문·숫자·밑줄·하이픈으로 1~32자 입력해 주세요.");
  }
  return id;
}

export function userKey(id) {
  return Array.from(new TextEncoder().encode(id), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function measure(typed, question) {
  let correct = 0;
  for (let i = 0; i < Math.min(typed.length, question.length); i++) {
    if (typed[i] === question[i]) correct++;
  }
  return { typed: typed.length, correct };
}

export function resultMetrics(correct, typed, elapsedSeconds) {
  const accuracy = typed ? Math.round(correct / typed * 100) : 100;
  return {
    accuracy,
    speed: Math.round(correct / Math.max(1, elapsedSeconds) * 60),
    score: Math.round(correct * accuracy / 100)
  };
}

export function summarize(attempts) {
  const list = Object.values(attempts || {});
  const total = field => list.reduce((sum, item) => sum + item[field], 0);
  const count = list.length;
  const average = field => count ? Math.round(total(field) / count * 100) / 100 : 0;
  return {
    attemptCount: count,
    averageScore: average("score"),
    highestScore: count ? Math.max(...list.map(item => item.score)) : 0,
    averageSpeed: average("speed"),
    averageAccuracy: average("accuracy"),
    totalPracticeSeconds: Math.round(total("elapsedSeconds") * 100) / 100,
    totalQuestions: total("completedQuestions")
  };
}

export function mergeDaily(existing, userId, date, attempts, updatedAt = Date.now()) {
  const merged = { ...(existing?.attempts || {}) };
  for (const attempt of attempts) {
    if (attempt.date !== date || attempt.userId !== userId) throw new Error("다른 사용자 또는 날짜의 기록은 합칠 수 없습니다.");
    merged[attempt.id] = attempt;
  }
  return { userId, practiceDate: date, ...summarize(merged), attempts: merged, updatedAt, schemaVersion: 1 };
}

export function mergeLeaderboard(existing, daily) {
  const days = { ...(existing?.days || {}) };
  const previous = days[daily.practiceDate];
  // 뒤늦게 도착한 동일 날짜의 오래된 응답이 더 많은 회차를 덮어쓰지 않게 합니다.
  if (!previous || daily.attemptCount >= previous.attemptCount) {
    const attempts = Object.values(daily.attempts || {});
    const total = field => attempts.reduce((sum, attempt) => sum + attempt[field], 0);
    days[daily.practiceDate] = {
      highestScore: daily.highestScore, attemptCount: daily.attemptCount,
      totalScore: total('score'), totalSpeed: total('speed'), totalAccuracy: total('accuracy')
    };
  }
  const dates = Object.keys(days).sort().reverse();
  const total = field => Object.values(days).reduce((sum, item) => sum + item[field], 0);
  const attemptCount = total('attemptCount');
  const highestScore = Math.max(0, ...Object.values(days).map(item => item.highestScore));
  const average = field => attemptCount ? Math.round(total(field) / attemptCount * 100) / 100 : 0;
  return {
    userId: daily.userId, highestScore, attemptCount,
    averageScore: average('totalScore'), averageSpeed: average('totalSpeed'), averageAccuracy: average('totalAccuracy'),
    practiceDays: dates.length, lastPracticeDate: dates[0],
    bestDate: dates.find(date => days[date].highestScore === highestScore),
    days, updatedAt: Date.now()
  };
}

export function rankUsers(records) {
  const users = Object.values(records || {}).filter(record => record?.attemptCount > 0)
    .sort((a, b) => b.highestScore - a.highestScore || a.userId.localeCompare(b.userId, 'ko'));
  let rank = 0;
  return users.map((record, index) => {
    if (!index || record.highestScore !== users[index - 1].highestScore) rank = index + 1;
    return { ...record, rank };
  });
}

export function shuffled(source, random = Math.random) {
  const result = [...source];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function nextQuestion(deck, source, previous) {
  if (!deck.length) {
    deck.push(...shuffled(source));
    if (deck.length > 1 && deck[deck.length - 1] === previous) {
      [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    }
  }
  return deck.pop();
}
