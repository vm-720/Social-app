// Invented sample comments for trying the dashboard before real pages are connected.
// None of these were written by real people. Each carries a hand-written sample score so the
// dashboard renders without an API key; `npm run seed:demo -- --score-with-claude` re-scores them.

import type { Platform } from "@/db/schema";
import type { CommentAnalysis } from "@/lib/analysis/schema";

export const DEMO_ACCOUNT = {
  slug: "aaa-wcny",
  name: "AAA Western and Central New York",
};

export const DEMO_TOPICS: { name: string; description: string }[] = [
  { name: "Roadside assistance", description: "Tows, jump starts, lockouts, flat tires, wait times" },
  { name: "Membership", description: "Joining, renewing, pricing, cards, membership levels" },
  { name: "Insurance", description: "Auto, home and life insurance quotes, claims and agents" },
  { name: "Travel", description: "Trip planning, travel agents, cruises, passports, IDPs" },
  { name: "Car care", description: "Approved repair shops, car care centers, batteries, tires" },
  { name: "Driver training", description: "Driving school, defensive driving courses" },
  { name: "DMV services", description: "License and registration services at branches" },
  { name: "Discounts", description: "Member discounts and rewards" },
  { name: "Customer service", description: "Phone, branch and online support experiences" },
  { name: "Community and safety", description: "Safety campaigns, events, gas price news, community work" },
];

export const DEMO_PAGES: Record<Platform, { externalId: string; displayName: string; handle: string }> = {
  facebook: { externalId: "demo-fb-page", displayName: "AAA Western and Central NY", handle: "AAAWCNY" },
  instagram: { externalId: "demo-ig-user", displayName: "@aaawcny", handle: "aaawcny" },
  linkedin: { externalId: "demo-li-org", displayName: "AAA Western and Central New York", handle: "aaa-wcny" },
  tiktok: { externalId: "demo-tt-user", displayName: "@aaawcny", handle: "aaawcny" },
};

export interface DemoComment {
  id: string;
  platform: Platform;
  post: string;
  daysAgo: number;
  author: string;
  authorId: string;
  parent?: string;
  text: string;
  /** Absent on the page's own replies, which are never scored. */
  score?: Omit<CommentAnalysis, "comment_id">;
}

type Sentiment = CommentAnalysis["sentiment"];
type Risk = CommentAnalysis["risk_level"];
type Cat = CommentAnalysis["risk_categories"][number];

function s(
  sentiment: Sentiment,
  sentiment_score: number,
  topics: string[],
  summary: string,
  needs_reply = false,
  risk: [Risk, Cat[], string | null] = ["none", [], null],
): Omit<CommentAnalysis, "comment_id"> {
  return {
    sentiment,
    sentiment_score,
    topics,
    suggested_topic: null,
    risk_level: risk[0],
    risk_categories: risk[1],
    risk_reason: risk[2],
    needs_reply,
    summary,
  };
}

let n = 0;
function c(
  platform: Platform,
  post: string,
  daysAgo: number,
  author: string,
  text: string,
  score?: Omit<CommentAnalysis, "comment_id">,
  parent?: string,
): DemoComment {
  n += 1;
  const own = !score;
  return {
    id: `demo-${platform}-${n}`,
    platform,
    post,
    daysAgo,
    author: own ? DEMO_PAGES[platform].displayName : author,
    authorId: own ? DEMO_PAGES[platform].externalId : `demo-user-${author.toLowerCase().replace(/\W+/g, "-")}`,
    // The page's own replies answer the comment listed just above them.
    parent: parent ?? (own ? `demo-${platform}-${n - 1}` : undefined),
    text,
    score,
  };
}

