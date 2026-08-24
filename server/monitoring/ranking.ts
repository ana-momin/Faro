export type RankedPostInput = {
  body: string;
  postedAt: Date;
  engagement: Record<string, number>;
  includeTerms: string[];
  excludeTerms: string[];
  goal?: string;
  categories?: string[];
  aiConfidence?: number;
  aiLabel?: string;
};

export type ScoreComponent = { label: string; points: number };

const DIRECT_SERVICE_REQUEST_PATTERNS = ["looking for someone", "looking for a freelancer", "looking for an agency", "looking for a developer", "looking for an engineer", "looking for a tester", "looking for a product tester", "looking for a designer", "looking for a creator", "looking for an editor", "looking for an expert", "looking for an ai expert", "looking for a consultant", "looking to hire", "need someone", "need a freelancer", "need an agency", "need a developer", "need an engineer", "need a tester", "need a product tester", "need a designer", "need a creator", "need an editor", "need an expert", "need an ai expert", "need a consultant", "needs someone", "needs a freelancer", "needs an agency", "needs a developer", "needs a tester", "needs an expert", "needs an ai expert", "needs a consultant", "need help with", "need help building", "need a hand with", "needs help with", "needs help building", "can someone build", "can someone set up", "can someone implement", "who can build", "who can help us", "recommend someone", "recommend a freelancer", "recommend an agency", "seeking a provider", "seeking an expert", "seeking an ai expert", "looking to outsource", "need a team to", "needs a team to", "does anyone know a developer", "does anyone know an agency", "does anyone know a freelancer", "does anyone know a consultant", "anyone know a developer", "anyone know an agency", "anyone know a freelancer", "recommendations for a developer", "recommendations for an agency", "hire a"];
const CONCRETE_HELP_REQUEST_PATTERN = /\bneed(?:s)? (?:help|a hand) (?:with )?(?:building|automating|implementing|setting up|creating|integrating|developing|designing|an? ai (?:agent|workflow|automation)|automation|a workflow)\b/;
const SERVICE_DELIVERY_PATTERNS = ["build", "map", "implement", "set up", "setup", "automate", "integrate", "configure", "develop", "create", "produce", "edit", "manage", "design", "launch", "maintain", "streamline", "install", "test", "qa", "validate", "research", "audit", "debug", "ship", "publish", "post", "submit", "enter"];
const PROVIDER_PATTERNS = ["freelancer", "agency", "consultant", "expert", "specialist", "developer", "builder", "contractor", "service provider", "vendor"];
const BUYER_PROVIDER_REQUEST_PATTERN = /\b(?:looking for|need(?:s)?|seeking|want(?:s)? to hire|hire|recommend(?:ations)?|can anyone recommend|does anyone know|anyone know|who can help)\b.{0,70}\b(?:freelancer|agency|consultant|expert|specialist|developer|builder|contractor|service provider|vendor)\b/;
const BUYER_REQUEST_WITH_LOCAL_SCOPE_PATTERN = /\b(?:looking for (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:ai )?expert|an? consultant)|need(?:s)? (?:someone|a freelancer|an? agency|a developer|an? engineer|a tester|a product tester|a designer|a creator|an? editor|an? (?:ai )?expert|an? consultant|help|a hand|a team)|can someone|who can|recommend (?:someone|a freelancer|an? agency)|does anyone know an? (?:developer|agency|freelancer|consultant)|anyone know an? (?:developer|agency|freelancer)|recommendations for an? (?:developer|agency|freelancer)|looking to outsource)\b.{0,160}\b(?:build|map|implement|set up|setup|automate|integrate|configure|develop|create|produce|edit|manage|design|maintain|streamline|install|test|qa|validate|research|audit|debug|ship|publish|post|submit|enter)\b/;
const URGENCY_PATTERNS = ["asap", "urgent", "this week", "today", "tomorrow", "by friday", "right away", "quickly"];
const DECISION_PATTERNS = ["our team", "my team", "our business", "my business", "our company", "client", "clients", "founder", "agency", "small business", "budget", "project", "for us"];
const DIRECT_BUYER_SUBJECT_PATTERN = /\b(i|we|our|my|team|company|business|founder|client)\b.{0,90}\b(looking for|need(?:s)? someone|need(?:s)? a freelancer|need(?:s)? an agency|need(?:s)? a developer|need(?:s)? an engineer|need(?:s)? a tester|need(?:s)? a product tester|need(?:s)? a designer|need(?:s)? a creator|need(?:s)? an editor|need(?:s)? an expert|need(?:s)? help|need(?:s)? a hand|seeking|can someone|who can|recommend|hire)\b/;
const OPENING_BUYER_ASK_PATTERN = /^\s*(looking for|need(?:s)? someone|need(?:s)? a freelancer|need(?:s)? an agency|need(?:s)? a developer|need(?:s)? an engineer|need(?:s)? a tester|need(?:s)? a product tester|need(?:s)? a designer|need(?:s)? a creator|need(?:s)? an editor|need(?:s)? an expert|need(?:s)? help|need(?:s)? a hand|seeking|can someone|who can|recommend|hire|does anyone know a (developer|agency|freelancer|consultant)|anyone know a (developer|agency|freelancer)|recommendations for an? (developer|agency|freelancer))\b/;
const NON_SERVICE_CONTEXT_PATTERNS = ["book a call", "dm me", "follow for", "we built", "i built", "launching", "limited offer", "sign up", "buy now", "check out my", "you need", "you don't need", "they need someone", "businesses don't need", "show you how", "more advice", "stop being told", "happy to connect", "curious to hear", "for beta testing", "drop what you're working on", "looking for people building", "coaching", "workshop", "workshops", "motivation", "my next role", "next role", "my course", "course on", "webinar", "lecture", "podcast", "newsletter", "tutorial", "tips", "learning", "recommend this", "recommend a talk", "recommend a lecture", "recommend a course", "recommend a podcast", "co-founder", "cofounder", "looking for a job", "job seeker", "open to work", "we are hiring", "we're hiring", "hiring:", "hiring for", "hiring a", "hiring an", "job opening", "apply now", "click the link", "join the team", "self-motivated", "willing to learn", "per hour", "hrs/week", "pay:", "internship", "full-time", "full time", "part-time", "part time", "salary", "resume", "candidate", "position"];
const PROMOTIONAL_PATTERNS = ["book a call", "dm me", "follow for", "we built", "i built", "launching", "limited offer", "sign up", "buy now", "check out my", "you need", "you don't need", "show you how", "more advice", "stop being told", "coaching", "workshop", "workshops"];
const SERVICE_OFFER_PATTERNS = ["i offer", "we offer", "my services", "our services", "available for hire", "available to hire", "hire me", "book me", "dm for", "dm me for", "i can build", "we can build", "i build ai", "we build ai", "i build automation", "we build automation", "i help businesses", "we help businesses", "i help founders", "we help founders", "reach out if you need", "contact me for"];
const SELF_PROVIDER_OFFER_PATTERN = /\b(i am|i'm|we are|we're)\b.{0,100}\b(build(?:s|ing)?|help(?:s|ing)?|offer(?:s|ing)?|deliver(?:s|ing)?|speciali[sz](?:e|es|ing)|work with|provide(?:s|ing)?)\b/;
const GENERIC_GOAL_WORDS = new Set(["people", "asking", "help", "building", "build", "looking", "someone", "with", "from", "that", "this", "their", "about", "small", "business", "public", "posts", "for", "and", "the", "a", "an", "to", "of", "in"]);

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 3 && !GENERIC_GOAL_WORDS.has(token));
}

