export type UserMemory = {
  preferences: string[];
  updatedAt: string;
};

export const defaultUserMemory: UserMemory = {
  preferences: [],
  updatedAt: "",
};

export function normalizeMemoryPreferences(preferences: unknown) {
  if (!Array.isArray(preferences)) {
    return [];
  }

  return Array.from(
    new Set(
      preferences
        .filter((preference): preference is string => typeof preference === "string")
        .map((preference) => preference.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  );
}

export function formatUserMemoryForPrompt(preferences: string[]) {
  return preferences.length > 0 ? preferences.join("、") : "暂无长期偏好";
}
