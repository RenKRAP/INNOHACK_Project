// The selected day takes precedence over the timeline's previously selected hour.
export function selectAnalysisTime(hours, date, time, fallbackTime) {
  const dates = [...new Set(hours.map(hour => hour.time.slice(0, 10)))];
  const selectedDate = dates.includes(date) ? date
    : dates.includes(fallbackTime?.slice(0, 10)) ? fallbackTime.slice(0, 10) : dates[0];
  const day = hours.filter(hour => hour.time.slice(0, 10) === selectedDate);
  const clock = (time || fallbackTime)?.slice(11, 16);
  return { date: selectedDate, index: Math.max(0, day.findIndex(hour => hour.time.slice(11, 16) === clock)) };
}
