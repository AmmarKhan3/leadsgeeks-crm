// Shared lists for the LeadsGeeks CRM. Mirrors the approved prototype.

export const ROLES = {
  admin: { label: "Admin", short: "Admin" },
  lead: { label: "Team Lead", short: "Lead" },
  cs: { label: "Customer Success", short: "CS" },
  backend: { label: "Backend", short: "Backend" },
  sales: { label: "Sales", short: "Sales" },
} as const;
export type Role = keyof typeof ROLES;

export const INDUSTRY_GROUPS = [
  {
    label: "Home services",
    items: [
      "HVAC", "Plumbing & drain services", "Electrical contractors", "Handyman & small home repair",
      "Residential & commercial painting", "Carpet, upholstery & floor cleaning", "Junk removal", "Locksmith",
      "Garage door services", "Chimney & fireplace services", "Home & residential cleaning", "Pest control",
      "Flooring installation",
    ],
  },
  {
    label: "Outdoor & exterior",
    items: [
      "Landscaping & lawn care", "Roofing", "Tree service & arborists", "Pressure washing, window & exterior cleaning",
      "Gutter services", "Fencing & decking", "Holiday & Christmas lighting", "Pool service & repair",
    ],
  },
  {
    label: "Auto & transportation",
    items: [
      "Towing & roadside assistance", "Local moving", "Auto detailing & car wash", "Auto repair & body shops",
      "Auto glass repair & replacement", "Window tint, vehicle wrap & auto graphics",
      "Limousine, chauffeur & local transportation", "RV repair & service",
    ],
  },
  {
    label: "Commercial & construction",
    items: ["Specialty general contractors & remodelers", "Commercial janitorial & recurring cleaning", "Concrete & paving"],
  },
  { label: "Other", items: ["Other (specify)"] },
];
export const INDUSTRIES = INDUSTRY_GROUPS.flatMap((g) => g.items);

export const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
  ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

export const SERVICES = ["Local SEO", "GBP", "AI Search (GEO)", "LSA", "Google Ads", "Meta Ads", "Website", "GHL Automation", "Reputation"];

export const PLATFORMS = [
  "WordPress", "GoHighLevel", "Wix", "Squarespace", "Shopify", "Webflow", "Duda", "GoDaddy Website Builder", "Weebly",
  "Custom / HTML", "No website yet", "Other",
];

export const SITE_OWNERS = [
  ["us", "LeadsGeeks"],
  ["client", "Client"],
  ["agency", "Other"],
] as const;
export type SiteOwner = (typeof SITE_OWNERS)[number][0];

export const STATUSES = ["Signed", "Onboarding", "Active", "On hold", "Past due", "Churned"] as const;
export type AccountStatus = (typeof STATUSES)[number];
export const STATUS_HELP: Record<AccountStatus, string> = {
  Signed: "Sale closed, kickoff pending",
  Onboarding: "Collecting access, first setup",
  Active: "Running, billed monthly",
  "On hold": "Paused by client, not billed",
  "Past due": "Active, payment overdue",
  Churned: "Cancelled",
};
export const STATUS_TONE: Record<AccountStatus, string> = {
  Signed: "muted", Onboarding: "info", Active: "ok", "On hold": "warn", "Past due": "bad", Churned: "bad",
};
export const BILLABLE_STATUSES: AccountStatus[] = ["Active", "Past due"];

export const BILLING_METHODS = ["Card", "ACH", "Stripe", "PayPal", "Invoice", "GHL Payments"];
export const BACKEND_SPECIALTIES = ["SEO", "GBP", "Ads", "Website", "GHL"] as const;
export type Specialty = (typeof BACKEND_SPECIALTIES)[number];

// ---------- access checklist ----------
export const CHECK_STATUS = {
  have: { label: "Have it", tone: "ok", help: "We have working access" },
  requested: { label: "Requested", tone: "warn", help: "Asked the client, waiting on them" },
  pending: { label: "Pending", tone: "info", help: "Not requested from the client yet" },
  denied: { label: "Denied", tone: "bad", help: "Client refused to share it" },
  removed: { label: "Removed", tone: "muted", help: "We had it, access was taken away" },
  none: { label: "Not needed", tone: "muted", help: "Not relevant for this client" },
} as const;
export type CheckStatus = keyof typeof CHECK_STATUS;
export const CHECK_ORDER: CheckStatus[] = ["have", "requested", "pending", "denied", "removed", "none"];

