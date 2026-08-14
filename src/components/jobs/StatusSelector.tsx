import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JOB_STATUSES, type JobStatus } from "@/types/job";

interface StatusSelectorProps {
  value: JobStatus;
  onChange: (status: JobStatus) => void;
  size?: "sm" | "md";
}

export function StatusSelector({ value, onChange, size = "sm" }: StatusSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as JobStatus)}>
      <SelectTrigger
        className={size === "sm" ? "h-8 w-[130px] text-xs" : "h-9 w-[160px] text-sm"}
        aria-label="Job status"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {JOB_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-sm">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}