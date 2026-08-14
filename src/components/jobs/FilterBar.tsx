import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTRACT_TYPES,
  COUNTRIES,
  ROLE_CATEGORIES,
  WORK_MODELS,
  type JobFilters,
} from "@/types/job";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  filters,
  onChange,
  query,
  onQueryChange,
  resultCount,
}: FilterBarProps) {
  const activeCount =
    filters.roles.length +
    filters.countries.length +
    filters.contract_types.length +
    filters.work_models.length +
    (filters.min_match_score > 0 ? 1 : 0) +
    (filters.max_age_days !== 15 ? 1 : 0);

  const reset = () =>
    onChange({
      roles: [],
      countries: [],
      contract_types: [],
      work_models: [],
      max_age_days: 15,
      min_match_score: 0,
    });

  return (
    <section className="bg-card border-border rounded-lg border p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Filters</h2>
          {activeCount > 0 && <Badge variant="secondary">{activeCount} active</Badge>}
          <span className="text-muted-foreground text-xs">{resultCount} jobs shown</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search title, company, city…"
            className="h-8 w-56 text-sm"
          />
          <Button variant="ghost" size="sm" onClick={reset} disabled={activeCount === 0}>
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-4 border-t pt-3 lg:grid-cols-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Role</Label>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_CATEGORIES.map((r) => (
              <Chip
                key={r}
                active={filters.roles.includes(r)}
                onClick={() => onChange({ ...filters, roles: toggle(filters.roles, r) })}
              >
                {r}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Country</Label>
          <div className="flex flex-wrap gap-1.5">
            {COUNTRIES.map((c) => (
              <Chip
                key={c}
                active={filters.countries.includes(c)}
                onClick={() => onChange({ ...filters, countries: toggle(filters.countries, c) })}
              >
                {c}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Contract type
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {CONTRACT_TYPES.map((c) => (
              <Chip
                key={c}
                active={filters.contract_types.includes(c)}
                onClick={() =>
                  onChange({ ...filters, contract_types: toggle(filters.contract_types, c) })
                }
              >
                {c}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Work model
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {WORK_MODELS.map((w) => (
                <Chip
                  key={w}
                  active={filters.work_models.includes(w)}
                  onClick={() =>
                    onChange({ ...filters, work_models: toggle(filters.work_models, w) })
                  }
                >
                  {w}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Date posted
              </Label>
              <Select
                value={String(filters.max_age_days)}
                onValueChange={(v) => onChange({ ...filters, max_age_days: Number(v) })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="3">Last 3 days</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="15">Last 15 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Min score: {filters.min_match_score}
              </Label>
              <Slider
                value={[filters.min_match_score]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => onChange({ ...filters, min_match_score: v ?? 0 })}
                className="pt-2"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}