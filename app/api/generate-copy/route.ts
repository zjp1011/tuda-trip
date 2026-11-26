import { NextResponse } from "next/server";
import { callDeepSeek, claimPaidRequest, readDeepSeekKey, readJson, RequestError, requestFailure, requestUser, requireSameOrigin } from "../../../lib/serverAccess";

type CopyPlatform = "xiaohongshu" | "moments";

type GenerateCopyRequestBody = {
  tripSummary?: string | Record<string, unknown>;
  platform?: CopyPlatform;
};

const systemPrompts: Record<CopyPlatform, string> = {
  xiaohongshu: `你是一个深谙小红书爆款流量密码的旅游博主。请根据用户提供的【旅行行程信息】，写一篇种草攻略文案。
要求：

标题要吸睛，单独占一行，带有情绪价值（如：绝美！成都3天2晚保姆级攻略）。

正文要提炼行程中的亮点，语气像和闺蜜聊天一样有网感。

大量使用 Emoji（如✨、🍃、📷、🔥等）进行排版。

结尾附带 5-8 个热门 Hashtag。`,
  moments: `你是一个随性、有品位的人。请根据用户提供的【旅行行程信息】，写一段适合发微信朋友圈的总结性文案。
要求：

字数精简，不超过 3 句话，拒绝长篇大论。

语气要松弛、自然，像是不经意间的旅行感慨。

最多使用 1-2 个 Emoji，不需要 Hashtag。`,
};

function normalizeTripSummary(tripSummary: GenerateCopyRequestBody["tripSummary"]) {
  if (typeof tripSummary === "string") {
    return tripSummary.trim();
  }

  if (tripSummary && typeof tripSummary === "object") {
    return JSON.stringify(tripSummary, null, 2);
  }

  return "";
}

function extractCopyText(data: unknown) {
  if (typeof data !== "object" || data === null || !("choices" in data)) {
    return "";
  }

  const choices = data.choices;

  if (!Array.isArray(choices)) {
    return "";
  }

  const content = choices[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const user = requestUser(request);
    requireSameOrigin(request);
    const apiKey = readDeepSeekKey(request);
    const body = await readJson<GenerateCopyRequestBody>(request);
    const platform = body.platform;
    const tripSummary = normalizeTripSummary(body.tripSummary);

    if (platform !== "xiaohongshu" && platform !== "moments") {
      return NextResponse.json(
        { error: "Invalid platform. Use 'xiaohongshu' or 'moments'." },
        { status: 400 },
      );
    }

    if (!tripSummary || tripSummary.length > 36_000) {
      return NextResponse.json(
        { error: "tripSummary is required." },
        { status: 400 },
      );
    }

    release = await claimPaidRequest(user);
    const data = await callDeepSeek(apiKey, [
      { role: "system", content: systemPrompts[platform] },
      { role: "user", content: `【旅行行程信息】\n${tripSummary}` },
    ], { timeout: 35_000, maxTokens: platform === "xiaohongshu" ? 1200 : 300 });
    const copy = extractCopyText(data);

    if (!copy) {
      throw new RequestError(502, "DeepSeek 返回的文案为空，请重试。");
    }

    return NextResponse.json({ copy });
  } catch (error) {
    return requestFailure(error, "暂时无法生成分享文案。");
  } finally {
    release?.();
  }
}
