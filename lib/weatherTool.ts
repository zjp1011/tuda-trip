export type WeatherDay = {
  date: string;
  weatherCode: number;
  weatherLabel: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
};

export type DestinationWeather = {
  destination: string;
  resolvedName: string;
  country?: string;
  latitude: number;
  longitude: number;
  days: WeatherDay[];
  summary: string;
  warnings: string[];
  suggestions: string[];
};

type GeocodingResponse = {
  results?: Array<{
    name: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
};

type ForecastResponse = {
  daily?: {
    time?: string[];
    weather_code?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
  };
};

const MAX_FORECAST_DAYS = 16;
const DAY_MS = 86_400_000;

export function parseDepartureDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function getWeatherLabel(code: number) {
  if (code === 0) {
    return "晴";
  }

  if ([1, 2, 3].includes(code)) {
    return "多云";
  }

  if ([45, 48].includes(code)) {
    return "有雾";
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return "毛毛雨";
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "降雨";
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "降雪";
  }

  if ([95, 96, 99].includes(code)) {
    return "雷雨";
  }

  return "天气变化";
}

function buildWeatherAdvice(days: WeatherDay[]) {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const rainyDays = days.filter((day) => day.precipitationProbability >= 50);
  const hotDays = days.filter((day) => day.temperatureMax >= 32);
  const coldDays = days.filter((day) => day.temperatureMin <= 5);

  if (rainyDays.length > 0) {
    warnings.push(`${rainyDays.length} 天降雨概率偏高，户外景点需要准备备选方案。`);
    suggestions.push("优先安排博物馆、展览、茶馆、商圈或室内餐厅作为雨天替代。");
  }

  if (hotDays.length > 0) {
    warnings.push(`${hotDays.length} 天最高温偏高，午后户外活动不宜过密。`);
    suggestions.push("把户外景点放在上午或傍晚，中午安排休息和室内餐食。");
  }

  if (coldDays.length > 0) {
    warnings.push(`${coldDays.length} 天最低温偏低，夜间活动需要注意保暖。`);
    suggestions.push("夜景和夜市安排不宜太晚，住宿区域尽量靠近地铁或打车方便。");
  }

  if (warnings.length === 0) {
    suggestions.push("天气整体稳定，可以按常规户外加美食节奏安排。");
  }

  return { warnings, suggestions };
}

function buildWeatherSummary(days: WeatherDay[]) {
  if (days.length === 0) {
    return "暂无天气数据";
  }

  const labels = Array.from(new Set(days.map((day) => day.weatherLabel))).join("、");
  const maxTemperature = Math.max(...days.map((day) => day.temperatureMax));
  const minTemperature = Math.min(...days.map((day) => day.temperatureMin));
  const maxRainProbability = Math.max(...days.map((day) => day.precipitationProbability));

  return `${days.length} 天预报以${labels}为主，气温约 ${minTemperature}-${maxTemperature}°C，最高降雨概率 ${maxRainProbability}%`;
}

export async function getDestinationWeather(destination: string, travelDays: number, departureDate?: string) {
  const trimmedDestination = destination.trim();
  const start = parseDepartureDate(departureDate);

  if (!trimmedDestination || !start || !Number.isInteger(travelDays) || travelDays < 1) {
    return null;
  }

  const departureTime = Date.parse(`${start}T00:00:00Z`);
  const offset = departureTime / DAY_MS - Math.floor(Date.now() / DAY_MS);
  // The destination's local date can be a day ahead of or behind UTC. The returned local dates decide coverage.
  if (offset < -1 || offset > MAX_FORECAST_DAYS) return null;
  const forecastDays = Math.min(MAX_FORECAST_DAYS, travelDays + offset + 1);
  const lastDay = new Date(departureTime + (travelDays - 1) * DAY_MS).toISOString().slice(0, 10);
  const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodingUrl.searchParams.set("name", trimmedDestination);
  geocodingUrl.searchParams.set("count", "1");
  geocodingUrl.searchParams.set("language", "zh");
  geocodingUrl.searchParams.set("format", "json");

  const geocodingResponse = await fetch(geocodingUrl, { signal: AbortSignal.timeout(3500) });

  if (!geocodingResponse.ok) {
    throw new Error("Weather geocoding request failed.");
  }

  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse;
  const location = geocodingData.results?.[0];

  if (!location) {
    return null;
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(location.latitude));
  forecastUrl.searchParams.set("longitude", String(location.longitude));
  forecastUrl.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
    ].join(","),
  );
  forecastUrl.searchParams.set("forecast_days", String(forecastDays));
  forecastUrl.searchParams.set("timezone", "auto");

  const forecastResponse = await fetch(forecastUrl, { signal: AbortSignal.timeout(3500) });

  if (!forecastResponse.ok) {
    throw new Error("Weather forecast request failed.");
  }

  const forecastData = (await forecastResponse.json()) as ForecastResponse;
  const daily = forecastData.daily;

  if (!Array.isArray(daily?.time) || daily.time.length === 0 || start < daily.time[0]) {
    return null;
  }

  const days = daily.time.flatMap<WeatherDay>((date, index) => {
    if (typeof date !== "string" || date < start || date > lastDay) return [];

    const weatherCode = daily.weather_code?.[index];
    const high = daily.temperature_2m_max?.[index];
    const low = daily.temperature_2m_min?.[index];
    const rain = daily.precipitation_probability_max?.[index];
    if (weatherCode == null || high == null || low == null || rain == null ||
        ![weatherCode, high, low, rain].every(Number.isFinite)) return [];

    return [{
      date,
      weatherCode,
      weatherLabel: getWeatherLabel(weatherCode),
      temperatureMax: Math.round(high),
      temperatureMin: Math.round(low),
      precipitationProbability: Math.round(rain),
    }];
  });

  if (days.length === 0) return null;

  const advice = buildWeatherAdvice(days);

  return {
    destination: trimmedDestination,
    resolvedName: location.name,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude,
    days,
    summary: buildWeatherSummary(days),
    warnings: advice.warnings,
    suggestions: advice.suggestions,
  } satisfies DestinationWeather;
}

export function formatWeatherForPrompt(weather: DestinationWeather | null, departureDate?: string) {
  if (!weather) {
    return "本次出行日期暂无可用预报。";
  }

  const departureTime = departureDate ? Date.parse(`${departureDate}T00:00:00Z`) : NaN;
  return JSON.stringify(
    {
      destination: weather.destination,
      resolvedName: weather.resolvedName,
      summary: weather.summary,
      warnings: weather.warnings,
      suggestions: weather.suggestions,
      days: weather.days.map((day) => ({
        ...day,
        day_number: Number.isFinite(departureTime)
          ? (Date.parse(`${day.date}T00:00:00Z`) - departureTime) / DAY_MS + 1
          : undefined,
      })),
    },
    null,
    2,
  );
}