function goalCoverage(body: string, goal?: string) {
  const goalTokens = Array.from(new Set(tokens(goal ?? "")));
  return goalTokens.filter(token => body.includes(token)).length;
}

function hasAny(body: string, patterns: string[]) {
  return patterns.some(pattern => body.includes(pattern));
}

function conceptVariants(term: string) {
  const normalized = term.toLowerCase().trim();
  const variants = new Set([normalized]);
  if (normalized.includes("automation") || normalized === "automate") variants.add("automation").add("automate").add("automating");
  if (normalized.includes("workflow")) variants.add("workflow").add("workflows");
  if (normalized.includes("ai agent")) variants.add("ai agent").add("ai agents").add("agentic");
  if (normalized.includes("product test") || normalized.includes("user test")) variants.add("product testing").add("user testing").add("beta testing").add("qa testing");
  if (normalized.includes("video")) variants.add("video").add("ugc");
  return Array.from(variants);
}

function matchedConcepts(body: string, includeTerms: string[]) {
  return includeTerms.filter(term => conceptVariants(term).some(variant => body.includes(variant)));
}

function serviceIntentAssessment(body: string, includeTerms: string[], goal?: string, aiLabel?: string, aiConfidence = 0) {
  const concepts = matchedConcepts(body, includeTerms);
  const goalMatches = goalCoverage(body, goal);
  const directRequest = hasAny(body, DIRECT_SERVICE_REQUEST_PATTERNS);
  const concreteHelpRequest = CONCRETE_HELP_REQUEST_PATTERN.test(body);
  const deliveryScope = hasAny(body, SERVICE_DELIVERY_PATTERNS);
  const providerRequest = hasAny(body, PROVIDER_PATTERNS);
  const requestHasLocalScope = BUYER_REQUEST_WITH_LOCAL_SCOPE_PATTERN.test(body);
  const buyerContext = hasAny(body, DECISION_PATTERNS);
  const directBuyerRequest = (directRequest && (buyerContext || DIRECT_BUYER_SUBJECT_PATTERN.test(body) || OPENING_BUYER_ASK_PATTERN.test(body))) || BUYER_PROVIDER_REQUEST_PATTERN.test(body);
  const nonServiceContext = hasAny(body, NON_SERVICE_CONTEXT_PATTERNS);
  const promotionalContext = hasAny(body, PROMOTIONAL_PATTERNS);
  const selfDescribedDelivery = SELF_PROVIDER_OFFER_PATTERN.test(body) && !/(looking for|need someone|needs someone|seeking|recommend)/.test(body);
  const serviceOffer = hasAny(body, SERVICE_OFFER_PATTERNS) || selfDescribedDelivery || /\bwhat i do\b|\bwhat we do\b/.test(body);
  const hasRelevantNeed = concepts.length > 0 || goalMatches > 0;
  const modelConfirmedServiceNeed = aiLabel === "Active help-seeking" && aiConfidence >= 0.8;
  const concreteBuyerRequest = directBuyerRequest && (!/need(?:s)? help with/.test(body) || concreteHelpRequest);
  const serviceSeeking = !nonServiceContext && !serviceOffer && hasRelevantNeed && concreteBuyerRequest && (requestHasLocalScope || providerRequest);

  return { concepts, goalMatches, directRequest, directBuyerRequest, concreteBuyerRequest, deliveryScope, providerRequest, requestHasLocalScope, buyerContext, nonServiceContext, promotionalContext, serviceOffer, modelConfirmedServiceNeed, serviceSeeking };
}

