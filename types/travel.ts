export type TimeBucket = "上午" | "中午" | "下午" | "晚餐" | "晚上";

export type ScheduleItemType = "spot" | "food" | "transit" | "rest";

export interface TravelPlansResponse {
  plans: TravelPlan[];
}

export interface TravelPlan {
  plan_id: string;
  plan_title: string;
  highlights: string[];
  budget_per_person: string;
  pace_rating: number;
  days: TravelDay[];
}

export interface TravelDay {
  day_number: number;
  day_theme: string;
  schedule: ScheduleItem[];
  accommodation: AccommodationRecommendation;
}

export interface ScheduleItem {
  time_bucket: TimeBucket;
  type: ScheduleItemType;
  location: string;
  activity: string;
  duration: string;
  tips: string;
}

export interface AccommodationRecommendation {
  area_recommendation: string;
  reason: string;
}
