import heroImageUrl from "../../assets/haeundae-fog-enhanced.png";

export type FogStatus = "해무 위" | "경계" | "해무 속";
export type ViewpointFilter = "전체" | FogStatus;

export interface HourlyForecastPoint {
  time: string;
  hour: number;
  probability: number;
  fogTopMeters: number;
  note: string;
}

export interface ViewpointSpot {
  id: string;
  name: string;
  englishName: string;
  status: FogStatus;
  elevationMeters: number;
  recommendedTime: string;
  visibilitySummary: string;
  description: string;
  photoTip: string;
  /** SVG map coordinates (viewBox 0 0 680 440) */
  x: number;
  y: number;
  labelAlign?: "left" | "right" | "top" | "bottom";
}

export const HERO_IMAGE_URL = heroImageUrl;

export const HOURLY_FORECAST: HourlyForecastPoint[] = [
  { time: "03:00", hour: 3, probability: 32, fogTopMeters: 80, note: "연안 수증기 유입 시작" },
  { time: "04:00", hour: 4, probability: 48, fogTopMeters: 105, note: "백사장·동백섬 저층 안개" },
  { time: "05:00", hour: 5, probability: 64, fogTopMeters: 125, note: "해무 유입 본격화" },
  { time: "06:00", hour: 6, probability: 75, fogTopMeters: 145, note: "최고 확률 · 고층부만 해무 위 노출" },
  { time: "07:00", hour: 7, probability: 73, fogTopMeters: 140, note: "아침 햇살과 해무 경계 선명" },
  { time: "08:00", hour: 8, probability: 66, fogTopMeters: 120, note: "해안선부터 서서히 옅어짐" },
  { time: "09:00", hour: 9, probability: 52, fogTopMeters: 95, note: "기온 상승으로 상단 고도 하강" },
  { time: "10:00", hour: 10, probability: 34, fogTopMeters: 60, note: "부분 시정 확보 · 옅은 박무" },
  { time: "11:00", hour: 11, probability: 18, fogTopMeters: 25, note: "오전 11시쯤 대부분 걷힘" },
  { time: "12:00", hour: 12, probability: 10, fogTopMeters: 0, note: "맑은 여름 시정 회복" },
  { time: "13:00", hour: 13, probability: 8, fogTopMeters: 0, note: "해풍 전환 · 쾌청" },
];

export const FORECAST_WINDOW = { start: "05:00", end: "09:00", clearing: "11:00" } as const;
export const PEAK_HOURLY_FORECAST = HOURLY_FORECAST.reduce((peak, hour) => hour.probability > peak.probability ? hour : peak);

export const VIEWPOINT_SPOTS: ViewpointSpot[] = [
  {
    id: "hwangnyeongsan",
    name: "황령산",
    englishName: "Hwangnyeongsan 봉수대",
    status: "해무 위",
    elevationMeters: 427,
    recommendedTime: "05:30 — 07:30",
    visibilitySummary: "해무 상층 조망 · 광안대교와 마린시티 스카이라인",
    description:
      "수영만에서 밀려드는 해무층보다 약 280m 위에 자리해, 구름 바다 위로 솟은 마린시티와 광안대교 주탑을 한눈에 담을 수 있습니다.",
    photoTip: "봉수대 남동쪽 데크에서 70-200mm 망원 렌즈로 마린시티 첨탑을 압축해 보세요.",
    x: 152,
    y: 205,
    labelAlign: "bottom",
  },
  {
    id: "jangsan",
    name: "장산",
    englishName: "Jangsan 정상·옥녀봉",
    status: "해무 위",
    elevationMeters: 634,
    recommendedTime: "05:20 — 07:10",
    visibilitySummary: "동부산 전역 조망 · 해운대~송정 해무 능선",
    description:
      "해운대 뒤편에서 가장 높은 시야를 확보할 수 있는 곳으로, 백사장과 도심 저층부가 흰 안개 아래로 잠기는 장면을 내려다봅니다.",
    photoTip: "옥녀봉 능선 전망 바위에서는 해운대 신시가지와 엘시티가 구름 섬처럼 보입니다.",
    x: 418,
    y: 94,
    labelAlign: "right",
  },
  {
    id: "dongbaek",
    name: "동백섬",
    englishName: "Dongbaekseom 누리마루 일대",
    status: "경계",
    elevationMeters: 32,
    recommendedTime: "06:30 — 08:30",
    visibilitySummary: "해무 경계대 · 수면 안개와 마천루 하단 교차",
    description:
      "해무의 짙은 층과 옅은 층이 맞닿는 경계 지점입니다. 바다 쪽은 안개에 잠기고, 뒤편 고층 빌딩 상단은 햇빛을 받아 몽환적인 대비를 이룹니다.",
    photoTip: "누리마루 해안 산책로에서 마린시티 방향으로 광각 촬영하면 안개 띠가 잘 살아납니다.",
    x: 342,
    y: 314,
    labelAlign: "left",
  },
  {
    id: "haeundae-beach",
    name: "해운대 해변",
    englishName: "Haeundae 백사장",
    status: "해무 속",
    elevationMeters: 2,
    recommendedTime: "07:00 — 09:30",
    visibilitySummary: "가시거리 150m 내외 · 짙은 바다 안개 속 산책",
    description:
      "해수면 바로 위라 해무 한가운데에 들어가게 됩니다. 멀리 스카이라인을 보기는 어렵지만, 파도 소리와 함께 고요한 안개 해변을 걷기 좋습니다.",
    photoTip: "파라솔과 방파제 실루엣을 전경으로 두면 미니멀한 여름 흑백·저채도 사진이 완성됩니다.",
    x: 448,
    y: 282,
    labelAlign: "bottom",
  },
  {
    id: "lct-observatory",
    name: "엘시티 전망대",
    englishName: "BUSAN X the SKY (98~100F)",
    status: "해무 위",
    elevationMeters: 384,
    recommendedTime: "06:15 — 08:15",
    visibilitySummary: "해무 직상부 부감 · 구름을 뚫고 선 해운대",
    description:
      "백사장 바로 옆에서 수직으로 380m 이상 솟아 있어, 발아래로 해운대 해무가 깔리는 장면을 가장 가까이에서 내려다볼 수 있습니다.",
    photoTip: "유리창 반사를 줄이려면 어두운 옷차림과 실리콘 렌즈 후드를 준비하는 것이 좋습니다.",
    x: 526,
    y: 246,
    labelAlign: "right",
  },
];
