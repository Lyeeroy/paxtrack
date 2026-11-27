"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { IconClose } from "./ui";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Shared shell for the Search and Discover filter sheets. The footer is always
 * laid out, so changing a filter never resizes the drawer: the panel is
 * content-sized, and a new row would move its top edge (ADR 0013).
 */
export function FilterDrawer({
  open,
  onClose,
  title,
  description,
  activeCount,
  resetLabel,
  onReset,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  activeCount: number;
  resetLabel: string;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      showSwipeHandle
    >
      <DrawerContent className="mx-auto max-w-xl rounded-t-2xl border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <DrawerHeader className="relative flex-row items-start gap-3 pb-0 text-left group-data-[swipe-axis=y]/drawer-popup:text-left">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <DrawerTitle className="truncate text-[16px] font-semibold leading-tight text-fg">{title}</DrawerTitle>
              {activeCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="h-5 shrink-0 rounded-full px-1.5 text-[11px] tabular-nums text-accent"
                >
                  {activeCount}
                </Badge>
              ) : null}
            </div>
            <DrawerDescription className="mt-0.5 truncate text-xs text-dim">{description}</DrawerDescription>
          </div>
          <DrawerClose
            aria-label="Close"
            className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-dim active:bg-raised hover:text-fg"
          >
            <IconClose className="size-5" />
          </DrawerClose>
        </DrawerHeader>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-5 px-4 pb-5 pt-3">{children}</div>
        </div>
        <Separator className="shrink-0 bg-line/70" />
        <DrawerFooter className="p-4">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onReset}
              disabled={activeCount === 0}
              className="h-11 flex-1 rounded-xl text-dim"
            >
              {resetLabel}
            </Button>
            <DrawerClose
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-11 flex-1 rounded-xl bg-fg text-black hover:bg-fg/90",
              )}
            >
              Done
            </DrawerClose>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** A fieldset + legend keeps each filter group named for screen readers. */
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label" className="mb-0 text-[11px] font-medium uppercase tracking-wider text-faint">
        {title}
      </FieldLegend>
      {children}
    </FieldSet>
  );
}

/**
 * Segmented shadcn ToggleGroup: one connected row, selected segment in the
 * app's `bg-fg` / black treatment. Base UI emits an empty array when the active
 * segment is tapped again; `clearValue` turns that into a real toggle-off.
 */
export function FilterToggle<T extends string>({
  label,
  value,
  options,
  clearValue,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly FilterOption<T>[];
  /** Emitted when the active segment is tapped again (e.g. "" or "all"). */
  clearValue?: T;
  onChange: (value: T) => void;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0];
        if (picked) onChange(picked as T);
        else if (clearValue !== undefined) onChange(clearValue);
      }}
      spacing={0}
      className="flex w-full rounded-xl bg-raised p-0.5"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="h-10 min-w-0 flex-1 rounded-[10px] px-1.5 text-[13px] text-dim aria-pressed:bg-fg aria-pressed:font-medium aria-pressed:text-black aria-pressed:hover:bg-fg aria-pressed:hover:text-black"
        >
          <span className="truncate">{option.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Every focus or tap starts a fresh search: wipe the label, keep the selection. */
function clearInputOnFocus(event: { currentTarget: HTMLInputElement }) {
  const el = event.currentTarget;
  if (!el.value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, "");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Single-value shadcn Combobox (the docs' "custom items" pattern): object
 * values carry both the stored id and the displayed label. Tapping the field
 * wipes the label so typing starts fresh; the selection itself stays put.
 */
export function FilterCombobox({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly FilterOption<string>[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={options}
      value={selected}
      itemToStringValue={(option: FilterOption<string>) => option.label}
      onValueChange={(next) => {
        if (next && typeof next === "object" && "value" in next) {
          onChange((next as FilterOption<string>).value);
        }
      }}
    >
      <ComboboxInput
        aria-label={label}
        onFocus={clearInputOnFocus}
        onClick={clearInputOnFocus}
        placeholder={options[0]?.label ?? label}
        className="h-11 w-full rounded-xl border-0 bg-raised px-1 has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-accent/60 [&_[data-slot=input-group-control]]:h-11 [&_[data-slot=input-group-control]]:px-2 [&_[data-slot=input-group-control]]:pr-9 [&_[data-slot=input-group-control]]:text-[16px] [&_[data-slot=input-group-control]]:text-fg [&_[data-slot=input-group-control]]:placeholder:text-dim"
      />
      <ComboboxContent className="rounded-xl border-line bg-raised text-fg shadow-xl">
        <ComboboxEmpty className="px-3 py-2 text-[13px] text-dim">No matches</ComboboxEmpty>
        <ComboboxList className="max-h-[min(50dvh,20rem)]">
          {(option: FilterOption<string>) => (
            <ComboboxItem
              key={option.value}
              value={option}
              className="py-2.5 pr-8 pl-3 text-[15px] data-highlighted:bg-surface data-highlighted:text-fg focus:bg-surface focus:text-fg"
            >
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

const MIN_YEAR = 1990;
const MAX_YEAR = new Date().getFullYear() + 1;

/**
 * Release-year range as shadcn's documented two-thumb Slider. The endpoints
 * mean "no filter", so the parent keeps empty strings for an open-ended range.
 */
export function FilterYearRange({
  from,
  to,
  disabled,
  onChange,
}: {
  from: string;
  to: string;
  disabled?: boolean;
  onChange: (years: { from: string; to: string }) => void;
}) {
  const value: [number, number] = [from ? Number(from) : MIN_YEAR, to ? Number(to) : MAX_YEAR];
  const label = !from && !to ? "Any year" : `${from || MIN_YEAR} – ${to || MAX_YEAR}`;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] tabular-nums text-dim">{label}</p>
      <Slider
        aria-label="Release years"
        disabled={disabled}
        value={value}
        min={MIN_YEAR}
        max={MAX_YEAR}
        step={1}
        onValueChange={(next) => {
          const [lower, upper] = next as [number, number];
          onChange({
            from: lower > MIN_YEAR ? String(lower) : "",
            to: upper < MAX_YEAR ? String(upper) : "",
          });
        }}
        className="px-1 [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:bg-fg [&_[data-slot=slider-thumb]]:after:-inset-3"
      />
    </div>
  );
}
