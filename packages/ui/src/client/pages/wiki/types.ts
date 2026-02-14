export interface WikiPageSummary {
  path: string;
  href: string;
  title: string;
  sourcePath: string;
  updatedAt: number;
}

export interface WikiPageContent extends WikiPageSummary {
  content: string;
}

export interface WikiPageResponse {
  wikiRoot: string;
  requestedPath: string;
  page: WikiPageContent;
  pages: WikiPageSummary[];
}

export interface WikiPageUpdateResponse extends WikiPageResponse {
  message?: string;
}
