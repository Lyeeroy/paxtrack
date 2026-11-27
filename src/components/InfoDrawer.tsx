"use client";

import { useEffect, useRef, useState } from "react";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_TEMPLATE,
  TEMPLATE_TOKENS,
  expandTemplate,
  getCustomLinks,
  imdbUrl,
  saveCustomLinks,
  tmdbUrl,
  traktUrl,
  type LinkContext,
} from "@/lib/links";
import type { TitleInfo } from "@/lib/refresh";
import { haptic, showToast } from "@/lib/toast";
import type { Item } from "@/lib/types";
import NavCapsule, { type NavEntry } from "./NavCapsule";
import {
  IconCast,
  IconClose,
  IconCopy,
  IconExpandDown,
  IconExpandUp,
  IconExternal,
  IconInfo,
  IconLink,
  IconWatch,
  posterUrl,
} from "./ui";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "./ui/drawer";

type Page = "info" | "cast" | "watch" | "links";

const PAGES: readonly NavEntry<Page>[] = [
  { id: "info", label: "Info", Icon: IconInfo },
  { id: "cast", label: "Cast", Icon: IconCast },
  { id: "watch", label: "Where to watch", Icon: IconWatch },
  { id: "links", label: "Links", Icon: IconLink },
];

const PAGE_LABEL: Record<Page, string> = {
  info: "Description & genres",
  cast: "Cast",
  watch: "Where to watch",
  links: "Links",
};

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3.5">
      <dt className="shrink-0 text-xs text-faint">{label}</dt>
      <dd className="text-right text-[15px] text-fg">{value || "—"}</dd>
    </div>
  );
}

