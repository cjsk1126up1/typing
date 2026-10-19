// 단어는 실제 어휘 목록이며 문장은 자연스럽게 연결되는 구절을 조합합니다.
// 언어별로 단어 300개 이상, 짧은 문장 120개, 긴문장 48개를 제공합니다.
const koWords = `
가게 가격 가구 가방 가수 가을 가족 가지 가치 간식 간장 간판 갈대 갈비 감각 감독 감동 감사 감자 강물 강아지 강의 강풍 개구리 개나리 거미 거실 거울 걱정 건강 건물 걸음 검정 겨울 경계 경기 경로 경험 계곡 계단 계란 계획 고개 고구마 고기 고래 고마움 고양이 고요 고추 고향 곡식 골목 공간 공기 공부 공원 공책 과일 과자 과학 관심 광장 교실 교육 구름 구멍 구슬 구역 국수 군인 굴뚝 궁금증 권리 규칙 그늘 그림 그릇 극장 근육 글씨 금요일 기계 기념 기분 기술 기차 기침 기회 길이 김밥 깊이
나무 나비 나라 나뭇잎 나이 낙엽 낚시 날개 날씨 날짜 남쪽 냄비 냄새 냇가 너구리 넓이 노란색 노래 노력 노을 녹차 논리 놀이터 농부 농장 눈길 눈물 눈사람 뉴스 느낌 능력
다람쥐 다리 다짐 단어 단풍 달걀 달력 달리기 달빛 담요 답장 당근 대나무 대답 대문 대화 도구 도로 도시 도서관 도장 도전 독서 동네 동물 동생 동화 두부 둥지 드라마 들판 등대 딸기 땅콩 떡국 뚜껑
라디오 라면 로봇 리본 마음 마을 마지막 만남 만두 만화 말투 맛집 망원경 매력 매미 매일 머리 먼지 멋 메모 메뉴 멜로디 명절 목표 모래 모범 모양 모자 모험 목걸이 목소리 무궁화 무대 무릎 무지개 문장 문제 문화 물감 물결 물고기 물방울 물병 미소 미술 미역 미래 믿음
바구니 바나나 바다 바람 바위 박물관 박수 반달 반성 반지 발걸음 발명 밤하늘 밥상 방학 배경 배려 배움 배추 백합 버스 버섯 벌꿀 벌레 법칙 벚꽃 베개 벽돌 변화 별빛 병아리 보람 보물 보석 복숭아 봄날 봉투 부엌 부모 부채 북극 불꽃 불빛 붓글씨 비누 비둘기 비밀 비빔밥 비행기 빗방울 빙수 빛깔
사과 사랑 사막 사슴 사진 사탕 산길 산책 살구 삼각형 상상 상자 새벽 생각 생명 생선 생활 서랍 서점 선물 선생님 선풍기 설날 설명 성공 세계 세수 소금 소나기 소나무 소망 소설 소식 소중함 소풍 손길 손님 손수건 솔방울 송아지 수박 수업 수영 수요일 수첩 수학 숙제 순간 숲길 숫자 시간 시계 시골 시금치 시작 시장 시험 식당 식물 신문 신발 실내 실력 실수 실천 씨앗
아기 아낌없이 아나운서 아라리 아버지 아침 안개 안경 안내 안전 알림 앞치마 야구 야외 약속 양말 양배추 양산 양파 어깨 어른 어머니 언니 언어 얼굴 여름 여행 역사 연극 연못 연습 연필 열매 열쇠 영감 영상 영양 영화 예술 예의 오렌지 오늘 오리 오후 옥수수 온도 온실 올빼미 옷장 완성 외국 요리 요일 용기 우산 우유 우정 우주 운동 울타리 웃음 원숭이 원칙 월요일 위로 유리 유머 유자 유치원 음악 은하수 의자 의지 이불 이름 이슬 이야기 이웃 이해 인사 인생 인터넷 일기 일요일 임금 입구
자두 자동차 자라 자신감 자연 자유 자전거 작가 작은별 잔디 잠자리 장갑 장미 장바구니 재능 재미 저녁 저울 저축 전구 전기 전시 전화 절약 점심 접시 정답 정보 정성 정원 제비 조각 조건 조명 조용함 종이 주말 주머니 주방 주스 주인공 준비 줄기 줄넘기 즐거움 지갑 지도 지붕 지식 지우개 지혜 진달래 질문 질서 집중 징검다리
차례 차림 창가 창문 창작 책가방 책상 책장 처음 천장 철도 청소 청춘 체육 초록 초승달 초원 촛불 추억 축구 축제 출발 치마 친구 칫솔 칭찬 카메라 커피 코끼리 코스모스 콩나물 크기 키보드 타자 태양 태풍 토끼 토마토 토요일 통로 튤립 튼튼함 파도 파란색 파리 파수꾼 파인애플 편지 평화 포도 포부 포장 폭포 풀밭 품질 풍경 피아노 하늘 하루 학교 학생 학습 한가위 할머니 할아버지 합창 항구 해바라기 햇빛 행복 향기 허수아비 현관 형제 호기심 호랑이 호수 혼자 홍시 화가 화분 화요일 환경 환영 활동 회복 횡단보도 휴식 희망 흰색
`.trim().split(/\s+/);

