"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useDeepSeekRequest } from "./DeepSeekKey";

type SharePlatform = "xiaohongshu" | "moments";

interface SocialShareModalProps {
  tripSummary: string | object;
  buttonClassName?: string;
}

const platformTabs: Array<{
  label: string;
  value: SharePlatform;
}> = [
  { label: "小红书风", value: "xiaohongshu" },
  { label: "朋友圈风", value: "moments" },
];

export default function SocialShareModal({ tripSummary, buttonClassName }: SocialShareModalProps) {
  const requestDeepSeek = useDeepSeekRequest();
  const [isOpen, setIsOpen] = useState(false);
  const [platform, setPlatform] = useState<SharePlatform>("xiaohongshu");
  const [copyText, setCopyText] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const imageUrlsRef = useRef<string[]>([]);

  const imageGridClassName = useMemo(() => {
    if (imageUrls.length <= 1) {
      return "grid-cols-1";
    }

    if (imageUrls.length <= 4) {
      return "grid-cols-2";
    }

    return "grid-cols-3";
  }, [imageUrls.length]);

  useEffect(() => {
    imageUrlsRef.current = imageUrls;
  }, [imageUrls]);

  useEffect(() => {
    return () => {
      imageUrlsRef.current.forEach((imageUrl) => URL.revokeObjectURL(imageUrl));
    };
  }, []);

  const generateCopy = async (nextPlatform: SharePlatform = platform) => {
    setIsGenerating(true);
    setErrorMessage("");
    setPlatform(nextPlatform);

    try {
      const response = await requestDeepSeek("copy", {
        platform: nextPlatform,
        tripSummary,
      });

      const responseText = await response.text();
      let data: { copy?: string; error?: string; details?: string } = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText) as { copy?: string; error?: string; details?: string };
        } catch {
          throw new Error("文案接口返回了非 JSON 内容，请查看服务端日志。");
        }
      }

      if (!response.ok) {
        throw new Error(data.details ? `${data.error}: ${data.details}` : data.error ?? "生成文案失败");
      }

      setCopyText(data.copy ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "生成文案失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const openModal = () => {
    setIsOpen(true);

    if (!copyText) {
      void generateCopy(platform);
    }
  };

  const addLocalImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const nextImageUrls = files
      .slice(0, Math.max(0, 9 - imageUrls.length))
      .map((file) => URL.createObjectURL(file));

    setImageUrls((currentUrls) => [...currentUrls, ...nextImageUrls].slice(0, 9));
    event.target.value = "";
  };

  const copyToClipboard = async () => {
    if (!copyText.trim()) {
      setToastMessage("还没有可复制的文案");
      window.setTimeout(() => setToastMessage(""), 1800);
      return;
    }

    await navigator.clipboard.writeText(copyText);
    setToastMessage("复制成功，快去发帖吧！");
    window.setTimeout(() => setToastMessage(""), 2200);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          buttonClassName ??
          "rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-5 py-3 text-sm font-black text-white shadow-xl shadow-teal-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-teal-500/40"
        }
      >
        一键生成发圈文案
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 backdrop-blur-sm sm:items-center">
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-[2rem] border border-white/15 bg-[#111] text-white shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">
                  Social Copy
                </p>
                <h2 className="mt-1 text-xl font-black">一键生成发圈文案</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/20"
              >
                关闭
              </button>
            </div>

            <div className="max-h-[calc(92vh-84px)] overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-2 rounded-full bg-white/10 p-1">
                {platformTabs.map((tab) => {
                  const isSelected = platform === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => generateCopy(tab.value)}
                      className={`rounded-full px-4 py-2 text-sm font-black transition-all ${
                        isSelected ? "bg-white text-slate-950" : "text-white/70 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">图片预览</p>
                  <p className="text-xs text-white/45">{imageUrls.length}/9</p>
                </div>

                <div className={`mt-4 grid ${imageGridClassName} gap-2`}>
                  {imageUrls.map((imageUrl) => (
                    <img
                      key={imageUrl}
                      src={imageUrl}
                      alt="本地照片预览"
                      className="aspect-square w-full rounded-2xl object-cover"
                    />
                  ))}

                  {imageUrls.length < 9 ? (
                    <label className="flex aspect-square cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/10 text-center text-sm font-black text-white/70 transition-all hover:bg-white/15">
                      + 添加本地照片
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={addLocalImages}
                        className="sr-only"
                      />
                    </label>
                  ) : null}
                </div>
              </section>

              <section className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black">文案编辑区</p>
                  {isGenerating ? <span className="text-xs font-bold text-teal-200">生成中...</span> : null}
                </div>
                <textarea
                  value={copyText}
                  onChange={(event) => setCopyText(event.target.value)}
                  placeholder="AI 生成的文案会出现在这里，也可以手动修改。"
                  className="min-h-64 w-full resize-none rounded-3xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm leading-7 text-white outline-none placeholder:text-white/35 focus:border-teal-300/40"
                />
              </section>

              {errorMessage ? (
                <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100">
                  {errorMessage}
                </p>
              ) : null}

              <div className="sticky bottom-0 mt-5 flex flex-col gap-3 border-t border-white/10 bg-[#111]/95 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                <p className="min-h-5 text-sm font-semibold text-teal-200">{toastMessage}</p>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-teal-100"
                >
                  一键复制文案
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