// items we set up ourselves rather than access we collect
export const SETUP_KEYS = ["ghl", "chatbot"];
export const SETUP_HELP: Record<CheckStatus, string> = {
  have: "Set up and working",
  requested: "Client asked for it, not set up yet",
  pending: "Not started yet",
  denied: "Client does not want it",
  removed: "Was set up, since taken down",
  none: "Not relevant for this client",
};
export const checkLabel = (key: string, st: CheckStatus) => (SETUP_KEYS.includes(key) && st === "have" ? "Set up" : CHECK_STATUS[st].label);
export const checkHelp = (key: string, st: CheckStatus) => (SETUP_KEYS.includes(key) ? SETUP_HELP[st] : CHECK_STATUS[st].help);

export const CHECKLIST_GROUPS = [
  { key: "web", label: "Website & hosting", items: [
    { key: "cms", label: "Website / CMS login" },
    { key: "hosting", label: "Hosting panel" },
    { key: "domain", label: "Domain registrar / DNS" },
  ] },
  { key: "google", label: "Google", items: [
    { key: "gbp", label: "Google Business Profile" },
    { key: "ga", label: "Google Analytics" },
    { key: "gsc", label: "Search Console" },
  ] },
  { key: "social", label: "Social & ads", items: [
    { key: "fb", label: "Facebook / Instagram" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "yelp", label: "Yelp" },
    { key: "gads", label: "Google Ads" },
    { key: "mads", label: "Meta Ads" },
    { key: "lsa", label: "Local Services Ads" },
  ] },
  { key: "ghl", label: "GoHighLevel", items: [{ key: "ghl", label: "GHL sub-account created" }] },
  { key: "chatbot", label: "AI chat bot", items: [{ key: "chatbot", label: "Installed on client website" }] },
];
export const CHECKLIST_ITEMS = CHECKLIST_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.key })));
export const itemLabel = (key: string) => CHECKLIST_ITEMS.find((i) => i.key === key)?.label ?? key;

// which items a service needs ("*" = every account, "*site" = any account with a website)
export const ACCESS_NEEDS: Record<string, string[]> = {
  cms: ["*site"], hosting: ["*site"], domain: ["*site"], gbp: ["*"],
  ga: ["Local SEO", "AI Search (GEO)", "Website"], gsc: ["Local SEO", "AI Search (GEO)"],
  fb: ["Local SEO", "Reputation", "Meta Ads"], linkedin: [], yelp: ["Reputation", "Local SEO"],
  gads: ["Google Ads"], mads: ["Meta Ads"], lsa: ["LSA"], ghl: ["GHL Automation"], chatbot: ["*site"],
};
export function neededItems(services: string[], platform: string) {
  const hasSite = platform !== "No website yet";
  return CHECKLIST_ITEMS.filter((i) => {
    const n = ACCESS_NEEDS[i.key] ?? [];
    return n.includes("*") || (n.includes("*site") && hasSite) || n.some((s) => services.includes(s));
  });
}

// typical login page per item ({site} = the client's domain)
export const LOGIN_URLS: Record<string, string> = {
  cms: "https://{site}/wp-admin", hosting: "https://my.siteground.com/login", domain: "https://www.godaddy.com/sign-in",
  gbp: "https://business.google.com", ga: "https://analytics.google.com", gsc: "https://search.google.com/search-console",
  fb: "https://business.facebook.com", linkedin: "https://www.linkedin.com/login", yelp: "https://biz.yelp.com/login",
  gads: "https://ads.google.com", mads: "https://business.facebook.com/adsmanager", lsa: "https://ads.google.com/localservices",
};

export const CHANGE_AREAS = ["Details", "Contacts", "Status", "Access", "Login", "Team", "Approval", "Reports", "Account"] as const;