function formatRuntime(min: number | null) {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

function linkHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function CastAvatar({ path, name }: { path: string | null; name: string }) {
  const src = posterUrl(path, 92);
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-xs text-faint">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={40} height={40} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}

function InfoPage({ item, info, infoResolved }: { item: Item; info: TitleInfo | null; infoResolved: boolean }) {
  return (
    <>
      {info?.overview ? (
        <p className="text-[14px] leading-relaxed text-dim">{info.overview}</p>
      ) : !infoResolved ? (
        <p role="status" className="text-[13px] text-faint">Loading synopsis…</p>
      ) : (
        <p className="text-[13px] text-faint">No synopsis available.</p>
      )}
      {info?.genres?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {info.genres.map((g) => (
            <span key={g} className="rounded-full bg-raised px-3 py-1.5 text-[13px] text-dim">
              {g}
            </span>
          ))}
        </div>
      ) : null}
      <dl className="mt-5 divide-y divide-line/70 overflow-hidden rounded-2xl bg-raised">
        <InfoRow label="Rating" value={info?.voteAverage ? `${info.voteAverage.toFixed(1)} / 10` : null} />
        <InfoRow label={item.type === "movie" ? "Runtime" : "Episode length"} value={formatRuntime(info?.runtime ?? null)} />
        <InfoRow label="Release date" value={item.releaseDate?.slice(0, 10) ?? null} />
        <InfoRow label="Type" value={item.anime ? "Anime" : item.type === "tv" ? "TV series" : "Movie"} />
        <InfoRow label={item.type === "tv" ? "Series status" : "Release status"} value={item.tvStatus ?? null} />
        <InfoRow label="Added" value={new Date(item.addedAt).toISOString().slice(0, 10)} />
      </dl>
    </>
  );
}

function CastPage({ info, infoResolved }: { info: TitleInfo | null; infoResolved: boolean }) {
  if (!info?.cast?.length) {
    return (
      <p className="text-[13px] text-faint">{infoResolved ? "No cast available." : "Loading cast…"}</p>
    );
  }
  return (
    <ul className="divide-y divide-line/60">
      {info.cast.map((c, i) => (
        <li key={`${c.name}-${i}`} className="flex items-center gap-3 py-2.5">
          <CastAvatar path={c.profile} name={c.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-fg">{c.name}</span>
            <span className="block truncate text-[11px] text-faint">{c.character ?? "Cast"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProviderGroup({ title, names }: { title: string; names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-wider text-faint">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {names.map((name) => (
          <span key={name} className="rounded-full bg-raised px-3 py-1.5 text-[13px] text-dim">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function WatchPage({ info, infoResolved }: { info: TitleInfo | null; infoResolved: boolean }) {
  const watch = info?.watch;
  const region = watch?.country ?? "";
  let regionName = region;
  try {
    regionName = new Intl.DisplayNames(["en"], { type: "region" }).of(region) ?? region;
  } catch {
    // Old browsers: the country code is still readable.
  }
  if (!watch) {
    return (
      <p className="text-[13px] text-faint">
        {infoResolved ? "No watch providers listed for your region." : "Loading watch providers…"}
      </p>
    );
  }
  return (
    <>
      <p className="text-[11px] uppercase tracking-wider text-faint">Streaming in {regionName}</p>
      <ProviderGroup title="Stream" names={watch.flatrate} />
      <ProviderGroup title="Free" names={watch.free} />
      <ProviderGroup title="Rent" names={watch.rent} />
      <ProviderGroup title="Buy" names={watch.buy} />
      {!watch.flatrate.length && !watch.free.length && !watch.rent.length && !watch.buy.length ? (
        <p className="mt-3 text-[13px] text-dim">No providers listed for this region.</p>
      ) : null}
      {watch.link ? (
        <a
          href={watch.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-raised px-4 text-[13px] text-dim active:opacity-80"
        >
          <span className="min-w-0 flex-1">See all options on TMDB</span>
          <IconExternal className="size-4 shrink-0 text-faint" />
        </a>
      ) : null}
    </>
  );
}

function LinkRow({ label, value, href, onRemove }: { label: string; value?: string | null; href: string | null; onRemove?: () => void }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-fg">{label}</span>
        {value ? <span className="block truncate text-[11px] text-faint">{value}</span> : null}
      </span>
      {href ? <IconExternal className="size-4 shrink-0 text-faint" /> : <span className="text-xs text-faint">Unavailable</span>}
    </>
  );
  if (!href) {
    return <div className="flex min-h-[52px] items-center gap-3 border-b border-line/60 px-4 py-2.5">{body}</div>;
  }
  if (!onRemove) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[52px] items-center gap-3 border-b border-line/60 px-4 py-2.5 active:bg-surface"
      >
        {body}
      </a>
    );
  }
  return (
    <div className="flex items-center gap-1 border-b border-line/60">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-4 py-2.5 active:bg-surface"
      >
        {body}
      </a>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} link`}
        className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-faint active:bg-raised active:text-danger"
      >
        <IconClose className="size-4" />
      </button>
    </div>
  );
}

function LinksPage({
  ctx,
  info,
  template,
  onTemplateChange,
  customLinks,
  onAdd,
  onRemoveLink,
  customUrl,
  onCopy,
}: {
  ctx: LinkContext;
  info: TitleInfo | null;
  template: string;
  onTemplateChange: (value: string) => void;
  customLinks: { template: string; url: string | null }[];
  onAdd: () => void;
  onRemoveLink: (template: string) => void;
  customUrl: string | null;
  onCopy: () => void;
}) {
  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-raised">
        <LinkRow label="IMDb" value={info?.imdbId ?? null} href={imdbUrl(info?.imdbId)} />
        <LinkRow label="Trakt" href={traktUrl(ctx)} />
        <LinkRow label="TMDB" href={tmdbUrl(ctx)} />
        {customLinks.map(({ template, url }) => (
          <LinkRow
            key={template}
            label={url ? linkHost(url) : template}
            value={url ?? template}
            href={url}
            onRemove={() => onRemoveLink(template)}
          />
        ))}
      </div>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-wider text-faint">Your link</p>
        <FieldGroup className="mt-3 gap-4">
          <Field>
            <FieldLabel htmlFor="link-template" className="text-[13px] text-dim">URL template</FieldLabel>
            <Input
              id="link-template"
              value={template}
              onChange={(e) => onTemplateChange(e.target.value)}
              placeholder={DEFAULT_TEMPLATE}
              spellCheck={false}
              autoCapitalize="off"
              className="h-11 rounded-xl border-line bg-raised text-[16px]"
            />
            <FieldDescription className="text-xs text-faint">Tap a token to add it to the template.</FieldDescription>
          </Field>
        </FieldGroup>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {TEMPLATE_TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => onTemplateChange(template + token)}
              className="h-9 rounded-full bg-raised px-3 text-[13px] text-dim active:bg-line"
            >
              {token}
            </button>
          ))}
        </div>

        <p className="mt-3 max-h-20 overflow-y-auto break-all rounded-xl bg-raised p-3 text-xs text-dim">
          {customUrl ?? "Enter a valid http(s) URL above."}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onAdd}
            disabled={!customUrl}
            className={`flex h-12 flex-1 items-center justify-center rounded-xl text-[15px] font-semibold ${
              customUrl ? "bg-accent text-black active:opacity-80" : "bg-surface font-normal text-dim"
            }`}
          >
            Add
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={!customUrl}
            aria-label="Copy custom URL"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-raised text-dim active:opacity-80 disabled:text-faint"
          >
            <IconCopy className="size-5" />
          </button>
        </div>
      </div>
    </>
  );
}

export default function InfoDrawer({
  item,
  info,
  infoResolved,
  open,
  onClose,
  season,
  episode,
}: {
  item: Item;
  info: TitleInfo | null;
  infoResolved: boolean;
  open: boolean;
  onClose: () => void;
  season: number;
  episode: number;
}) {
  const [page, setPage] = useState<Page>("info");
  const pager = useRef<HTMLDivElement | null>(null);
  const jumping = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [customLinks, setCustomLinks] = useState<string[]>([]);

  // localStorage is client-only; SSR and first paint use the stable default.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCustomLinks(getCustomLinks()), []);
  // A fresh open always starts on Info.
  useEffect(() => {
    if (open && pager.current) pager.current.scrollLeft = 0;
  }, [open]);

  // Native scroll-snap owns the pager: one full-width column per page. onScroll
  // only reports which page the browser snapped to, so the tab pill follows a
  // horizontal swipe with no JS fling or velocity estimation (see Browse.tsx).
  const onScroll = () => {
    const vp = pager.current;
    if (!vp || jumping.current || vp.clientWidth <= 0) return;
    const index = Math.max(0, Math.min(PAGES.length - 1, Math.round(vp.scrollLeft / vp.clientWidth)));
    const next = PAGES[index].id;
    setPage((prev) => (prev === next ? prev : next));
  };

  const goToPage = (id: Page) => {
    const vp = pager.current;
    const index = PAGES.findIndex((entry) => entry.id === id);
    if (vp && index >= 0 && vp.clientWidth > 0) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // snap-stop: always can trap a programmatic jump past a page; relax it
      // for this scroll and restore it when the scroll ends (as Browse does).
      const pages = Array.from(vp.querySelectorAll<HTMLElement>("[data-snap-page]"));
      pages.forEach((p) => (p.style.scrollSnapStop = "normal"));
      jumping.current = true;
      let done = false;
      const restore = () => {
        if (done) return;
        done = true;
        jumping.current = false;
        pages.forEach((p) => (p.style.scrollSnapStop = ""));
        vp.removeEventListener("scrollend", restore);
        window.clearTimeout(timer);
      };
      const timer = window.setTimeout(restore, 800);
      vp.addEventListener("scrollend", restore);
      vp.scrollTo({ left: index * vp.clientWidth, behavior: reduced ? "auto" : "smooth" });
      if (reduced) restore();
    }
    setPage(id);
  };

  const ctx: LinkContext = {
    type: item.type,
    tmdbId: item.tmdbId,
    title: item.title,
    season: Math.max(1, season),
    episode: Math.max(1, episode),
    imdbId: info?.imdbId,
  };
  const customUrl = expandTemplate(template, ctx);

  const changeTemplate = (value: string) => setTemplate(value);
  const copyText = async (text: string, success: string, failure: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(success);
      haptic(8);
    } catch {
      showToast(failure);
    }
  };
  const copyUrl = () => {
    if (customUrl) void copyText(customUrl, "Link copied", "Could not copy link");
  };
  const copyTitle = () => void copyText(item.title, "Title copied", "Could not copy title");

  // Rows keep the template, not the expanded URL: every render re-expands it
  // with the title's current up-next season/episode.
  const savedLinks = customLinks.map((template) => ({ template, url: expandTemplate(template, ctx) }));
  const addLink = () => {
    if (!customUrl || !template) return;
    if (customLinks.includes(template)) {
      showToast("Link already added");
      return;
    }
    const next = [...customLinks, template];
    setCustomLinks(next);
    saveCustomLinks(next);
    showToast("Link added");
    haptic(8);
  };
  const removeLink = (template: string) => {
    const index = customLinks.indexOf(template);
    if (index < 0) return;
    const next = customLinks.filter((link) => link !== template);
    setCustomLinks(next);
    saveCustomLinks(next);
    showToast("Link removed", () => {
      // Read the stored list on undo so an Add in the meantime is kept.
      const current = getCustomLinks();
      if (current.includes(template)) return;
      const restored = [...current];
      restored.splice(Math.min(index, restored.length), 0, template);
      setCustomLinks(restored);
      saveCustomLinks(restored);
    });
    haptic(8);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
        else {
          setPage("info");
          setExpanded(false);
        }
      }}
      snapPoints={[0.78, 1]}
      snapPoint={expanded ? 1 : 0.78}
      onSnapPointChange={(snap) => setExpanded(snap === 1)}
      showSwipeHandle
    >
      <DrawerContent className="mx-auto max-w-xl rounded-t-2xl border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <DrawerHeader className="relative pb-0 text-left group-data-[swipe-axis=y]/drawer-popup:text-left">
          <div className="min-w-0 flex-1 pr-24">
            <DrawerTitle className="text-[16px] font-semibold leading-tight text-fg">
              <button
                type="button"
                onClick={copyTitle}
                aria-label={`Copy title: ${item.title}`}
                className="block w-full truncate rounded text-left active:opacity-80"
              >
                {item.title}
              </button>
            </DrawerTitle>
            <DrawerDescription className="mt-0.5 truncate text-xs text-dim">
              {PAGE_LABEL[page]}
            </DrawerDescription>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse details" : "Expand details"}
            className="absolute right-14 top-2 flex size-11 items-center justify-center rounded-full text-dim active:bg-raised hover:text-fg"
          >
            {expanded ? <IconExpandDown className="size-5" /> : <IconExpandUp className="size-5" />}
          </button>
          <DrawerClose
            aria-label="Close"
            className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-dim active:bg-raised hover:text-fg"
          >
            <IconClose className="size-5" />
          </DrawerClose>
        </DrawerHeader>
        <div
          ref={pager}
          className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          style={{ touchAction: "pan-x pan-y" }}
          onScroll={onScroll}
          role="group"
          aria-label="Details pages"
        >
          {PAGES.map(({ id }) => (
            <section key={id} data-snap-page className="h-full w-full shrink-0 snap-start snap-always" aria-hidden={page !== id}>
              <div
                className="h-full overflow-y-auto overscroll-contain px-4 pb-4 pt-1"
                style={{ touchAction: "pan-x pan-y" }}
                role="tabpanel"
                aria-label={PAGE_LABEL[id]}
                aria-labelledby={`info-drawer-tab-${id}`}
              >
                {id === "info" ? <InfoPage item={item} info={info} infoResolved={infoResolved} /> : null}
                {id === "cast" ? <CastPage info={info} infoResolved={infoResolved} /> : null}
                {id === "watch" ? <WatchPage info={info} infoResolved={infoResolved} /> : null}
                {id === "links" ? (
                  <LinksPage
                    ctx={ctx}
                    info={info}
                    template={template}
                    onTemplateChange={changeTemplate}
                    customLinks={savedLinks}
                    onAdd={addLink}
                    onRemoveLink={removeLink}
                    customUrl={customUrl}
                    onCopy={copyUrl}
                  />
                ) : null}
              </div>
            </section>
          ))}
        </div>
        {expanded ? (
          <NavCapsule
            variant="tab"
            items={PAGES}
            value={page}
            onNavigate={(id) => { haptic(8); goToPage(id); }}
            label="Details sections"
            className="shrink-0 px-3 pt-2"
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
