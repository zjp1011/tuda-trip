"use client";

import { useEffect, useState } from "react";
import type { DestinationWeather } from "../lib/weatherTool";

type WeatherInsightCardProps = {
  destination: string;
  days: number;
};

export default function WeatherInsightCard({ destination, days }: WeatherInsightCardProps) {
  const [weather, setWeather] = useState<DestinationWeather | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const trimmedDestination = destination.trim();

    if (!trimmedDestination) {
      setWeather(null);
      setErrorMessage("");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      const loadWeather = async () => {
        setIsLoading(true);
        setErrorMessage("");

        try {
          const response = await fetch(
            `/api/weather?destination=${encodeURIComponent(trimmedDestination)}&days=${days}`,
            { signal: controller.signal },
          );
          const data = (await response.json()) as {
            weather?: DestinationWeather;
            error?: string;
          };

          if (!response.ok) {
            throw new Error(data.error ?? "天气工具暂时不可用");
          }

          setWeather(data.weather ?? null);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setWeather(null);
          setErrorMessage(error instanceof Error ? error.message : "天气工具暂时不可用");
        } finally {
          setIsLoading(false);
        }
      };

      void loadWeather();
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [destination, days]);

  if (!destination.trim()) {
    return null;
  }

  return (
    <section className="px-5 pb-8 sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/15 bg-black/40 p-5 text-left text-white shadow-2xl shadow-black/20 backdrop-blur-xl lg:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
              Weather Tool
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {isLoading ? "正在查询目的地天气..." : `${weather?.resolvedName ?? destination} 天气参考`}
            </h2>
          </div>
          {weather ? <p className="text-sm text-white/45">{weather.summary}</p> : null}
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white/55">
            {errorMessage}
          </p>
        ) : null}

        {weather ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {weather.days.slice(0, 4).map((day) => (
                <div
                  key={day.date}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
                >
                  <p className="text-xs font-bold text-white/40">{day.date}</p>
                  <p className="mt-2 text-lg font-black text-orange-200">{day.weatherLabel}</p>
                  <p className="mt-2 text-sm text-white/60">
                    {day.temperatureMin}-{day.temperatureMax}°C
                  </p>
                  <p className="mt-1 text-xs text-white/45">降雨概率 {day.precipitationProbability}%</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {(weather.warnings.length > 0 ? weather.warnings : weather.suggestions)
                .slice(0, 2)
                .map((item) => (
                  <p
                    key={item}
                    className="rounded-2xl border border-orange-200/15 bg-orange-300/10 px-4 py-3 text-sm font-semibold text-orange-100/80"
                  >
                    {item}
                  </p>
                ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
