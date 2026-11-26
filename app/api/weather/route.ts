import { NextResponse } from "next/server";
import { getDestinationWeather, parseDepartureDate } from "../../../lib/weatherTool";
import { RequestError, requestFailure, requestUser } from "../../../lib/serverAccess";

export async function GET(request: Request) {
  try {
    requestUser(request);
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get("destination")?.trim();
    const days = Number(searchParams.get("days") ?? 3);
    const departureDate = parseDepartureDate(searchParams.get("departureDate"));
    if (departureDate === null) throw new RequestError(400, "出发日期无效，请重新选择。");
    if (!destination || destination.length > 100 || !Number.isInteger(days) || days < 1 || days > 7) {
      throw new RequestError(400, "请填写有效的目的地和天数。");
    }
    const weather = await getDestinationWeather(destination, days, departureDate).catch(() => null);
    return NextResponse.json({ weather });
  } catch (error) {
    return requestFailure(error, "天气服务暂不可用。");
  }
}
