export interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevation: number | null;
  kind: string;
}

export const REFERENCE_LOCATION: MapLocation = {
  id: "reference", name: "해운대 대표 지점", lat: 35.15950, lon: 129.16040,
  elevation: null, kind: "기본 분석 위치",
};

export const COASTAL_VIEWPOINTS: MapLocation[] = [
  { id: "ipark", name: "해운대 아이파크", lat: 35.15658, lon: 129.14259, elevation: null, kind: "건물 대표 좌표" },
  { id: "exllu", name: "남천 엑슬루타워", lat: 35.13993, lon: 129.10649, elevation: null, kind: "건물 대표 좌표" },
  { id: "lct-observatory", name: "해운대 엘시티", lat: 35.15970, lon: 129.16990, elevation: null, kind: "건물 대표 좌표" },
  { id: "haeundae-beach", name: "해운대 해수욕장", lat: 35.15870, lon: 129.16040, elevation: 5, kind: "해변 대표 지점" },
  { id: "gwangalli", name: "광안리 해수욕장", lat: 35.15320, lon: 129.11880, elevation: 5, kind: "해변 대표 지점" },
  { id: "dalmaji", name: "달맞이언덕", lat: 35.1568, lon: 129.1816, elevation: null, kind: "해월정 인근 대표 지점" },
];

export const INLAND_VIEWPOINTS: MapLocation[] = [
  { id: "hwangnyeongsan", name: "황령산", lat: 35.15740, lon: 129.08240, elevation: 427, kind: "산 전망 지점" },
  { id: "jangsan", name: "장산", lat: 35.19400, lon: 129.14470, elevation: 634, kind: "산 전망 지점" },
  { id: "dongbaek", name: "동백섬", lat: 35.15320, lon: 129.15130, elevation: 32, kind: "섬 전망 지점" },
];

export const MAP_VIEWPOINTS = [...COASTAL_VIEWPOINTS, ...INLAND_VIEWPOINTS];

export function coordinateKey({ lat, lon }: MapLocation) {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}
