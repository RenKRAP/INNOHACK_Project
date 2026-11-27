// Representative addresses/shore points, not surveyed observation platforms.
// Shore references are manually selected from OpenStreetMap, not a coastline dataset.
export const VIEWPOINTS = [
  { id: 'ipark', name: '해운대 아이파크', lat: 35.15658, lon: 129.14259, altitude: null, buildingHeight: 292, type: '초고층 주거 건물', coast: [35.1548, 129.1409], description: '마린시티의 해안 초고층 건물. 실제 관찰하는 위치의 해발고도를 입력하세요.', note: '건축 높이 292m는 타워 2 참고값이며 관찰 고도가 아닙니다. 출입·조망 가능 여부는 별도 확인이 필요합니다.', source: 'https://libeskind.com/work/haeundae-udong-hyundai-ipark/' },
  { id: 'exllu', name: '남천 엑슬루타워', lat: 35.13993, lon: 129.10649, altitude: null, buildingHeight: null, type: '초고층 주거 건물', coast: [35.1391, 129.1144], description: '수영구 남천동의 초고층 건물. 실제 관찰하는 위치의 해발고도를 입력하세요.', note: '건물 주소 대표 좌표입니다. 관찰층 높이와 지반고도를 확인해 입력하세요. 공개 전망대로 안내하는 지점이 아닙니다.' },
  { id: 'lct', name: '해운대 엘시티', lat: 35.1597, lon: 129.1699, altitude: null, buildingHeight: null, type: '초고층 건물', coast: [35.1581, 129.1700], description: '해운대 해변 동쪽의 초고층 건물. 이용할 관찰 위치의 해발고도를 입력하세요.', note: '단지 대표 좌표이며 특정 층이나 전망대의 측량 위치가 아닙니다. 실제 관찰 지점의 고도를 사용하세요.' },
  { id: 'haeundae', name: '해운대 해수욕장', lat: 35.1587, lon: 129.1604, altitude: 5, buildingHeight: null, type: '저고도 해변', coast: [35.1582, 129.1604], description: '낮은 해안에서 해무 유입 조건을 비교하는 지점입니다.', note: '해변 대표 고도 약 5m · 조위와 촬영 위치에 따라 다릅니다. 실제 고도를 입력하면 그 값을 우선합니다.' },
  { id: 'gwangalli', name: '광안리 해수욕장', lat: 35.1532, lon: 129.1188, altitude: 5, buildingHeight: null, type: '저고도 해변', coast: [35.1530, 129.1190], description: '수영구의 낮은 해안에서 해무 유입 조건을 비교하는 지점입니다.', note: '해변 대표 고도 약 5m · 정밀 측량값이 아닙니다. 실제 고도를 입력하면 그 값을 우선합니다.' },
];

// A nearby shore reference screens presets approximately; it is not a survey.
export function coastReferenceDistance(point) {
  const [lat, lon] = point.coast;
  const rad = Math.PI / 180;
  return Math.hypot((lat - point.lat) * rad * 6371000,
    (lon - point.lon) * rad * 6371000 * Math.cos((lat + point.lat) * rad / 2));
}
