import { firebaseConfig } from "./firebase-config.js";
import { mergeDaily, userKey } from "./core.js";

// Firebase 공식 REST API: SDK와 빌드 과정 없이 동작합니다.
export class PracticeDatabase {
  constructor(config = firebaseConfig, request = (...args) => fetch(...args)) {
    this.config = config;
    this.request = request;
    this.session = null;
    this.authPending = null;
    this.available = Boolean(config.apiKey && /^https:\/\/[^/]+(?:firebaseio\.com|firebasedatabase\.app)\/?$/.test(config.databaseURL));
  }

  async call(url, options = {}) {
    const response = await this.request(url, { ...options, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error?.message || detail.error || `연결 오류 (${response.status})`);
    }
    return response;
  }

  async token() {
    if (!this.available) throw new Error("Firebase 설정이 없습니다. js/firebase-config.js를 설정해 주세요.");
    if (this.session && this.session.expiresAt > Date.now() + 60000) return this.session.idToken;
    if (this.authPending) return this.authPending;
    this.authPending = this.authenticate();
    try { return await this.authPending; } finally { this.authPending = null; }
  }

  async authenticate() {
    const storageKey = `typingAuth:${this.config.projectId || this.config.databaseURL}`;
    let refreshToken;
    try { refreshToken = localStorage.getItem(storageKey); } catch { /* 메모리 세션 사용 */ }
    let data;
    if (refreshToken) {
      try {
        const response = await this.call(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(this.config.apiKey)}`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
        });
        const refreshed = await response.json();
        data = { idToken: refreshed.id_token, refreshToken: refreshed.refresh_token, expiresIn: refreshed.expires_in };
      } catch { /* 만료된 익명 인증은 새로 시작 */ }
    }
    if (!data) {
      const response = await this.call(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(this.config.apiKey)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true })
      });
      data = await response.json();
    }
    this.session = { idToken: data.idToken, expiresAt: Date.now() + Number(data.expiresIn) * 1000 };
    try { localStorage.setItem(storageKey, data.refreshToken); } catch { /* 다음 접속 때 재인증 */ }
    return data.idToken;
  }

  async url(userId, date) {
    const token = await this.token();
    const suffix = date ? `/${date}` : "";
    return `${this.config.databaseURL.replace(/\/$/, "")}/practice/${userKey(userId)}/days${suffix}.json?auth=${encodeURIComponent(token)}`;
  }

  async history(userId) {
    const response = await this.call(await this.url(userId));
    const records = await response.json();
    return Object.values(records || {}).sort((a, b) => b.practiceDate.localeCompare(a.practiceDate));
  }

  async saveDay(userId, date, attempts) {
    // ETag 조건부 쓰기: 재시도해도 ID별로 합쳐져 중복 집계되지 않습니다.
    for (let retry = 0; retry < 5; retry++) {
      const url = await this.url(userId, date);
      const read = await this.call(url, { headers: { "X-Firebase-ETag": "true" } });
      const tag = read.headers.get("ETag");
      if (!tag) throw new Error("DB의 ETag를 받지 못했습니다. 저장을 다시 시도해 주세요.");
      const merged = mergeDaily(await read.json(), userId, date, attempts);
      const response = await this.request(url, {
        method: "PUT", headers: { "Content-Type": "application/json", "if-match": tag },
        body: JSON.stringify(merged), signal: AbortSignal.timeout(15000)
      });
      if (response.status === 412) continue;
      if (!response.ok) throw new Error(`DB 저장 실패 (${response.status}). 연결 및 보안 규칙을 확인해 주세요.`);
      return merged;
    }
    throw new Error("동시에 변경된 기록이 있습니다. 잠시 뒤 다시 저장해 주세요.");
  }
}
