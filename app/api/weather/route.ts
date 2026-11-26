import { NextResponse } from "next/server";
import { getDestinationWeather } from "../../../lib/weatherTool";
import { RequestError, requestFailure, requestUser } from "../../../lib/serverAccess";

export async function GET(request: Request) {
  try {
    requestUser(request);
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get("destination")?.trim();
    const days = Number(searchParams.get("days") ?? 3);
    if (!destination || destination.length > 100 || !Number.isInteger(days) || days < 1 || days > 7) {
      throw new RequestError(400, "请填写有效的目的地和天数。");
    }
    const weather = await getDestinationWeather(destination, days);
    if (!weather) throw new RequestError(404, "暂无目的地的天气预报。");
    return NextResponse.json({ weather });
  } catch (error) {
    return requestFailure(error, "天气服务暂不可用。");
  }
}
