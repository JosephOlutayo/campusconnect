/**
 * Search UI options.
 *
 * The actual searching happens in Java (SearchService). What stays here is the
 * vocabulary the filter UI renders and puts in the URL — the two must agree,
 * because these values are sent verbatim as query parameters.
 */

export type { ProviderCard } from "@/lib/types";

export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "distance", label: "Closest" },
  { value: "booked", label: "Most booked" },
  { value: "newest", label: "Newest" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const AVAILABILITY_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
] as const;