export function rankOpportunity(input: RankedPostInput) {
  const body = input.body.toLowerCase();
  const components: ScoreComponent[] = [];
  const hasExcludedTerm = input.excludeTerms.some(term => body.includes(term.toLowerCase()));

  if (hasExcludedTerm) {
    components.push({ label: "Excluded term present", points: -100 });
    return { score: 0, components };
  }

  const assessment = serviceIntentAssessment(body, input.includeTerms, input.goal, input.aiLabel, input.aiConfidence);
  if (assessment.serviceOffer) {
    components.push({ label: "Service offer rather than buyer request", points: -100 });
    return { score: 0, components };
  }
  if (assessment.nonServiceContext) {
    components.push({ label: assessment.promotionalContext ? "Promotional rather than request-led" : "Non-service context", points: -100 });
    return { score: 0, components };
  }

  if (!assessment.serviceSeeking) {
    if (assessment.concepts.length) components.push({ label: `Topic mention · ${assessment.concepts.length} monitored concept${assessment.concepts.length === 1 ? "" : "s"}`, points: 8 });
    components.push({ label: "No clear service-seeking intent", points: -40 });
    return { score: 0, components };
  }

  const topicPoints = Math.min(18, assessment.concepts.reduce((total, term) => total + (term.trim().includes(" ") ? 12 : 6), 0));
  if (topicPoints) components.push({ label: `Topic fit · ${assessment.concepts.length} monitored concept${assessment.concepts.length === 1 ? "" : "s"}`, points: topicPoints });

  if (assessment.directRequest) components.push({ label: "Direct service request", points: 42 });
  else if (assessment.modelConfirmedServiceNeed) components.push({ label: "Model-confirmed service request", points: 30 });
  if (assessment.deliveryScope) components.push({ label: "Defined task or service need", points: 18 });
  if (assessment.providerRequest) components.push({ label: "Provider or expert requested", points: 10 });
  if (assessment.goalMatches >= 3) components.push({ label: "Matches desired outcome context", points: 8 });
  else if (assessment.goalMatches >= 1) components.push({ label: "Partial desired outcome context", points: 4 });
  if (hasAny(body, URGENCY_PATTERNS)) components.push({ label: "Timing signal", points: 8 });
  if (assessment.buyerContext) components.push({ label: "Buyer or decision-maker context", points: 12 });

  const hasSpecificity = /\d|\?|\bfor (my|our|a)\b|\bworkflow\b|\bproject\b|\bbrief\b|\bbudget\b/.test(body);
  if (hasSpecificity) components.push({ label: "Specific usable context", points: 6 });

  if (body.trim().length < 55 || /^https?:\/\//.test(body.trim())) components.push({ label: "Low-context post", points: -12 });

  const ageHours = Math.max(0, (Date.now() - input.postedAt.getTime()) / 3_600_000);
  const recency = ageHours <= 1 ? 10 : ageHours <= 6 ? 7 : ageHours <= 24 ? 4 : ageHours <= 72 ? 2 : 0;
  if (recency) components.push({ label: "Fresh enough to act on", points: recency });

  const engagementTotal = Object.values(input.engagement).reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (engagementTotal >= 100) components.push({ label: "Strong public engagement", points: 4 });
  else if (engagementTotal >= 15) components.push({ label: "Early engagement signal", points: 2 });

  if (input.aiLabel === "Active help-seeking" && (input.aiConfidence ?? 0) >= 0.8) components.push({ label: "High-confidence intent support", points: 4 });

  const score = Math.max(0, Math.min(100, Math.round(components.reduce((sum, component) => sum + component.points, 0))));
  return { score, components };
}

/**
 * A deterministic source-level guard used before the per-post model call.
 * It deliberately reuses Faro’s existing buyer-only ranker so clearly
 * promotional, job, networking, and generic-topic posts do not consume LLM
 * work during a controlled source sync.
 */
export function isPotentialBuyerOpportunity(input: Omit<RankedPostInput, "aiConfidence" | "aiLabel">) {
  return rankOpportunity({ ...input, aiConfidence: 0, aiLabel: "Low-intent mention" }).score > 0;
}

export function deterministicIntent(body: string, includeTerms: string[], goal = "") {
  const normalized = body.toLowerCase();
  const assessment = serviceIntentAssessment(normalized, includeTerms, goal);
  const isActive = assessment.serviceSeeking;
  const isRelevant = !assessment.nonServiceContext && (assessment.concepts.length > 0 || assessment.goalMatches >= 2);
  const confidence = isActive
    ? Math.min(0.94, 0.58 + assessment.concepts.length * 0.08 + (assessment.deliveryScope ? 0.12 : 0) + (assessment.buyerContext ? 0.08 : 0))
    : isRelevant
      ? Math.min(0.48, 0.14 + assessment.concepts.length * 0.08 + assessment.goalMatches * 0.04)
      : 0.08;
  return {
    label: isActive ? "Active help-seeking" : isRelevant ? "Potentially relevant" : "Low-intent mention",
    confidence: Math.max(0.05, Math.round(confidence * 100) / 100),
    rationale: isActive
      ? "The post expresses a concrete need for a person, provider, or expert to deliver a relevant service."
      : isRelevant
        ? "The post overlaps with the monitored topic or outcome but does not clearly seek a provider or service."
        : "The post does not show a relevant service-seeking need for this monitoring goal.",
    model: "deterministic fallback",
    fallback: true,
  };
}
