import { NextResponse } from "next/server";
import { getDestinationWeather } from "../../../lib/weatherTool";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get("destination")?.trim();
    const days = Number(searchParams.get("days") ?? 3);

    if (!destination) {
      return NextResponse.json({ error: "destination is required." }, { status: 400 });
    }

    const weather = await getDestinationWeather(destination, days);

    if (!weather) {
      return NextResponse.json(
        { error: "No weather data found for destination." },
        { status: 404 },
      );
    }

    return NextResponse.json({ weather });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch weather.",
        details: error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 },
    );
  }
}
