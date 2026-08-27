/**
 * Demo data for CampusConnect.
 *
 * Everything here is fictional. The goal is a database that feels like a
 * marketplace three months after launch: uneven ratings, some providers with no
 * reviews yet, real gaps in calendars, a couple of open moderation reports, and
 * enough completed history that the analytics screens have something to plot.
 *
 * Run with: npm run db:seed  (wipes and reseeds)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";
const FEE_PERCENT = 10;

// --- deterministic RNG so reseeding produces the same demo ------------------
let rngState = 1337;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function splitFee(totalCents: number) {
  const platformFeeCents = Math.floor((totalCents * FEE_PERCENT) / 100);
  return { platformFeeCents, providerPayoutCents: totalCents - platformFeeCents };
}

function code(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(rand() * alphabet.length)];
  return `CC-${out}`;
}

function at(daysFromToday: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const UNIVERSITIES = [
  {
    name: "The University of Texas at Dallas",
    shortName: "UT Dallas",
    slug: "ut-dallas",
    city: "Richardson",
    state: "TX",
    latitude: 32.9857,
    longitude: -96.7502,
    color: "#E87500",
    domains: ["utdallas.edu", "utd.edu"],
  },
  {
    name: "The University of Texas at Arlington",
    shortName: "UT Arlington",
    slug: "ut-arlington",
    city: "Arlington",
    state: "TX",
    latitude: 32.7317,
    longitude: -97.1148,
    color: "#0064B1",
    domains: ["uta.edu", "mavs.uta.edu"],
  },
  {
    name: "University of North Texas",
    shortName: "UNT",
    slug: "north-texas",
    city: "Denton",
    state: "TX",
    latitude: 33.2075,
    longitude: -97.1526,
    color: "#00853E",
    domains: ["unt.edu", "my.unt.edu"],
  },
  {
    name: "Texas A&M University",
    shortName: "Texas A&M",
    slug: "texas-am",
    city: "College Station",
    state: "TX",
    latitude: 30.615,
    longitude: -96.3414,
    color: "#500000",
    domains: ["tamu.edu"],
  },
  {
    name: "The University of Texas at Austin",
    shortName: "UT Austin",
    slug: "ut-austin",
    city: "Austin",
    state: "TX",
    latitude: 30.2849,
    longitude: -97.7341,
    color: "#BF5700",
    domains: ["utexas.edu"],
  },
  {
    name: "Texas Tech University",
    shortName: "Texas Tech",
    slug: "texas-tech",
    city: "Lubbock",
    state: "TX",
    latitude: 33.5843,
    longitude: -101.8783,
    color: "#CC0000",
    domains: ["ttu.edu"],
  },
];

const CATEGORIES = [
  { name: "Barbering", slug: "barbering", icon: "💈", color: "#2563EB", description: "Cuts, fades, line-ups and beard work.", keywords: "barber,haircut,fade,taper,lineup,cut,trim,beard,shape up" },
  { name: "Braiding", slug: "braiding", icon: "🪢", color: "#DB2777", description: "Box braids, knotless, cornrows and twists.", keywords: "braids,braider,knotless,box braids,cornrows,twists,feed in,stitch braids" },
  { name: "Hair Styling", slug: "hair-styling", icon: "💇", color: "#9333EA", description: "Silk press, colour, installs and styling.", keywords: "hair,hairdresser,stylist,silk press,color,wig,install,sew in,natural hair" },
  { name: "Nails", slug: "nails", icon: "💅", color: "#F43F5E", description: "Acrylics, gel, manicures and nail art.", keywords: "nails,nail tech,acrylic,gel,manicure,pedicure,nail art,fill in" },
  { name: "Makeup", slug: "makeup", icon: "💄", color: "#EC4899", description: "Event glam, natural beat and lessons.", keywords: "makeup,mua,glam,beat,formal,prom,bridal,beauty" },
  { name: "Lashes & Brows", slug: "lashes-brows", icon: "👁️", color: "#A855F7", description: "Extensions, lifts, tints and threading.", keywords: "lashes,lash tech,extensions,brows,eyebrows,threading,tint,lift,wax" },
  { name: "Tattoo & Piercing", slug: "tattoo", icon: "🖋️", color: "#4F46E5", description: "Small tattoos, flash and piercings.", keywords: "tattoo,tattoos,tatt,ink,piercing,flash,stick and poke" },
  { name: "Photography", slug: "photography", icon: "📷", color: "#0EA5E9", description: "Grad photos, portraits and events.", keywords: "photo,photography,photographer,grad photos,portraits,headshots,shoot,pictures" },
  { name: "Videography", slug: "videography", icon: "🎬", color: "#0891B2", description: "Event films, reels and content days.", keywords: "video,videography,videographer,film,reels,content,edit" },
  { name: "Tutoring", slug: "tutoring", icon: "📚", color: "#16A34A", description: "Course-specific help from students who aced it.", keywords: "tutor,tutoring,math,calculus,statistics,chemistry,physics,coding,study,exam,homework,cs" },
  { name: "Fitness", slug: "fitness", icon: "🏋️", color: "#EA580C", description: "Personal training and programming.", keywords: "fitness,trainer,personal trainer,gym,workout,lifting,pt,training,coach" },
  { name: "Car Care", slug: "car-care", icon: "🚗", color: "#0F766E", description: "Detailing, washes and interior resets.", keywords: "car,detailing,detail,wash,car wash,auto,interior,ceramic" },
  { name: "Tailoring", slug: "tailoring", icon: "🧵", color: "#B45309", description: "Alterations, hemming and custom pieces.", keywords: "tailor,tailoring,alterations,hem,sewing,seamstress,fit,suit" },
  { name: "DJ & Events", slug: "dj-events", icon: "🎧", color: "#7C3AED", description: "Parties, formals and campus events.", keywords: "dj,music,party,event,mix,sound,formal,function" },
  { name: "Cleaning", slug: "cleaning", icon: "🧽", color: "#0284C7", description: "Dorm and apartment deep cleans.", keywords: "cleaning,cleaner,deep clean,dorm,apartment,move out,tidy" },
  { name: "Design & Digital", slug: "design", icon: "🎨", color: "#6366F1", description: "Logos, flyers, decks and web work.", keywords: "design,graphic design,designer,logo,flyer,branding,website,poster,resume" },
];

type ServiceSeed = {
  title: string;
  description: string;
  category: string;
  price: number;
  minutes: number;
};

type ProviderSeed = {
  personName: string;
  businessName: string;
  email: string;
  tagline: string;
  bio: string;
  university: string;
  locationLabel: string;
  exactAddress?: string;
  modes: string;
  verified: boolean;
  targetRating: number;
  reviewCount: number;
  services: ServiceSeed[];
  hours: Array<[number, number, number]>; // weekday, startHour, endHour
  buffer?: number;
  autoConfirm?: boolean;
};

const NINE_TO_SIX: Array<[number, number, number]> = [
  [1, 10, 18],
  [2, 10, 18],
  [3, 10, 18],
  [4, 10, 18],
  [5, 10, 18],
];

const EVENINGS: Array<[number, number, number]> = [
  [1, 16, 21],
  [2, 16, 21],
  [3, 16, 21],
  [4, 16, 21],
  [5, 15, 22],
  [6, 11, 20],
];

const WEEKEND_HEAVY: Array<[number, number, number]> = [
  [0, 12, 19],
  [4, 15, 21],
  [5, 10, 20],
  [6, 9, 20],
];

const PROVIDERS: ProviderSeed[] = [
  {
    personName: "Marcus Bell",
    businessName: "Campus Cuts",
    email: "marcus@utdallas.edu",
    tagline: "Fades between classes — 10 minutes from the Student Union",
    bio: "Cutting hair since high school, licensed for two years. I keep a tight schedule so you can get in and out between lectures. Skin fades, tapers, beard work and kids' cuts. I take walk-ins when the calendar shows an opening, but booking ahead is safer around midterms.",
    university: "ut-dallas",
    locationLabel: "Northside Apartments, near UT Dallas",
    exactAddress: "1200 Rutford Ave, Apt 4B, Richardson, TX 75080",
    modes: "AT_PROVIDER,AT_CUSTOMER",
    verified: true,
    targetRating: 4.9,
    reviewCount: 84,
    services: [
      { title: "Signature Haircut", description: "Consultation, cut, line-up and a hot towel finish. The standard cut most people book.", category: "barbering", price: 25, minutes: 30 },
      { title: "Haircut + Beard", description: "Full cut plus beard shape, line-up and oil. Allow a little extra time.", category: "barbering", price: 35, minutes: 45 },
      { title: "Line-Up Only", description: "Quick edge-up to hold you over between full cuts.", category: "barbering", price: 12, minutes: 15 },
    ],
    hours: EVENINGS,
    buffer: 5,
  },
  {
    personName: "Tia Robinson",
    businessName: "Braids by Tia",
    email: "tia@utdallas.edu",
    tagline: "Knotless braids that last — protective styling specialist",
    bio: "Braider of six years specialising in knotless box braids, boho styles and stitch cornrows. Hair is included in every price unless you bring your own. Come with hair washed, blown out and detangled — it saves us both an hour. I play music, you can nap.",
    university: "ut-dallas",
    locationLabel: "Near UT Dallas campus",
    exactAddress: "800 Waterview Pkwy, Richardson, TX 75080",
    modes: "AT_PROVIDER",
    verified: true,
    targetRating: 4.8,
    reviewCount: 61,
    services: [
      { title: "Knotless Box Braids (Medium)", description: "Mid-back length, hair included. Please arrive with hair washed and blown out.", category: "braiding", price: 180, minutes: 300 },
      { title: "Stitch Cornrows (6-8)", description: "Clean, straight-back stitch braids. Great for the gym or under a wig.", category: "braiding", price: 75, minutes: 120 },
      { title: "Boho Knotless", description: "Knotless braids with curly ends left out. Bring inspo photos.", category: "braiding", price: 220, minutes: 360 },
    ],
    hours: WEEKEND_HEAVY,
    buffer: 30,
    autoConfirm: false,
  },
  {
    personName: "Jasmine Ortiz",
    businessName: "Nails by Jasmine",
    email: "jasmine@utdallas.edu",
    tagline: "Gel-x, acrylics and hand-painted sets",
    bio: "Licensed nail tech working out of a clean home studio five minutes from campus. Structured gel, acrylic full sets, and freehand art. I sanitise everything between clients and use quality product — your sets should last three weeks, not three days.",
    university: "ut-dallas",
    locationLabel: "Waterview area, near UT Dallas",
    modes: "AT_PROVIDER",
    verified: true,
    targetRating: 4.7,
    reviewCount: 47,
    services: [
      { title: "Acrylic Full Set", description: "Full set with your choice of shape and one solid colour.", category: "nails", price: 55, minutes: 90 },
      { title: "Gel-X Full Set", description: "Lightweight soft gel extensions. Gentler on natural nails.", category: "nails", price: 65, minutes: 90 },
      { title: "Gel Manicure", description: "Shape, cuticle work and gel polish on natural nails.", category: "nails", price: 35, minutes: 60 },
      { title: "Nail Art (per nail)", description: "Freehand art, chrome or 3D charms added to any set.", category: "nails", price: 5, minutes: 15 },
    ],
    hours: [
      [0, 12, 18],
      [2, 14, 20],
      [3, 14, 20],
      [4, 14, 20],
      [5, 11, 20],
      [6, 10, 18],
    ],
    buffer: 15,
  },
  {
    personName: "Priya Raman",
    businessName: "UTD Tutoring Collective",
    email: "priya@utdallas.edu",
    tagline: "Calculus, linear algebra and stats — taught by people who aced them",
    bio: "I am a senior maths major who has TA'd Calc I and II for three semesters. Sessions are worked-problem heavy: bring your homework, your lecture notes and the questions you got stuck on. I also run group sessions before exams — message me and I will set one up.",
    university: "ut-dallas",
    locationLabel: "McDermott Library / online",
    modes: "AT_PROVIDER,ONLINE",
    verified: true,
    targetRating: 5.0,
    reviewCount: 38,
    services: [
      { title: "Calculus I & II — 1 hour", description: "One-on-one problem session. Bring specific questions for the best value.", category: "tutoring", price: 30, minutes: 60 },
      { title: "Linear Algebra — 1 hour", description: "Proofs, matrices, eigenvalues. Comfortable with both the theory and the exam tricks.", category: "tutoring", price: 32, minutes: 60 },
      { title: "Statistics — 1 hour", description: "Intro through regression. R and Excel walkthroughs included if you need them.", category: "tutoring", price: 30, minutes: 60 },
      { title: "Exam Cram — 2 hours", description: "Focused review the week before a midterm or final.", category: "tutoring", price: 55, minutes: 120 },
    ],
    hours: [
      [1, 12, 20],
      [2, 12, 20],
      [3, 12, 20],
      [4, 12, 20],
      [0, 14, 19],
    ],
  },
  {
    personName: "Devon Clarke",
    businessName: "Campus Lens Photography",
    email: "devon@utdallas.edu",
    tagline: "Grad photos, portraits and org events",
    bio: "Photographer with a documentary lean. Grad shoots on the plinth and around the Trellis Plaza, portraits with natural light, and event coverage for student orgs. Every session includes edited high-res images delivered inside five days, plus web-sized versions for socials.",
    university: "ut-dallas",
    locationLabel: "Anywhere on the UT Dallas campus",
    modes: "AT_CUSTOMER",
    verified: false,
    targetRating: 4.9,
    reviewCount: 29,
    services: [
      { title: "Grad Photo Session", description: "45 minutes on campus, 2 outfit changes, 25+ edited images.", category: "photography", price: 120, minutes: 60 },
      { title: "Portrait Mini Session", description: "20 minutes, one look, 10 edited images. Great for LinkedIn or socials.", category: "photography", price: 55, minutes: 30 },
      { title: "Org Event Coverage (2 hr)", description: "Event photography for student organisations. Gallery within a week.", category: "photography", price: 200, minutes: 120 },
    ],
    hours: [
      [5, 9, 19],
      [6, 8, 19],
      [0, 10, 18],
      [3, 16, 20],
    ],
    buffer: 30,
    autoConfirm: false,
  },
  {
    personName: "Andre Willis",
    businessName: "CleanRide Detailing",
    email: "andre@utdallas.edu",
    tagline: "Mobile detailing — I come to your parking lot",
    bio: "I bring water, power and everything else to your space in Lot M or your apartment complex. Interior resets are my speciality: if your car has lived through a semester of drive-thru runs, I can bring it back. Book the full detail if you have not cleaned it since move-in.",
    university: "ut-dallas",
    locationLabel: "Mobile — UT Dallas lots and nearby apartments",
    modes: "AT_CUSTOMER",
    verified: true,
    targetRating: 4.6,
    reviewCount: 33,
    services: [
      { title: "Interior Reset", description: "Full vacuum, wipe-down, windows, mats shampooed. The one most students book.", category: "car-care", price: 70, minutes: 90 },
      { title: "Exterior Hand Wash", description: "Two-bucket wash, wheels, tyre shine and spray sealant.", category: "car-care", price: 45, minutes: 60 },
      { title: "Full Detail", description: "Interior reset plus exterior wash, clay bar and wax. Allow three hours.", category: "car-care", price: 150, minutes: 180 },
    ],
    hours: [
      [1, 9, 17],
      [3, 9, 17],
      [5, 9, 18],
      [6, 9, 16],
    ],
    buffer: 30,
  },
  {
    personName: "Jayla Foster",
    businessName: "FitWithJay",
    email: "jayla@utdallas.edu",
    tagline: "Strength coaching at the Activity Center",
    bio: "NASM-certified trainer and former college athlete. I coach beginners through their first barbell sessions and help experienced lifters fix the thing that has been stalling them for months. Every client gets a written programme they keep, not just an hour of me counting reps.",
    university: "ut-dallas",
    locationLabel: "Activity Center, UT Dallas",
    modes: "AT_PROVIDER,ONLINE",
    verified: true,
    targetRating: 4.9,
    reviewCount: 41,
    services: [
      { title: "1-on-1 Training Session", description: "60 minutes of coached training at the campus gym.", category: "fitness", price: 40, minutes: 60 },
      { title: "Form Check & Programme Build", description: "We film your main lifts, fix them, and I write you a 6-week programme.", category: "fitness", price: 65, minutes: 75 },
      { title: "Online Check-in (monthly)", description: "Programme updates and weekly video form review, fully remote.", category: "fitness", price: 50, minutes: 30 },
    ],
    hours: [
      [1, 6, 11],
      [2, 6, 11],
      [3, 6, 11],
      [4, 6, 11],
      [5, 7, 12],
    ],
  },
  {
    personName: "Sofia Mendes",
    businessName: "Glam by Sofia",
    email: "sofia@utdallas.edu",
    tagline: "Formal glam, soft beats and makeup lessons",
    bio: "Makeup artist for formals, galas, grad photos and the nights that end up on everyone's story. I work with all skin tones and bring a sanitised kit to you. If you would rather learn to do it yourself, book a lesson and bring your own products — we will work with what you already own.",
    university: "ut-dallas",
    locationLabel: "Travels to you around Richardson",
    modes: "AT_CUSTOMER,AT_PROVIDER",
    verified: false,
    targetRating: 4.8,
    reviewCount: 22,
    services: [
      { title: "Full Glam", description: "Full face with lashes included. Ideal for formals and galas.", category: "makeup", price: 85, minutes: 75 },
      { title: "Soft Natural Beat", description: "Everyday-plus look for photos, dates and presentations.", category: "makeup", price: 60, minutes: 60 },
      { title: "Makeup Lesson", description: "90 minutes using your own products. You do it, I coach.", category: "makeup", price: 70, minutes: 90 },
    ],
    hours: WEEKEND_HEAVY,
    buffer: 20,
  },
  {
    personName: "Noah Kim",
    businessName: "Kim Creative Studio",
    email: "noah@utdallas.edu",
    tagline: "Logos, decks and org branding that does not look like Canva",
    bio: "Design student and freelancer. I do brand identities for student orgs, pitch decks for competition teams, and flyers that actually get read. Two rounds of revisions included on everything. Files delivered in every format you will need.",
    university: "ut-dallas",
    locationLabel: "Online / campus meetups",
    modes: "ONLINE,AT_PROVIDER",
    verified: false,
    targetRating: 4.7,
    reviewCount: 18,
    services: [
      { title: "Logo & Brand Kit", description: "Logo, colour palette, type choices and usage files. Two revision rounds.", category: "design", price: 150, minutes: 60 },
      { title: "Event Flyer", description: "Print and story-sized versions of one flyer, delivered in 48 hours.", category: "design", price: 45, minutes: 45 },
      { title: "Pitch Deck Polish", description: "We rebuild your slides so they look like the team you want to be.", category: "design", price: 120, minutes: 90 },
    ],
    hours: NINE_TO_SIX,
  },
  {
    personName: "Ayanna Brooks",
    businessName: "Lash Lounge ATX",
    email: "ayanna@utexas.edu",
    tagline: "Classic, hybrid and volume lash sets",
    bio: "Licensed lash artist near the Drag. Classic sets for a natural look, volume for full drama, and brow shaping to match. Come with a clean face and no eye makeup. Fills are cheaper within three weeks, so book your next one before you leave.",
    university: "ut-austin",
    locationLabel: "Near UT Austin campus",
    modes: "AT_PROVIDER",
    verified: true,
    targetRating: 4.9,
    reviewCount: 52,
    services: [
      { title: "Classic Full Set", description: "One extension per natural lash. Natural, everyday length.", category: "lashes-brows", price: 90, minutes: 120 },
      { title: "Hybrid Full Set", description: "Mix of classic and volume fans for texture.", category: "lashes-brows", price: 110, minutes: 135 },
      { title: "Lash Fill (2-3 weeks)", description: "Top-up on an existing set. Must be at least 40% intact.", category: "lashes-brows", price: 55, minutes: 75 },
      { title: "Brow Shape & Tint", description: "Wax, tweeze and tint to frame the face.", category: "lashes-brows", price: 40, minutes: 45 },
    ],
    hours: EVENINGS,
    buffer: 15,
  },
  {
    personName: "Caleb Nguyen",
    businessName: "Longhorn Line Barbers",
    email: "caleb@utexas.edu",
    tagline: "Sharp fades on Speedway",
    bio: "Third-year barber cutting near West Campus. Fades, scissor work, and the kind of line-up that survives a photo. Text me if you are running late — I would rather adjust than rush your cut.",
    university: "ut-austin",
    locationLabel: "West Campus, Austin",
    modes: "AT_PROVIDER",
    verified: false,
    targetRating: 4.6,
    reviewCount: 27,
    services: [
      { title: "Fade & Line-Up", description: "Skin, low or mid fade with a crisp line-up.", category: "barbering", price: 28, minutes: 40 },
      { title: "Scissor Cut", description: "For longer hair — shape, texture and thinning as needed.", category: "barbering", price: 32, minutes: 45 },
    ],
    hours: EVENINGS,
    buffer: 5,
  },
  {
    personName: "Maya Alvarez",
    businessName: "Silk Press by Maya",
    email: "maya@uta.edu",
    tagline: "Healthy silk presses and natural hair care",
    bio: "Natural hair specialist. Silk presses that hold without frying your curls, deep conditioning treatments, and trims that keep your ends alive. I use heat protectant on every pass and never go above 400. Your curl pattern comes back — that is the whole point.",
    university: "ut-arlington",
    locationLabel: "Near UT Arlington campus",
    modes: "AT_PROVIDER",
    verified: true,
    targetRating: 4.8,
    reviewCount: 36,
    services: [
      { title: "Silk Press", description: "Wash, deep condition, blow out and press. Includes a light trim.", category: "hair-styling", price: 85, minutes: 150 },
      { title: "Deep Conditioning Treatment", description: "Steam treatment and protein/moisture balance for stressed hair.", category: "hair-styling", price: 45, minutes: 60 },
      { title: "Wash & Twist Out", description: "Cleanse, condition and set for a defined twist out.", category: "hair-styling", price: 60, minutes: 105 },
    ],
    hours: [
      [2, 12, 19],
      [4, 12, 19],
      [5, 10, 18],
      [6, 9, 17],
    ],
    buffer: 20,
  },
  {
    personName: "Trey Johnson",
    businessName: "Maverick Mobile Cuts",
    email: "trey@mavs.uta.edu",
    tagline: "I bring the chair to your dorm",
    bio: "Mobile barber serving UTA dorms and apartments. I bring my own chair, clippers, cape and a shop vac so your room is cleaner when I leave than when I arrived. Group bookings on the same floor get a discount — round up your suitemates.",
    university: "ut-arlington",
    locationLabel: "Mobile — UT Arlington dorms and apartments",
    modes: "AT_CUSTOMER",
    verified: false,
    targetRating: 4.5,
    reviewCount: 19,
    services: [
      { title: "Dorm Room Cut", description: "Full cut in your space. I bring everything including cleanup.", category: "barbering", price: 30, minutes: 45 },
      { title: "Cut + Beard Trim", description: "Cut plus beard shape without leaving your building.", category: "barbering", price: 40, minutes: 55 },
    ],
    hours: EVENINGS,
    buffer: 20,
  },
  {
    personName: "Isabella Cruz",
    businessName: "Mean Green Nails",
    email: "isabella@unt.edu",
    tagline: "Affordable sets for students who still want them cute",
    bio: "Nail tech in Denton keeping prices student-friendly without cutting corners on product. Acrylics, gel, and simple art. First-time clients get 10% off — the code is on my profile.",
    university: "north-texas",
    locationLabel: "Fry Street area, Denton",
    modes: "AT_PROVIDER",
    verified: false,
    targetRating: 4.4,
    reviewCount: 24,
    services: [
      { title: "Acrylic Full Set", description: "Shape of your choice with one solid colour or simple French.", category: "nails", price: 45, minutes: 90 },
      { title: "Acrylic Fill", description: "Fill and reshape on an existing set within four weeks.", category: "nails", price: 35, minutes: 75 },
      { title: "Polish Change", description: "Quick colour swap on an existing set.", category: "nails", price: 20, minutes: 30 },
    ],
    hours: [
      [1, 13, 20],
      [3, 13, 20],
      [5, 11, 20],
      [6, 10, 18],
    ],
    buffer: 15,
  },
  {
    personName: "Ethan Park",
    businessName: "Denton Sound DJ",
    email: "ethan@unt.edu",
    tagline: "House parties, formals and org events",
    bio: "Music major and working DJ. I read a room and I own my own gear — speakers, lights and a backup laptop, because the backup laptop is the difference between a party and a story. Send me your must-play list and your do-not-play list, I take both seriously.",
    university: "north-texas",
    locationLabel: "Travels across Denton and DFW",
    modes: "AT_CUSTOMER",
    verified: true,
    targetRating: 4.9,
    reviewCount: 31,
    services: [
      { title: "House Party Set (3 hr)", description: "Three hours, full sound system and basic lighting included.", category: "dj-events", price: 250, minutes: 180 },
      { title: "Formal / Gala (4 hr)", description: "Four hours with MC duties, uplighting and a planning call.", category: "dj-events", price: 400, minutes: 240 },
    ],
    hours: [
      [5, 18, 23],
      [6, 14, 23],
      [0, 14, 20],
    ],
    buffer: 60,
    autoConfirm: false,
  },
  {
    personName: "Grace Adeyemi",
    businessName: "Aggie Alterations",
    email: "grace@tamu.edu",
    tagline: "Hems, fits and formal alterations",
    bio: "I have been sewing since I was eleven. Hemming, taking in, letting out, and making that thrifted piece actually fit. Formal season books out fast — bring your dress at least two weeks before the event, not two days.",
    university: "texas-am",
    locationLabel: "Northgate area, College Station",
    modes: "AT_PROVIDER",
    verified: true,
    targetRating: 5.0,
    reviewCount: 44,
    services: [
      { title: "Hem (trousers or dress)", description: "Clean hem finished to your shoe height. Bring the shoes.", category: "tailoring", price: 20, minutes: 30 },
      { title: "Dress Alteration", description: "Take in, adjust straps, fix the fit for formals.", category: "tailoring", price: 55, minutes: 60 },
      { title: "Suit Fit Package", description: "Jacket, sleeves and trousers adjusted together.", category: "tailoring", price: 90, minutes: 75 },
    ],
    hours: NINE_TO_SIX,
    buffer: 15,
  },
  {
    personName: "Owen Fisher",
    businessName: "Reveille Study Lab",
    email: "owen@tamu.edu",
    tagline: "Chemistry, physics and engineering fundamentals",
    bio: "Chemical engineering senior. I tutor the courses that wash people out: General Chem, Organic, Physics I and II, and Statics. I work through the problem sets with you rather than at you, and I will tell you honestly if you need more than one session.",
    university: "texas-am",
    locationLabel: "Evans Library / online",
    modes: "AT_PROVIDER,ONLINE",
    verified: false,
    targetRating: 4.7,
    reviewCount: 26,
    services: [
      { title: "General Chemistry — 1 hour", description: "Stoichiometry through equilibrium, with worked problems.", category: "tutoring", price: 28, minutes: 60 },
      { title: "Organic Chemistry — 1 hour", description: "Mechanisms, synthesis and the reactions you keep missing.", category: "tutoring", price: 35, minutes: 60 },
      { title: "Physics I & II — 1 hour", description: "Mechanics and E&M, calculus-based.", category: "tutoring", price: 30, minutes: 60 },
    ],
    hours: [
      [1, 14, 21],
      [2, 14, 21],
      [3, 14, 21],
      [4, 14, 21],
      [0, 13, 19],
    ],
  },
  {
    personName: "Mia Delgado",
    businessName: "Red Raider Reels",
    email: "mia@ttu.edu",
    tagline: "Content days, reels and event films",
    bio: "Videographer focused on short-form. Bring three outfits and we will leave with a month of content. I also film org recaps and game-day pieces. Turnaround is five days, rush is available.",
    university: "texas-tech",
    locationLabel: "Lubbock — campus and around town",
    modes: "AT_CUSTOMER",
    verified: false,
    targetRating: 4.6,
    reviewCount: 14,
    services: [
      { title: "Content Day (2 hr)", description: "Two hours of filming, 8-10 edited vertical clips.", category: "videography", price: 180, minutes: 120 },
      { title: "Event Recap Film", description: "Coverage plus a 60-90 second edited recap.", category: "videography", price: 250, minutes: 180 },
    ],
    hours: [
      [4, 15, 20],
      [5, 10, 20],
      [6, 10, 18],
    ],
    buffer: 45,
    autoConfirm: false,
  },
  {
    personName: "Zoe Carter",
    businessName: "Fresh Start Dorm Cleaning",
    email: "zoe@ttu.edu",
    tagline: "Move-out cleans that get your deposit back",
    bio: "Deep cleans for dorms and student apartments. Move-out cleans are my speciality — I know exactly what the inspection checklist looks for. Supplies included. Book early in May, that week fills up completely.",
    university: "texas-tech",
    locationLabel: "Lubbock student housing",
    modes: "AT_CUSTOMER",
    verified: false,
    targetRating: 4.8,
    reviewCount: 11,
    services: [
      { title: "Dorm Deep Clean", description: "Full clean of a standard dorm room including bathroom.", category: "cleaning", price: 65, minutes: 120 },
      { title: "Apartment Move-Out", description: "Kitchen, baths, floors and appliances to inspection standard.", category: "cleaning", price: 140, minutes: 240 },
    ],
    hours: [
      [1, 9, 16],
      [2, 9, 16],
      [4, 9, 16],
      [6, 9, 15],
    ],
    buffer: 30,
  },
  {
    personName: "Leo Vargas",
    businessName: "Ink by Leo",
    email: "leo@utdallas.edu",
    tagline: "Fine-line tattoos and flash, by appointment",
    bio: "Fine-line and small-scale work out of a licensed private studio. Single-use needles, everything sealed and opened in front of you. Bring a reference, or pick from the flash sheets on my profile. Must be 18 with valid ID — no exceptions, do not ask.",
    university: "ut-dallas",
    locationLabel: "Private studio, Richardson",
    modes: "AT_PROVIDER",
    verified: true,
    targetRating: 4.9,
    reviewCount: 23,
    services: [
      { title: "Small Flash Tattoo", description: "Pre-drawn design under 3 inches. Includes aftercare kit.", category: "tattoo", price: 90, minutes: 60 },
      { title: "Custom Fine-Line (2 hr)", description: "Custom drawn piece. Free consultation before the session.", category: "tattoo", price: 220, minutes: 120 },
    ],
    hours: [
      [3, 13, 20],
      [4, 13, 20],
      [5, 12, 20],
      [6, 12, 19],
    ],
    buffer: 30,
    autoConfirm: false,
  },
];

const STUDENTS = [
  { name: "Maya Thompson", email: "student@campusconnect.dev", university: "ut-dallas" },
  { name: "Jordan Reyes", email: "jordan@utdallas.edu", university: "ut-dallas" },
  { name: "Amara Okafor", email: "amara@utdallas.edu", university: "ut-dallas" },
  { name: "Chris Bautista", email: "chris@utdallas.edu", university: "ut-dallas" },
  { name: "Hana Sato", email: "hana@utdallas.edu", university: "ut-dallas" },
  { name: "Malik Freeman", email: "malik@utdallas.edu", university: "ut-dallas" },
  { name: "Elena Duarte", email: "elena@utexas.edu", university: "ut-austin" },
  { name: "Sam Whitaker", email: "sam@uta.edu", university: "ut-arlington" },
  { name: "Riya Patel", email: "riya@unt.edu", university: "north-texas" },
  { name: "Tomas Herrera", email: "tomas@tamu.edu", university: "texas-am" },
  { name: "Bree Coleman", email: "bree@ttu.edu", university: "texas-tech" },
  { name: "Nia Washington", email: "nia@utdallas.edu", university: "ut-dallas" },
];

const REVIEW_LINES_HIGH = [
  "Genuinely the best on campus. Booked again before I even left.",
  "On time, professional, and the result was exactly what I asked for.",
  "Worth every dollar. I have already sent three friends.",
  "Super easy to book and the quality speaks for itself.",
  "Made me feel comfortable the whole time and the work is clean.",
  "Fast, friendly, and did not rush the details.",
  "Took the time to actually listen to what I wanted.",
  "Better than anywhere I have paid double for off campus.",
  "Ten out of ten. My go-to from now on.",
  "Communication was great and they were flexible when I ran late.",
];

const REVIEW_LINES_MID = [
  "Good work overall, ran a little behind schedule.",
  "Happy with the result, would have liked a bit more time on the details.",
  "Solid and fair for the price. Would book again.",
  "Nice person and decent work, parking was a bit of a hassle.",
  "Came out well, though the space was busier than I expected.",
];

const REVIEW_LINES_LOW = [
  "Result was fine but I waited almost thirty minutes past my slot.",
  "Not quite what I asked for, though they were polite about it.",
];

// ---------------------------------------------------------------------------

async function wipe() {
  // Order matters — children before parents.
  await prisma.reviewImage.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.portfolioImage.deleteMany();
  await prisma.availabilityRule.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.service.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.block.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.universityEmailDomain.deleteMany();
  await prisma.university.deleteMany();
  await prisma.category.deleteMany();
  await prisma.platformSetting.deleteMany();
}

async function main() {
  console.log("Clearing existing data…");
  await wipe();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  console.log("Seeding platform settings…");
  await prisma.platformSetting.createMany({
    data: [
      { key: "platform_fee_percent", value: String(FEE_PERCENT) },
      { key: "provider_auto_approve", value: "true" },
    ],
  });

  console.log("Seeding universities…");
  const universityBySlug = new Map<string, string>();
  for (const university of UNIVERSITIES) {
    const created = await prisma.university.create({
      data: {
        name: university.name,
        shortName: university.shortName,
        slug: university.slug,
        city: university.city,
        state: university.state,
        latitude: university.latitude,
        longitude: university.longitude,
        color: university.color,
        emailDomains: { create: university.domains.map((domain) => ({ domain })) },
      },
    });
    universityBySlug.set(university.slug, created.id);
  }

  console.log("Seeding categories…");
  const categoryBySlug = new Map<string, string>();
  for (const [index, category] of CATEGORIES.entries()) {
    const created = await prisma.category.create({
      data: { ...category, sortOrder: index },
    });
    categoryBySlug.set(category.slug, created.id);
  }

  console.log("Seeding admin…");
  await prisma.user.create({
    data: {
      email: "admin@campusconnect.dev",
      passwordHash,
      name: "Alex Rivera",
      role: "ADMIN",
      avatarSeed: "alex-admin",
      universityId: universityBySlug.get("ut-dallas")!,
      emailVerifiedAt: new Date(),
    },
  });

  console.log("Seeding students…");
  const studentIds: string[] = [];
  const studentByEmail = new Map<string, string>();
  for (const student of STUDENTS) {
    const created = await prisma.user.create({
      data: {
        email: student.email,
        passwordHash,
        name: student.name,
        avatarSeed: `${student.name.toLowerCase().replace(/\s+/g, "-")}-seed`,
        universityId: universityBySlug.get(student.university)!,
        emailVerifiedAt: new Date(),
        // Everyone on a .edu domain we recognise gets the student badge.
        studentVerifiedAt: student.email.endsWith(".edu") ? new Date() : null,
        bio:
          rand() > 0.6
            ? "Junior at the moment. Always looking for someone reliable near campus."
            : null,
      },
    });
    studentIds.push(created.id);
    studentByEmail.set(student.email, created.id);
  }

  console.log("Seeding providers…");
  type Built = {
    providerId: string;
    userId: string;
    seed: ProviderSeed;
    services: Array<{ id: string; minutes: number; priceCents: number; title: string }>;
  };
  const built: Built[] = [];

  for (const seed of PROVIDERS) {
    const universityId = universityBySlug.get(seed.university)!;
    const university = UNIVERSITIES.find((u) => u.slug === seed.university)!;
    const avatarSeed = `${seed.businessName.toLowerCase().replace(/\s+/g, "-")}-seed`;

    // Scatter providers realistically around their campus centre.
    const latitude = university.latitude + (rand() - 0.5) * 0.05;
    const longitude = university.longitude + (rand() - 0.5) * 0.05;

    const user = await prisma.user.create({
      data: {
        email: seed.email,
        passwordHash,
        name: seed.personName,
        role: "PROVIDER",
        avatarSeed,
        universityId,
        emailVerifiedAt: new Date(),
        studentVerifiedAt: new Date(),
      },
    });

    const profile = await prisma.providerProfile.create({
      data: {
        userId: user.id,
        businessName: seed.businessName,
        tagline: seed.tagline,
        bio: seed.bio,
        universityId,
        locationLabel: seed.locationLabel,
        exactAddress: seed.exactAddress ?? null,
        latitude,
        longitude,
        locationModes: seed.modes,
        isVerified: seed.verified,
        autoConfirmBookings: seed.autoConfirm ?? true,
        bufferMinutes: seed.buffer ?? 0,
        minNoticeMinutes: 120,
        maxAdvanceDays: 60,
        status: "ACTIVE",
        createdAt: new Date(Date.now() - randInt(20, 200) * 24 * 3600 * 1000),
      },
    });

    const services = [];
    for (const service of seed.services) {
      const created = await prisma.service.create({
        data: {
          providerId: profile.id,
          categoryId: categoryBySlug.get(service.category)!,
          title: service.title,
          description: service.description,
          priceCents: service.price * 100,
          durationMinutes: service.minutes,
          locationModes: seed.modes,
          bookingCount: randInt(0, 40),
        },
      });
      services.push({
        id: created.id,
        minutes: service.minutes,
        priceCents: created.priceCents,
        title: service.title,
      });
    }

    await prisma.availabilityRule.createMany({
      data: seed.hours.map(([weekday, startHour, endHour]) => ({
        providerId: profile.id,
        weekday,
        startMinute: startHour * 60,
        endMinute: endHour * 60,
      })),
    });

    const portfolioCount = randInt(4, 8);
    await prisma.portfolioImage.createMany({
      data: Array.from({ length: portfolioCount }, (_, index) => ({
        providerId: profile.id,
        seed: `${avatarSeed}-work-${index}`,
        caption: index === 0 ? seed.services[0].title : null,
        sortOrder: index,
      })),
    });

    built.push({ providerId: profile.id, userId: user.id, seed, services });
  }

  console.log("Seeding past appointments and reviews…");
  let reviewTotal = 0;

  for (const provider of built) {
    const target = provider.seed.targetRating;
    // Keep the demo light: seed a slice of the headline review count, but keep
    // the displayed count honest by only counting what we actually create.
    const toCreate = Math.max(3, Math.round(provider.seed.reviewCount / 4));

    for (let i = 0; i < toCreate; i += 1) {
      const service = pick(provider.services);
      const customerId = pick(studentIds);
      if (customerId === provider.userId) continue;

      const daysAgo = randInt(3, 120);
      const startAt = at(-daysAgo, randInt(10, 18), pick([0, 15, 30, 45]));
      const endAt = new Date(startAt.getTime() + service.minutes * 60_000);
      const split = splitFee(service.priceCents);

      const appointment = await prisma.appointment.create({
        data: {
          code: code(),
          customerId,
          providerId: provider.providerId,
          serviceId: service.id,
          startAt,
          endAt,
          blockEndAt: new Date(endAt.getTime() + (provider.seed.buffer ?? 0) * 60_000),
          status: "COMPLETED",
          priceCents: service.priceCents,
          platformFeeCents: split.platformFeeCents,
          providerPayoutCents: split.providerPayoutCents,
          locationMode: provider.seed.modes.split(",")[0],
          locationLabel: provider.seed.locationLabel,
          createdAt: new Date(startAt.getTime() - randInt(1, 10) * 24 * 3600 * 1000),
          confirmedAt: new Date(startAt.getTime() - 24 * 3600 * 1000),
          completedAt: endAt,
        },
      });

      await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amountCents: service.priceCents,
          platformFeeCents: split.platformFeeCents,
          providerAmountCents: split.providerPayoutCents,
          status: "SUCCEEDED",
          gateway: "MOCK",
          externalId: `mock_pi_seed_${appointment.id.slice(-8)}`,
          capturedAt: endAt,
        },
      });

      // Not everyone reviews — about a fifth stay quiet, like real life.
      if (rand() < 0.2) continue;

      // Ratings cluster near the provider's reputation with occasional dips.
      const roll = rand();
      let rating: number;
      if (roll < 0.72) rating = Math.min(5, Math.round(target));
      else if (roll < 0.92) rating = Math.max(3, Math.round(target) - 1);
      else rating = Math.max(2, Math.round(target) - 2);

      const body =
        rating >= 5
          ? pick(REVIEW_LINES_HIGH)
          : rating === 4
            ? pick(REVIEW_LINES_MID)
            : pick(REVIEW_LINES_LOW);

      const review = await prisma.review.create({
        data: {
          appointmentId: appointment.id,
          providerId: provider.providerId,
          authorId: customerId,
          rating,
          body,
          createdAt: new Date(endAt.getTime() + randInt(1, 48) * 3600 * 1000),
          providerResponse:
            rating <= 3 && rand() > 0.4
              ? "Thank you for the honest feedback — I have adjusted my buffer times so this does not happen again."
              : rand() > 0.75
                ? "Appreciate you! See you next time."
                : null,
          providerRespondedAt: rand() > 0.6 ? new Date() : null,
        },
      });

      if (rand() > 0.75) {
        await prisma.reviewImage.create({
          data: { reviewId: review.id, seed: `${review.id}-photo` },
        });
      }

      reviewTotal += 1;
    }

    const aggregate = await prisma.review.aggregate({
      where: { providerId: provider.providerId, isHidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const completed = await prisma.appointment.count({
      where: { providerId: provider.providerId, status: "COMPLETED" },
    });

    await prisma.providerProfile.update({
      where: { id: provider.providerId },
      data: {
        ratingAvg: Math.round((aggregate._avg.rating ?? 0) * 100) / 100,
        ratingCount: aggregate._count._all,
        completedBookings: completed,
      },
    });
  }

  console.log("Seeding upcoming appointments…");
  // Placed inside each provider's real weekly windows, and tracked so two
  // demo bookings never collide — the same rule the live booker enforces.
  const takenByProvider = new Map<string, Array<[number, number]>>();

  for (const provider of built) {
    const upcoming = randInt(1, 4);
    for (let i = 0; i < upcoming; i += 1) {
      const [weekday, startHour, endHour] = pick(provider.seed.hours);
      const service = pick(provider.services);

      // Find the next occurrence of that weekday, 1-13 days out.
      let dayOffset = -1;
      for (let d = 1; d <= 13; d += 1) {
        const candidate = at(d, 12);
        if (candidate.getDay() === weekday) {
          dayOffset = d;
          break;
        }
      }
      if (dayOffset === -1) continue;

      const latestStart = endHour * 60 - service.minutes;
      if (latestStart <= startHour * 60) continue;

      const startMinute =
        Math.floor((startHour * 60 + rand() * (latestStart - startHour * 60)) / 15) * 15;
      const startAt = at(dayOffset, 0, 0);
      startAt.setMinutes(startMinute);

      const endAt = new Date(startAt.getTime() + service.minutes * 60_000);
      const blockEndAt = new Date(endAt.getTime() + (provider.seed.buffer ?? 0) * 60_000);

      const taken = takenByProvider.get(provider.providerId) ?? [];
      const clash = taken.some(
        ([s, e]) => startAt.getTime() < e && blockEndAt.getTime() > s,
      );
      if (clash) continue;
      taken.push([startAt.getTime(), blockEndAt.getTime()]);
      takenByProvider.set(provider.providerId, taken);

      const customerId = pick(studentIds);
      if (customerId === provider.userId) continue;

      const split = splitFee(service.priceCents);
      const autoConfirm = provider.seed.autoConfirm ?? true;

      const appointment = await prisma.appointment.create({
        data: {
          code: code(),
          customerId,
          providerId: provider.providerId,
          serviceId: service.id,
          startAt,
          endAt,
          blockEndAt,
          status: autoConfirm ? "CONFIRMED" : rand() > 0.5 ? "PENDING" : "CONFIRMED",
          priceCents: service.priceCents,
          platformFeeCents: split.platformFeeCents,
          providerPayoutCents: split.providerPayoutCents,
          locationMode: provider.seed.modes.split(",")[0],
          locationLabel: provider.seed.locationLabel,
          customerNote: rand() > 0.7 ? "First time booking, a little nervous!" : null,
          confirmedAt: autoConfirm ? new Date() : null,
        },
      });

      await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amountCents: service.priceCents,
          platformFeeCents: split.platformFeeCents,
          providerAmountCents: split.providerPayoutCents,
          status: "REQUIRES_CAPTURE",
          gateway: "MOCK",
          externalId: `mock_pi_seed_${appointment.id.slice(-8)}`,
        },
      });
    }
  }

  console.log("Seeding demo student activity…");
  const mayaId = studentByEmail.get("student@campusconnect.dev")!;
  const marcus = built.find((p) => p.seed.businessName === "Campus Cuts")!;
  const tia = built.find((p) => p.seed.businessName === "Braids by Tia")!;
  const priya = built.find((p) => p.seed.businessName === "UTD Tutoring Collective")!;
  const jasmine = built.find((p) => p.seed.businessName === "Nails by Jasmine")!;

  // A completed booking with no review yet, so the review flow is reachable
  // from the demo account the moment you sign in.
  const mayaService = jasmine.services[0];
  const mayaPastStart = at(-4, 15, 0);
  const mayaPastEnd = new Date(mayaPastStart.getTime() + mayaService.minutes * 60_000);
  const mayaSplit = splitFee(mayaService.priceCents);

  const mayaPast = await prisma.appointment.create({
    data: {
      code: code(),
      customerId: mayaId,
      providerId: jasmine.providerId,
      serviceId: mayaService.id,
      startAt: mayaPastStart,
      endAt: mayaPastEnd,
      blockEndAt: new Date(mayaPastEnd.getTime() + 15 * 60_000),
      status: "COMPLETED",
      priceCents: mayaService.priceCents,
      platformFeeCents: mayaSplit.platformFeeCents,
      providerPayoutCents: mayaSplit.providerPayoutCents,
      locationMode: "AT_PROVIDER",
      locationLabel: jasmine.seed.locationLabel,
      confirmedAt: at(-6, 12),
      completedAt: mayaPastEnd,
    },
  });
  await prisma.payment.create({
    data: {
      appointmentId: mayaPast.id,
      amountCents: mayaService.priceCents,
      platformFeeCents: mayaSplit.platformFeeCents,
      providerAmountCents: mayaSplit.providerPayoutCents,
      status: "SUCCEEDED",
      gateway: "MOCK",
      capturedAt: mayaPastEnd,
    },
  });

  await prisma.favorite.createMany({
    data: [
      { userId: mayaId, providerId: marcus.providerId },
      { userId: mayaId, providerId: tia.providerId },
      { userId: mayaId, providerId: priya.providerId },
    ],
  });

  // Two live conversations so the inbox is not empty on first login.
  const conversation = await prisma.conversation.create({
    data: { customerId: mayaId, providerId: marcus.providerId, lastMessageAt: new Date() },
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        senderId: mayaId,
        body: "Hey! Do you have anything Thursday evening for a cut?",
        createdAt: new Date(Date.now() - 3 * 3600 * 1000),
        readAt: new Date(Date.now() - 2.5 * 3600 * 1000),
      },
      {
        conversationId: conversation.id,
        senderId: marcus.userId,
        body: "Thursday after 5 is open — grab whatever slot works on my calendar and I will confirm it.",
        createdAt: new Date(Date.now() - 2 * 3600 * 1000),
      },
    ],
  });

  const conversation2 = await prisma.conversation.create({
    data: {
      customerId: mayaId,
      providerId: priya.providerId,
      lastMessageAt: new Date(Date.now() - 26 * 3600 * 1000),
    },
  });
  await prisma.message.create({
    data: {
      conversationId: conversation2.id,
      senderId: priya.userId,
      body: "I am running a group Calc II review before the midterm if you want in — same rate, split three ways.",
      createdAt: new Date(Date.now() - 26 * 3600 * 1000),
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: mayaId,
        type: "MESSAGE_RECEIVED",
        title: "Message from Campus Cuts",
        body: "Thursday after 5 is open — grab whatever slot works on my calendar.",
        href: `/messages/${conversation.id}`,
      },
      {
        userId: mayaId,
        type: "BOOKING_COMPLETED",
        title: "How did it go?",
        body: "Leave Nails by Jasmine a review — it takes 20 seconds.",
        href: `/appointments/${mayaPast.id}?review=1`,
      },
      {
        userId: marcus.userId,
        type: "BOOKING_CREATED",
        title: "New booking",
        body: "You have new appointments on your calendar this week.",
        href: "/provider/bookings",
      },
    ],
  });

  console.log("Seeding promotions and time off…");
  await prisma.promotion.createMany({
    data: [
      {
        providerId: built.find((p) => p.seed.businessName === "Mean Green Nails")!.providerId,
        code: "FIRST10",
        description: "10% off your first set",
        discountType: "PERCENT",
        discountValue: 10,
        startsAt: at(-30, 0),
        endsAt: at(60, 23),
      },
      {
        providerId: marcus.providerId,
        code: "SYLLABUS",
        description: "$5 off during the first week of term",
        discountType: "AMOUNT",
        discountValue: 500,
        startsAt: at(-5, 0),
        endsAt: at(25, 23),
        maxRedemptions: 50,
      },
    ],
  });

  await prisma.timeOff.createMany({
    data: [
      {
        providerId: tia.providerId,
        startAt: at(5, 0),
        endAt: at(7, 23),
        reason: "Out of town",
      },
      {
        providerId: marcus.providerId,
        startAt: at(2, 18),
        endAt: at(2, 21),
        reason: "Class",
      },
    ],
  });

  console.log("Seeding moderation queue…");
  const someProvider = built[built.length - 1];
  await prisma.report.createMany({
    data: [
      {
        reporterId: studentIds[1],
        targetType: "PROVIDER",
        targetId: someProvider.providerId,
        targetUserId: someProvider.userId,
        reason: "No-show or unprofessional",
        details: "Booked for Saturday and they never showed up or replied to messages.",
      },
      {
        reporterId: studentIds[3],
        targetType: "SERVICE",
        targetId: built[10].services[0].id,
        targetUserId: built[10].userId,
        reason: "Fake listing",
        details: "The photos on this listing look like they were taken from a salon website.",
        status: "REVIEWING",
      },
    ],
  });

  console.log("Seeding payouts…");
  for (const provider of built.slice(0, 8)) {
    const earned = await prisma.appointment.aggregate({
      where: { providerId: provider.providerId, status: "COMPLETED" },
      _sum: { providerPayoutCents: true },
    });
    const total = earned._sum.providerPayoutCents ?? 0;
    if (total <= 0) continue;

    await prisma.payout.create({
      data: {
        providerId: provider.providerId,
        amountCents: Math.round(total * 0.7),
        status: "PAID",
        periodStart: at(-45, 0),
        periodEnd: at(-15, 0),
        paidAt: at(-14, 12),
        externalId: `mock_po_${provider.providerId.slice(-8)}`,
      },
    });
  }

  const counts = {
    universities: await prisma.university.count(),
    categories: await prisma.category.count(),
    users: await prisma.user.count(),
    providers: await prisma.providerProfile.count(),
    services: await prisma.service.count(),
    appointments: await prisma.appointment.count(),
    reviews: reviewTotal,
  };

  console.log("\nSeed complete:", counts);
  console.log("\nDemo accounts (password: password123)");
  console.log("  student@campusconnect.dev   — student with bookings, saves and messages");
  console.log("  marcus@utdallas.edu         — provider (Campus Cuts)");
  console.log("  tia@utdallas.edu            — provider with manual booking approval");
  console.log("  admin@campusconnect.dev     — admin console\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
