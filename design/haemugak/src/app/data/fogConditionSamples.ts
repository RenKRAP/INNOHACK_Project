interface ConditionSample {
  score: number;
  airTemp: number;
  seaTemp: number;
  humidity: number;
  windDirection: string;
  windSpeed: number;
  topRange: readonly [number, number] | null;
}

// Illustrative readings for the timeline in the design preview.
export const FOG_CONDITION_SAMPLES: Partial<Record<number, ConditionSample>> = {
  3: { score: 48, airTemp: 24.8, seaTemp: 23.2, humidity: 86, windDirection: "동풍 90°", windSpeed: 1.7, topRange: [45, 115] },
  4: { score: 58, airTemp: 24.7, seaTemp: 23.1, humidity: 88, windDirection: "동남동풍 110°", windSpeed: 2.2, topRange: [65, 145] },
  5: { score: 71, airTemp: 24.9, seaTemp: 23.1, humidity: 92, windDirection: "남동풍 130°", windSpeed: 2.8, topRange: [80, 170] },
  6: { score: 82, airTemp: 25.1, seaTemp: 23.1, humidity: 95, windDirection: "남동풍 135°", windSpeed: 3.2, topRange: [100, 190] },
  7: { score: 78, airTemp: 25.3, seaTemp: 23.2, humidity: 94, windDirection: "남동풍 140°", windSpeed: 3.0, topRange: [95, 185] },
  8: { score: 72, airTemp: 25.7, seaTemp: 23.3, humidity: 91, windDirection: "남동풍 145°", windSpeed: 2.7, topRange: [75, 165] },
  9: { score: 59, airTemp: 26.2, seaTemp: 23.4, humidity: 88, windDirection: "남남동풍 155°", windSpeed: 2.4, topRange: [55, 135] },
  10: { score: 43, airTemp: 26.8, seaTemp: 23.5, humidity: 84, windDirection: "남남동풍 165°", windSpeed: 2.6, topRange: [25, 95] },
  11: { score: 28, airTemp: 27.3, seaTemp: 23.6, humidity: 80, windDirection: "남풍 175°", windSpeed: 3.1, topRange: [0, 55] },
  12: { score: 15, airTemp: 27.8, seaTemp: 23.7, humidity: 77, windDirection: "남풍 180°", windSpeed: 3.5, topRange: null },
  13: { score: 12, airTemp: 28.1, seaTemp: 23.8, humidity: 74, windDirection: "남남서풍 195°", windSpeed: 3.8, topRange: null },
};
