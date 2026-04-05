export interface WikiFrontmatter {
  title?: string;
  sidebarTitle?: string;
  permalink?: string;
  [key: string]: unknown;
}

export interface WikiTocItem {
  id: string;
  text: string;
  level: number;
}

export interface WikiDocument {
  slug: string[];
  title: string;
  html: string;
  frontmatter: WikiFrontmatter;
  lastModified: Date;
  version: string;
  tableOfContents: WikiTocItem[];
}

export interface WikiNavItem {
  title: string;
  slug: string[];
  isFile: boolean;
  children?: WikiNavItem[];
}

export type WikiVersionKind = "stable" | "channel" | "legacy";

export interface WikiVersion {
  name: string;
  slug: string;
  isDefault: boolean;
  kind: WikiVersionKind;
}

export interface WikiSearchResult {
  title: string;
  slug: string[];
  highlightedSnippet: string;
  matchType: "title" | "content";
}
