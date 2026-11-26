"use client";

import { useEffect, useState } from "react";
import type { DestinationWeather } from "../lib/weatherTool";

type WeatherInsightCardProps = {
  destination: string;
  days: number;
  departureDate: string;
};

type ForecastResult = { query: string; weather: DestinationWeather | null; error: string };

export default function WeatherInsightCard({ destination, days, departureDate }: WeatherInsightCardProps) {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const query = new URLSearchParams({ destination, days: String(days), departureDate }).toString();

  useEffect(() => {
    if (!departureDate) return;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/weather?" + query, { signal: controller.signal });
        const data = await response.json() as { weather?: DestinationWeather; error?: string };
        if (!response.ok) throw new Error(data.error ?? "天气预报暂时不可用。");
        if (!controller.signal.aborted) setForecast({ query, weather: data.weather ?? null, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setForecast({ query, weather: null, error: error instanceof Error ? error.message : "天气预报暂时不可用。" });
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [departureDate, query]);

  if (!departureDate) return null;
  const current = forecast?.query === query ? forecast : null;
  const weather = current?.weather;

  return (
    <section className="tuda-panel p-5 sm:p-6" aria-labelledby="forecast-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="tuda-kicker">行程天气</p>
          <h3 id="forecast-heading" className="mt-1 text-xl font-bold">{weather?.resolvedName ?? destination}</h3>
        </div>
        {weather ? <p className="max-w-sm text-sm leading-6 text-[var(--tuda-muted)]">{weather.summary}</p> : null}
      </div>
      {!current || !weather ? (
        <p className="mt-3 text-sm leading-6 text-[var(--tuda-muted)]" role="status">
          {!current ? "正在查询对应日期的预报…" : current.error || "所选日期暂无可用预报，临近出发时再查看。"}
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {weather.days.map((day) => (
              <div key={day.date} className="rounded-lg border border-[var(--tuda-line)] bg-[#0c1521] p-3">
                <p className="text-xs text-[var(--tuda-muted)]">{day.date}</p>
                <p className="mt-1 font-semibold text-[var(--tuda-accent)]">{day.weatherLabel}</p>
                <p className="mt-1 text-sm">{day.temperatureMin}–{day.temperatureMax}°C</p>
                <p className="mt-1 text-xs text-[var(--tuda-muted)]">降雨概率 {day.precipitationProbability}%</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--tuda-muted)]">
            预报来源 Open-Meteo
            {weather.days.length < days ? " · 仅显示已有预报的行程日期" : ""}
          </p>
        </>
      )}
    </section>
  );
}
