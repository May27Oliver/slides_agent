/**
 * Curated design knowledge ported from the UI/UX Pro Max skill database
 * (data/typography.csv, data/colors.csv). This brings the skill's font-pairing
 * and palette intelligence in-process instead of shelling out to its Python
 * search, so the design layer can select a concrete, professional style kit.
 */

export interface CuratedFontPairing {
  id: string;
  /** Latin display family (Google Fonts). */
  headingFamily: string;
  /** Latin body family (Google Fonts). */
  bodyFamily: string;
  /** Weight axes to request, keyed by family. */
  weights: Record<string, string>;
  keywords: string[];
}

export interface CuratedPalette {
  id: string;
  primary: string;
  secondary: string;
  cta: string;
  background: string;
  text: string;
  border: string;
  /** Whether the background is dark (drives background composition). */
  dark: boolean;
  keywords: string[];
}

export const CURATED_FONT_PAIRINGS: [CuratedFontPairing, ...CuratedFontPairing[]] = [
  {
    id: "modern-professional",
    headingFamily: "Poppins",
    bodyFamily: "Open Sans",
    weights: { Poppins: "400;500;600;700;800", "Open Sans": "400;500;600;700" },
    keywords: [
      "professional",
      "modern",
      "business",
      "corporate",
      "saas",
      "interview",
      "面試",
      "簡報",
      "商務",
      "pitch"
    ]
  },
  {
    id: "friendly-saas",
    headingFamily: "Plus Jakarta Sans",
    bodyFamily: "Plus Jakarta Sans",
    weights: { "Plus Jakarta Sans": "400;500;600;700;800" },
    keywords: ["friendly", "approachable", "saas", "product", "startup", "親切"]
  },
  {
    id: "tech-startup",
    headingFamily: "Space Grotesk",
    bodyFamily: "DM Sans",
    weights: { "Space Grotesk": "400;500;600;700", "DM Sans": "400;500;600;700" },
    keywords: ["tech", "startup", "developer", "modern", "engineering", "科技"]
  },
  {
    id: "geometric-modern",
    headingFamily: "Outfit",
    bodyFamily: "Work Sans",
    weights: { Outfit: "400;500;600;700;800", "Work Sans": "400;500;600;700" },
    keywords: ["geometric", "modern", "minimal", "clean", "簡潔"]
  },
  {
    id: "playful-creative",
    headingFamily: "Fredoka",
    bodyFamily: "Nunito",
    weights: { Fredoka: "400;500;600;700", Nunito: "400;500;600;700;800" },
    keywords: ["playful", "creative", "fun", "vibrant", "friendly", "活潑", "創意"]
  },
  {
    id: "classic-elegant",
    headingFamily: "Playfair Display",
    bodyFamily: "Inter",
    weights: { "Playfair Display": "400;500;600;700", Inter: "300;400;500;600;700" },
    keywords: ["elegant", "luxury", "premium", "editorial", "sophisticated", "優雅", "高級"]
  },
  {
    id: "corporate-trust",
    headingFamily: "Lexend",
    bodyFamily: "Source Sans 3",
    weights: { Lexend: "400;500;600;700", "Source Sans 3": "400;500;600;700" },
    keywords: ["corporate", "trust", "government", "b2b", "enterprise", "信任", "企業"]
  },
  {
    id: "wellness-calm",
    headingFamily: "Lora",
    bodyFamily: "Raleway",
    weights: { Lora: "400;500;600;700", Raleway: "300;400;500;600;700" },
    keywords: ["wellness", "calm", "health", "soft", "spa", "療癒", "健康"]
  }
];

export const CURATED_PALETTES: [CuratedPalette, ...CuratedPalette[]] = [
  {
    id: "warm-coral",
    primary: "#FF6B6B",
    secondary: "#FF9F43",
    cta: "#FFC93C",
    background: "#FFF8EE",
    text: "#1F2937",
    border: "#FDE3D0",
    dark: false,
    keywords: [
      "warm",
      "friendly",
      "professional",
      "interview",
      "personal",
      "面試",
      "簡報",
      "暖",
      "活潑",
      "approachable"
    ]
  },
  {
    id: "service-sky",
    primary: "#0EA5E9",
    secondary: "#38BDF8",
    cta: "#F97316",
    background: "#F0F9FF",
    text: "#0C4A6E",
    border: "#BAE6FD",
    dark: false,
    keywords: ["service", "landing", "friendly", "clean", "trust", "服務"]
  },
  {
    id: "saas-blue",
    primary: "#2563EB",
    secondary: "#3B82F6",
    cta: "#F97316",
    background: "#F8FAFC",
    text: "#1E293B",
    border: "#E2E8F0",
    dark: false,
    keywords: [
      "saas",
      "professional",
      "business",
      "corporate",
      "trust",
      "商務",
      "tech",
      "startup",
      "developer",
      "科技",
      "pitch",
      "investor",
      "投資"
    ]
  },
  {
    id: "creative-pink",
    primary: "#EC4899",
    secondary: "#F472B6",
    cta: "#06B6D4",
    background: "#FDF2F8",
    text: "#831843",
    border: "#FBCFE8",
    dark: false,
    keywords: ["creative", "playful", "agency", "vibrant", "fun", "活潑", "創意"]
  },
  {
    id: "educational-indigo",
    primary: "#4F46E5",
    secondary: "#818CF8",
    cta: "#F97316",
    background: "#EEF2FF",
    text: "#1E1B4B",
    border: "#C7D2FE",
    dark: false,
    keywords: ["education", "learning", "course", "academic", "教學", "教育"]
  },
  {
    id: "productivity-teal",
    primary: "#0D9488",
    secondary: "#14B8A6",
    cta: "#F97316",
    background: "#F0FDFA",
    text: "#134E4A",
    border: "#99F6E4",
    dark: false,
    keywords: ["productivity", "fresh", "tool", "efficient", "效率"]
  },
  {
    id: "healthcare-cyan",
    primary: "#0891B2",
    secondary: "#22D3EE",
    cta: "#059669",
    background: "#ECFEFF",
    text: "#164E63",
    border: "#A5F3FC",
    dark: false,
    keywords: ["healthcare", "calm", "wellness", "medical", "健康", "療癒"]
  },
  {
    id: "portfolio-ink",
    primary: "#18181B",
    secondary: "#3F3F46",
    cta: "#BFA46A",
    background: "#FAFAFA",
    text: "#09090B",
    border: "#E4E4E7",
    dark: false,
    keywords: [
      "portfolio",
      "minimal",
      "personal",
      "editorial",
      "elegant",
      "luxury",
      "premium",
      "sophisticated",
      "簡潔",
      "個人",
      "優雅",
      "高級"
    ]
  }
];
