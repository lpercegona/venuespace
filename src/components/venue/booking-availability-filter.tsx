import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedToggle } from "@/components/venue/segmented-toggle";

export type BookingRange = { mode: "single" | "range"; from: string; to: string };

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Filtro de disponibilidade: data única (padrão) ou intervalo. */
export function BookingAvailabilityFilter({
  value,
  onChange,
  onClear,
}: {
  value: BookingRange;
  onChange: (next: BookingRange) => void;
  onClear: () => void;
}) {
  const [localMode, setLocalMode] = useState(value.mode);

  return (
    <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Visualização</Label>
        <SegmentedToggle
          ariaLabel="Modo do filtro de data"
          value={localMode}
          onValueChange={(v) => {
            const mode = v as "single" | "range";
            setLocalMode(mode);
            onChange({ ...value, mode, to: mode === "single" ? value.from : value.to });
          }}
          options={[
            { value: "single", label: "Data" },
            { value: "range", label: "Período" },
          ]}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="bk-from" className="text-xs text-muted-foreground">
          {localMode === "single" ? "Data" : "Início"}
        </Label>
        <Input
          id="bk-from"
          type="date"
          className="h-11 sm:h-10"
          value={value.from}
          onChange={(e) =>
            onChange({
              ...value,
              from: e.target.value,
              to: localMode === "single" ? e.target.value : value.to,
            })
          }
        />
      </div>

      {localMode === "range" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="bk-to" className="text-xs text-muted-foreground">Fim</Label>
          <Input
            id="bk-to"
            type="date"
            className="h-11 sm:h-10"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      ) : null}

      <Button type="button" variant="ghost" className="h-11 sm:h-10" onClick={onClear}>
        Limpar filtro
      </Button>
    </div>
  );
}