const enWords = `
ability able about above accept access account across action active actor actual adapt address admire adult advice afraid after again agent agree ahead airport album alert alive allow almost alone along already also always amazing amount ancient animal answer anyone apple apply area argue around arrive artist asleep assist attack attend author autumn avoid awake aware away baby back balance ball banana band bank basic basket beach beauty because become before begin behind believe below benefit beside better between bicycle bird birthday black blanket block bloom blue board boat body book border bottle bottom bowl box brain branch brave bread break breeze bridge bright bring brother brown build busy butter button cabin cake calm camera camp candle candy canvas capital captain careful carpet carrot carry castle catch cause center century certain chair chance change chapter charge chart chase check cheese cherry chest chicken child choose circle city class clean clear climb clock close cloud coast coffee cold collect color comfort common company compare complete concert connect consider control cook cool corner correct cotton count country courage course cover create crystal culture curious curtain custom daily dance danger dark daughter dawn day decide deep degree deliver desert design desk detail develop diary discover distance doctor door double dream dress drink drive drop duck during each early earth easy echo edge effort eight either elder electric elephant empty enjoy enough enter equal escape evening event every example excite exercise expect explain explore extra face fact fair family famous farm fashion fast father favorite feather feature feeling festival field final find finish fire first fish flower focus follow food forest forget forward frame fresh friend fruit future garden gentle gift girl give glass globe golden good grain grape grass great green ground group grow guide guitar habit hair half hand happy harbor harvest hat healthy hear heart heavy helpful hidden high hill history hold holiday home honey hope horse hour house human hundred hungry idea image imagine important improve include inside inspire island jacket journey judge jump keep keyboard kind kitchen kitten knowledge lake land language large last later laugh learn leaf leave left lemon lesson letter library light limit line listen little live local lonely long look lovely lucky lunch machine magic main make manage many map market master matter meal mean measure meet memory message middle milk minute mirror modern moment money month moon morning mother mountain mouse move music name narrow nature near need neighbor never new night noise north notebook notice number ocean office often olive once open orange order other outside page paint paper parent park partner path pattern peace peach people perfect person photo piano pick picture place plain plan plant play please poem point pool possible practice prepare pretty price prize problem process promise protect proud public purple question quick quiet rabbit radio rain rainbow read ready reason record red reflect region relax remember repeat report rest return rice rich ride right river road room round rule safe sail salt same sand save school science score season second secret seed select sense serve seven shadow shape share sheep shelf shine ship shirt shoes short show side silent silver simple sister skill sky sleep slow small smile smooth snow soft soil song sound south space speak special speed spring square stable stage stand star start station stay steady stone story street strong student study success sugar summer sun support sure sweet swim table take talk task teach team tell ten thank thing think thought three time tiny today together tomorrow touch town train travel tree true trust try turn twelve type under unique united until update useful valley value very view village visit voice wait walk warm wash watch water wave way weather welcome west wheel white whole wide wild window wing winter wisdom wish woman wonder wood word work world write yellow young zebra zero zone
`.trim().split(/\s+/);

