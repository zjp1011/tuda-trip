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
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

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

export async function getDestinationWeather(destination: string, forecastDays = 3) {
  const trimmedDestination = destination.trim();

  if (!trimmedDestination) {
    return null;
  }

  const safeForecastDays = Math.min(16, Math.max(1, Math.round(forecastDays)));
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
  forecastUrl.searchParams.set("forecast_days", String(safeForecastDays));
  forecastUrl.searchParams.set("timezone", "auto");

  const forecastResponse = await fetch(forecastUrl, { signal: AbortSignal.timeout(3500) });

  if (!forecastResponse.ok) {
    throw new Error("Weather forecast request failed.");
  }

  const forecastData = (await forecastResponse.json()) as ForecastResponse;
  const daily = forecastData.daily;

  if (!daily?.time) {
    return null;
  }

  const days = daily.time.map<WeatherDay>((date, index) => {
    const weatherCode = daily.weather_code?.[index] ?? 0;

    return {
      date,
      weatherCode,
      weatherLabel: getWeatherLabel(weatherCode),
      temperatureMax: Math.round(daily.temperature_2m_max?.[index] ?? 0),
      temperatureMin: Math.round(daily.temperature_2m_min?.[index] ?? 0),
      precipitationProbability: Math.round(daily.precipitation_probability_max?.[index] ?? 0),
    };
  });

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

export function formatWeatherForPrompt(weather: DestinationWeather | null) {
  if (!weather) {
    return "天气工具暂未返回可用数据。";
  }

  return JSON.stringify(
    {
      destination: weather.destination,
      resolvedName: weather.resolvedName,
      summary: weather.summary,
      warnings: weather.warnings,
      suggestions: weather.suggestions,
      days: weather.days,
    },
    null,
    2,
  );
}
