# Open-Meteo 최신 예보

사용자가 지정한 세 API를 선택 좌표로 조회한다. 인증키는 필요하지 않으며 기존 `.env`는 변경하지 않는다. KIM 어댑터는 보존하되 현재 최신 예보에서는 호출하지 않는다.

| 출처 | 요청 | 변수와 단위 |
|---|---|---|
| JMA MSM 5km | `https://api.open-meteo.com/v1/forecast?models=jma_msm` | `temperature_2m`·`dew_point_2m` (°C), `relative_humidity_2m` (%), `wind_speed_10m` (m/s), `wind_direction_10m` (°) |
| 기본 예보 모델 | `https://api.open-meteo.com/v1/forecast` (models 생략) | `visibility` (m), 1000/975/950/925/900/850hPa `relative_humidity_*` (%)·`geopotential_height_*` (m) |
| Marine | `https://marine-api.open-meteo.com/v1/marine` | `sea_surface_temperature` (°C), `cell_selection=sea` |

모든 요청은 `latitude`, `longitude`, `forecast_hours=48`, `timezone=Asia/Seoul`을 사용한다. 지상 바람에는 `wind_speed_unit=ms`를 명시한다. 배열 인덱스 대신 KST 시각 문자열로 가시거리·기압면·SST를 결합한다. 결측을 보간하거나 0으로 대체하지 않는다.

서버는 모든 좌표에 걸쳐 외부 요청을 최대 2개만 동시에 실행하고 각 요청에 20초 제한을 둔다. 좌표별 예보 캐시는 5분, 과거 자료는 24시간이며 최대 32개를 유지한다. 동일 요청은 진행 중인 조회를 공유한다. `GET /api/weather?mode=forecast&lat=35.16&lon=129.17&refresh=1`로 캐시를 건너뛰어 조회한다.

화면이 보일 때 최신 예보를 5분마다 갱신한다. 숨겨진 탭으로 돌아왔을 때 자료가 오래됐으면 갱신한다. 수동 재조회는 서버 캐시도 건너뛴다. 이는 제공자의 새 모델 발행을 보장하는 주기가 아니다. `fetchedAt`은 실제 수집시각이며 모델 발행시각으로 표시하지 않는다. 출처 URL과 실제 응답 격자는 메타데이터에 기록한다.

JMA 조회가 실패하면 오류를 표시한다. Marine 조회 실패 시 지상 자료는 유지하지만 SST가 없으므로 해무 점수는 미확정이다. 기본 모델 조회 실패 시 가시거리와 해무층 높이는 미확정이다. 가시거리는 화면에서 km로 표시하고 CSV에서는 `visibility_m`으로 내보낸다. 현재 해무 점수식에는 가시거리를 추가하지 않았다.

5km는 JMA MSM 지상 모델의 격자 간격이다. 기본 예보의 가시거리·기압면 자료와 Marine SST는 다른 모델과 해상도이며, 전체 자료를 5km 또는 1km 예보로 해석하면 안 된다. 인접 위치가 같은 격자를 공유할 수 있고, 고층 건물의 실제 시야나 해무 예측 정확도는 관측 검증이 필요하다. 2026년 7월 저장 자료는 기존 GFS/Marine 자료를 유지한다.

공식 문서: [JMA](https://open-meteo.com/en/docs/jma-api), [Forecast](https://open-meteo.com/en/docs), [Marine](https://open-meteo.com/en/docs/marine-weather-api).

## 서버 API 오류 확인

`/api/health`는 프로세스 응답만 확인하며 기상자료 연결 성공을 보장하지 않는다. 실제 연결은 `/api/weather?mode=forecast`로 확인한다. 연결 실패·HTTP 429/5xx는 최대 3회 시도하며 500/1000ms 간격을 둔다. 영구적인 HTTP 오류는 재시도하지 않는다.

최신 코드에서 실패 응답의 `code`로 연결(`OPEN_METEO_CONNECTION`), 요청 제한(`OPEN_METEO_RATE_LIMIT`), HTTP 오류(`OPEN_METEO_HTTP`), 응답 형식(`OPEN_METEO_FORMAT`/`OPEN_METEO_DATA`)을 구분한다. Render Logs에서 `weather_api_failure`를 검색하면 출처(`source`), 제공자 HTTP 상태(`upstreamStatus`), 알려진 네트워크 코드(`networkCode`)를 확인할 수 있다. 원문 오류·URL·인증키는 로그에 기록하지 않는다. 이 로그는 수정 코드가 실행되는 환경에서만 생성된다.
