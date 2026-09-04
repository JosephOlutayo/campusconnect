/**
 * TypeScript mirrors of the Java DTOs.
 *
 * Hand-written rather than generated: the API surface is small enough that a
 * codegen step would cost more than it saves, and these carry comments the
 * generator could not. If a field here disagrees with the Java record, the Java
 * record wins — it is the source of truth.
 */

export type LocationMode = "AT_PROVIDER" | "AT_CUSTOMER" | "ONLINE";

export const LOCATION_MODE_LABELS: Record<LocationMode, string> = {
  AT_PROVIDER: "You go to them",
  AT_CUSTOMER: "They come to you",
  ONLINE: "Online",
};

export const LOCATION_MODE_SHORT: Record<LocationMode, string> = {
  AT_PROVIDER: "At provider",
  AT_CUSTOMER: "They travel",
  ONLINE: "Online",
};

export type BookingStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export type University = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  city: string;
  state: string;
  color: string;
  latitude: number;
  longitude: number;
  providerCount: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  color: string;
  serviceCount: number;
};

export type ServiceOffering = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  categoryName: string;
  categoryIcon: string;
  categoryId: string;
  locationModes: LocationMode[];
  active: boolean;
  bookingCount: number;
};

export type HeadlineService = {
  id: string;
  title: string;
  priceCents: number;
  durationMinutes: number;
  categoryName: string;
  categoryIcon: string;
};

/** One search result. Shape drives the ProviderCard component. */
export type ProviderCard = {
  providerId: string;
  businessName: string;
  tagline: string | null;
  avatarSeed: string;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedBookings: number;
  universityShortName: string;
  universitySlug: string;
  locationLabel: string;
  locationModes: LocationMode[];
  distanceMiles: number | null;
  headlineService: HeadlineService;
  serviceCount: number;
  fromPriceCents: number;
  portfolioSeeds: string[];
  /** ISO local date-time, e.g. "2026-09-07T17:30:00", or null. */
  nextAvailable: string | null;
  createdAt: string;
};

export type SearchResult = {
  cards: ProviderCard[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type PortfolioImage = {
  id: string;
  seed: string;
  url: string | null;
  caption: string | null;
};

export type AvailabilityWindow = {
  /** MONDAY … SUNDAY */
  dayOfWeek: string;
  startMinute: number;
  endMinute: number;
};

export type Review = {
  id: string;
  rating: number;
  body: string;
  authorName: string;
  authorAvatarSeed: string;
  authorStudentVerified: boolean;
  serviceTitle: string;
  providerResponse: string | null;
  createdAt: string;
  hidden: boolean;
};

export type ProviderDetail = {
  id: string;
  businessName: string;
  tagline: string | null;
  bio: string;
  avatarSeed: string;
  isVerified: boolean;
  studentVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedBookings: number;
  locationLabel: string;
  locationModes: LocationMode[];
  distanceMiles: number | null;
  universityShortName: string;
  universitySlug: string;
  universityId: string;
  status: string;
  autoConfirmBookings: boolean;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  cancellationPolicy: string;
  services: ServiceOffering[];
  portfolio: PortfolioImage[];
  hours: AvailabilityWindow[];
  reviews: Review[];
  /** Star -> count, across every visible review (not just the page shown). */
  ratingDistribution: Record<string, number>;
  nextAvailable: string | null;
  favorited: boolean;
};

export type Payment = {
  amountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  status: string;
  gateway: string;
};

export type Booking = {
  id: string;
  code: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  priceCents: number;
  platformFeeCents: number;
  providerPayoutCents: number;
  locationMode: LocationMode;
  locationLabel: string;
  /** Only present for the customer once the booking is confirmed. */
  exactAddress: string | null;
  customerNote: string | null;
  cancellationReason: string | null;
  serviceId: string;
  serviceTitle: string;
  durationMinutes: number;
  providerId: string;
  providerName: string;
  providerAvatarSeed: string;
  providerRating: number;
  providerRatingCount: number;
  cancellationPolicy: string;
  customerId: string;
  customerName: string;
  customerAvatarSeed: string;
  payment: Payment | null;
  reviewed: boolean;
  reviewRating: number | null;
  createdAt: string;
};

export type Conversation = {
  id: string;
  providerId: string;
  counterpartName: string;
  counterpartAvatarSeed: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  viewerIsCustomer: boolean;
};

export type ConversationHeader = {
  id: string;
  providerId: string;
  viewerIsCustomer: boolean;
  counterpartName: string;
  counterpartAvatarSeed: string;
  counterpartUserId: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  imageSeed: string | null;
  createdAt: string;
  readAt: string | null;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type CampusOverview = {
  providerCount: number;
  serviceCount: number;
  averageRating: number;
  newProvidersThisWeek: number;
  bookingsThisMonth: number;
  topCategories: Array<{ name: string; icon: string; count: number }>;
};

export type MeSummary = {
  completedBookings: number;
  upcomingBookings: number;
  reviewsWritten: number;
  savedProviders: number;
  spentCents: number;
  unreadMessages: number;
  unreadNotifications: number;
  pendingProviderRequests: number;
};

export type ProviderStats = {
  pendingRequests: number;
  upcoming: number;
  completedAllTime: number;
  earnedAllTimeCents: number;
  earnedThisMonthCents: number;
  ratingAvg: number;
  ratingCount: number;
  earningsByWeek: Array<{ label: string; amountCents: number; bookings: number }>;
};

export type ProviderOwnProfile = {
  id: string;
  businessName: string;
  tagline: string;
  bio: string;
  locationLabel: string;
  exactAddress: string;
  locationModes: LocationMode[];
  autoConfirmBookings: boolean;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  cancellationPolicy: string;
  status: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  universityShortName: string;
};

export type PendingReview = {
  bookingId: string;
  providerId: string;
  providerName: string;
  avatarSeed: string;
  serviceTitle: string;
};

export type Slot = { startAt: string; endAt: string };