const koShortStarts = ["오늘도", "아침마다", "여유가 생기면", "연습을 마치고", "새로운 마음으로", "잠깐 쉬면서", "주말에는", "기분 좋게", "천천히", "친구와 함께", "하루를 시작하며", "작은 목표를 세우고"];
const koShortEnds = ["책을 읽어요.", "산책을 해요.", "좋은 음악을 들어요.", "새로운 것을 배워요.", "주변을 정리해요.", "일기를 써요.", "따뜻한 차를 마셔요.", "가벼운 운동을 해요.", "즐겁게 공부해요.", "예쁜 풍경을 그려요."];
const enShortStarts = ["Every morning", "After practice", "On weekends", "Before dinner", "During the break", "After school", "In the afternoon", "On a sunny day", "Before work", "After lunch", "In the evening", "On a quiet day"];
const enShortEnds = ["I read a good book.", "I take a short walk.", "I listen to music.", "I learn something new.", "I clean my desk.", "I write in my journal.", "I drink a cup of tea.", "I do some exercise.", "I practice my typing.", "I draw a little picture."];
const koLongStarts = [
  "매일 조금씩 시간을 내어 새로운 것을 배우면 어느 순간 달라진 자신을 발견하게 됩니다.",
  "좋은 습관은 처음에는 작고 사소해 보여도 시간이 지나면 커다란 변화를 만들어 냅니다.",
  "빠르게 결과를 얻으려는 마음보다 과정을 즐기는 태도가 오래도록 도움이 됩니다.",
  "맑은 날 창문을 열고 신선한 공기를 마시면 복잡했던 생각도 조금씩 정리됩니다.",
  "어려운 문제를 만났을 때 잠시 쉬었다가 다시 살펴보면 새로운 방법이 떠오릅니다.",
  "다른 사람과 속도를 비교하기보다 어제의 나보다 조금 더 성장하는 것이 중요합니다.",
  "한 번의 실수 때문에 용기를 잃지 않고 다시 도전하는 사람은 결국 앞으로 나아갑니다.",
  "일상에서 발견하는 작은 즐거움을 기록하다 보면 평범한 하루도 특별하게 느껴집니다."
];
const koLongEnds = [
  "오늘 할 수 있는 작은 일부터 차분하게 시작해 보세요.",
  "서두르지 말고 자신의 호흡에 맞추어 한 걸음씩 나아가 보세요.",
  "잠깐의 휴식과 꾸준한 연습을 번갈아 하면 마음에도 여유가 생깁니다.",
  "지금 기울이는 정성이 내일의 자신감으로 이어질 것입니다.",
  "스스로 노력한 과정을 돌아보고 잘해 낸 부분을 칭찬해 주세요.",
  "새로운 하루에도 호기심을 잃지 않고 배움을 이어 가면 좋겠습니다."
];
const enLongStarts = [
  "Learning something new every day helps us notice progress that once seemed impossible.",
  "Small habits may seem unimportant at first, but they can make a big difference over time.",
  "Enjoying the process is often more helpful than trying to reach every goal as quickly as possible.",
  "Opening a window and breathing fresh air on a clear morning can help us organize our thoughts.",
  "When a problem feels difficult, taking a short break can help us discover a different solution.",
  "Comparing yourself with yesterday is more useful than comparing your speed with everyone else.",
  "People who keep trying after a mistake gradually build the confidence to take the next step.",
  "Writing down small moments of joy can make even an ordinary day feel interesting and special."
];
const enLongEnds = [
  "Start with one small task that you can complete today.",
  "Take your time and move forward at a pace that feels comfortable.",
  "A healthy balance of rest and practice makes it easier to keep going.",
  "The care you put into your work today can become confidence tomorrow.",
  "Look back at your effort and give yourself credit for what you have learned.",
  "Stay curious and carry that spirit of learning into another new day."
];
const combine = (starts, ends) => starts.flatMap(start => ends.map(end => `${start} ${end}`));
export const questions = Object.freeze({
  ko: { words: [...new Set(koWords)], short: combine(koShortStarts, koShortEnds), long: combine(koLongStarts, koLongEnds) },
  en: { words: [...new Set(enWords)], short: combine(enShortStarts, enShortEnds), long: combine(enLongStarts, enLongEnds) }
});