export const DEMO_COMMENTS: DemoComment[] = [
  // Facebook
  c("facebook", "fb-post-1", 2, "Linda R", "Driver showed up in 25 minutes on the Thruway in the rain. Changed my tire and was so kind. Worth every penny of my membership!", s("positive", 0.95, ["Roadside assistance", "Membership"], "Fast, kind tire change on the Thruway")),
  c("facebook", "fb-post-1", 2, "Mike D", "Waited 3 hours for a tow outside Rochester last night with two kids in the car. Nobody called back. Unacceptable.", s("negative", -0.9, ["Roadside assistance", "Customer service"], "Three hour tow wait with kids, no callback", true, ["low", [], "Upset member with children stranded; could escalate publicly."])),
  c("facebook", "fb-post-1", 1, "", "Mike, we're so sorry about the wait. Please send us a private message with your member number so we can look into this.", undefined),
  c("facebook", "fb-post-2", 4, "Karen P", "Is the Amherst branch open Saturday for license renewals?", s("neutral", 0, ["DMV services"], "Asks about Saturday DMV hours in Amherst", true)),
  c("facebook", "fb-post-2", 5, "Tom B", "Renewal price went up again this year. What am I actually getting for the extra money?", s("negative", -0.5, ["Membership"], "Questions value after renewal price increase", true)),
  c("facebook", "fb-post-3", 6, "Grace L", "Your travel agent Jen planned our whole Alaska cruise. Every detail was perfect. Thank you!", s("positive", 0.95, ["Travel"], "Praises travel agent for Alaska cruise")),
  c("facebook", "fb-post-3", 8, "Dave K", "Your tow driver backed into my garage door and now AAA won't return my calls. My lawyer will be in touch.", s("negative", -0.95, ["Roadside assistance", "Customer service"], "Tow driver damaged garage, threatens lawyer", true, ["high", ["legal_threat", "employee_conduct"], "Property damage claim with an explicit threat of legal action."])),
  c("facebook", "fb-post-4", 9, "Sue M", "Got 20% off at the hotel with my card, love the discounts.", s("positive", 0.8, ["Discounts"], "Happy with member hotel discount")),
  c("facebook", "fb-post-4", 10, "Rob T", "The person at the Syracuse office was rude and made fun of my accent. Never coming back.", s("negative", -0.9, ["Customer service", "DMV services"], "Says staff mocked their accent at Syracuse", true, ["high", ["discrimination_or_harassment", "employee_conduct"], "Alleges a staff member mocked their accent, a discrimination claim."])),
  c("facebook", "fb-post-5", 12, "Amy W", "Battery service came to my work and replaced it in the parking lot. Easy.", s("positive", 0.8, ["Car care", "Roadside assistance"], "Battery replaced at workplace, easy")),
  c("facebook", "fb-post-5", 14, "Jim H", "Got a call from someone saying they're AAA and need my card number to renew. Is this real??", s("neutral", -0.2, ["Membership"], "Reports possible scam call using AAA name", true, ["high", ["fraud_or_scam"], "Someone may be impersonating AAA by phone to collect card numbers."])),
  c("facebook", "fb-post-6", 16, "Pat C", "Thanks for the gas price updates, super helpful before road trips.", s("positive", 0.7, ["Community and safety"], "Finds gas price updates helpful")),
  c("facebook", "fb-post-6", 18, "Lisa G", "Insurance quote was cheaper than my current company but the agent took a week to call back.", s("mixed", 0.1, ["Insurance", "Customer service"], "Good insurance price, slow agent callback")),
  c("facebook", "fb-post-7", 20, "Gary F", "Been a member 30 years. Never had a bad experience.", s("positive", 0.9, ["Membership"], "Loyal 30 year member, always good")),
  c("facebook", "fb-post-7", 22, "Nina S", "App kept crashing when I tried to request service. Had to call instead.", s("negative", -0.5, ["Roadside assistance", "Customer service"], "App crashed while requesting service", true)),
  c("facebook", "fb-post-8", 25, "Ken J", "Posted a video of your truck running a red light on Main St. Tagging the news.", s("negative", -0.8, ["Roadside assistance"], "Video of AAA truck running red light, tagging news", false, ["high", ["crisis_or_viral", "employee_conduct", "safety_or_injury"], "Video of a branded truck running a red light shared with news outlets."])),
  c("facebook", "fb-post-8", 27, "Beth A", "Signed my daughter up for driving school. Instructor was patient and she passed first try!", s("positive", 0.95, ["Driver training"], "Daughter passed after patient instruction")),
  // Instagram
  c("instagram", "ig-post-1", 1, "roadtrip_jess", "Saved by AAA again 🙌 locked my keys in at Wegmans", s("positive", 0.85, ["Roadside assistance"], "Quick lockout help at Wegmans")),
  c("instagram", "ig-post-1", 3, "buffalo_dan", "how long does it take to get an international driving permit?", s("neutral", 0, ["Travel"], "Asks how long an IDP takes", true)),
  c("instagram", "ig-post-1", 3, "", "Hi Dan! Send us a message and we'll walk you through the steps for an international driving permit.", undefined),
  c("instagram", "ig-post-2", 7, "cuse_mama", "Love the car seat check event, the techs were so helpful", s("positive", 0.9, ["Community and safety"], "Praises car seat check event")),
  c("instagram", "ig-post-2", 9, "tony.v", "you guys posted my license plate in this pic, please take it down", s("negative", -0.4, ["Community and safety"], "Asks to remove photo showing their plate", true, ["medium", ["privacy_or_data"], "A member's license plate is visible in a brand post and they asked for removal."])),
  c("instagram", "ig-post-3", 11, "kayla.travels", "Booked Disney through AAA and got free park tickets upgrade 😍", s("positive", 0.9, ["Travel", "Discounts"], "Disney booking came with ticket upgrade")),
  c("instagram", "ig-post-3", 13, "rocdriver", "prices keep going up and service keeps getting slower", s("negative", -0.6, ["Membership", "Roadside assistance"], "Higher prices, slower service")),
  c("instagram", "ig-post-4", 15, "auto_fan_88", "Which car care center does alignments near Henrietta?", s("neutral", 0, ["Car care"], "Asks for alignment location near Henrietta", true)),
  c("instagram", "ig-post-4", 19, "sarah.k", "Great tips on winter driving!! sharing with my teen", s("positive", 0.8, ["Community and safety", "Driver training"], "Sharing winter driving tips with teen")),
  c("instagram", "ig-post-5", 23, "mark_utica", "Mechanic at your repair shop told me I needed $1,200 in brakes. Another shop said they were fine. Scam?", s("negative", -0.7, ["Car care"], "Says shop overquoted brake work, suspects scam", true, ["medium", ["fraud_or_scam"], "Accuses an approved shop of upselling unneeded repairs."])),
  c("instagram", "ig-post-5", 26, "gina_b", "AAA membership is the best gift I ever gave my mom", s("positive", 0.9, ["Membership"], "Membership was a great gift for mom")),
  // LinkedIn
  c("linkedin", "li-post-1", 3, "Rachel Owens", "Great to see the team out volunteering at the food drive this weekend!", s("positive", 0.9, ["Community and safety"], "Praises team volunteering at food drive")),
  c("linkedin", "li-post-1", 5, "James Carter", "Proud to have partnered with AAA on the teen safe driving campaign this year.", s("positive", 0.85, ["Driver training", "Community and safety"], "Partner proud of teen driving campaign")),
  c("linkedin", "li-post-2", 12, "Former Employee", "Maybe treat your call center staff better before posting about culture. Mandatory overtime every week.", s("negative", -0.7, ["Customer service"], "Former staff alleges mandatory weekly overtime", false, ["medium", ["employee_conduct", "regulatory"], "Public claim about working conditions that could draw labor scrutiny."])),
  c("linkedin", "li-post-2", 17, "Monica Reyes", "Great insight on EV road service readiness. Would love to learn more.", s("positive", 0.7, ["Roadside assistance"], "Interested in EV road service work", true)),
  c("linkedin", "li-post-3", 24, "Brian Hall", "Are you hiring travel agents in the Syracuse area?", s("neutral", 0.1, ["Travel"], "Asks about travel agent jobs in Syracuse", true, ["none", [], null])),
  // TikTok
  c("tiktok", "tt-video-1", 1, "jdub.716", "the jump start guy was a legend 😂", s("positive", 0.8, ["Roadside assistance"], "Funny praise for jump start technician")),
  c("tiktok", "tt-video-1", 2, "nyroadrage", "lol AAA took 4 hrs for me last winter", s("negative", -0.6, ["Roadside assistance"], "Recalls four hour wait last winter")),
  c("tiktok", "tt-video-2", 6, "carmeme.queen", "this is so useful, didn't know you could do that with a dead battery", s("positive", 0.7, ["Car care"], "Found battery tip useful")),
  c("tiktok", "tt-video-2", 8, "anon_user_23", "your driver almost hit me on the 490 I have dashcam", s("negative", -0.8, ["Roadside assistance"], "Says AAA driver nearly hit them, has dashcam", true, ["high", ["safety_or_injury", "employee_conduct", "crisis_or_viral"], "Near-miss allegation with dashcam footage that could spread."])),
  c("tiktok", "tt-video-3", 13, "trip.with.tay", "do you guys do passport photos??", s("neutral", 0, ["Travel"], "Asks about passport photos", true)),
  c("tiktok", "tt-video-3", 13, "", "Great question! Send us a message and we'll point you to the nearest branch that offers them.", undefined),
  c("tiktok", "tt-video-3", 21, "sam_drives", "ok this ad actually made me sign up", s("positive", 0.8, ["Membership"], "Signed up after seeing video")),
];
