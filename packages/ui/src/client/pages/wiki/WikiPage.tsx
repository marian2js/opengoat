import { MessageResponse } from "@/components/ai-elements/message";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactElement } from "react";
import type { WikiPageController } from "./useWikiPageController";
import { normalizeWikiPath } from "./utils";

interface WikiPageProps {
  controller: WikiPageController;
}

export function WikiPage({ controller }: WikiPageProps): ReactElement {
  return (
    <section className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-3">
        <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Wiki Pages
        </p>
        {controller.pages.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            No wiki pages found.
          </p>
        ) : (
          <div className="space-y-1">
            {controller.pages.map((page) => {
              const pagePath = normalizeWikiPath(page.path);
              const isActive = pagePath === controller.activePath;

              return (
                <button
                  key={page.path || "wiki-root"}
                  type="button"
                  title={page.href}
                  onClick={() => controller.selectPage(pagePath)}
                  className={cn(
                    "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {page.title}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <div className="space-y-3">
        {controller.error ? (
          <Card className="border-danger/40 bg-danger/5">
            <CardContent className="pt-5">
              <p className="text-sm text-danger">{controller.error}</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/30">
          {controller.isLoading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Loading wiki page...
            </div>
          ) : !controller.page ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Select a wiki page to continue.
            </div>
          ) : controller.isEditing ? (
            <div className="p-4">
              <textarea
                className="min-h-[60vh] w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={controller.draft}
                onChange={(event) => controller.setDraft(event.target.value)}
                placeholder="Write markdown..."
              />
            </div>
          ) : (
            <div className="p-4">
              <MessageResponse className="space-y-4 leading-7">
                {controller.page.content || "_This page is empty._"}
              </MessageResponse>
            </div>
          )}
        </div>

        {controller.page ? (
          <p className="text-xs text-muted-foreground">
            Source: {controller.page.sourcePath}
          </p>
        ) : controller.wikiRootPath ? (
          <p className="text-xs text-muted-foreground">
            Wiki root: {controller.wikiRootPath}
          </p>
        ) : null}
      </div>
    </section>
  );
}
