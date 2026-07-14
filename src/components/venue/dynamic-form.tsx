import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { FieldRow } from "@/lib/records.functions";

type Props = {
  fields: FieldRow[];
  initial?: Record<string, any>;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
};

export function DynamicForm({ fields, initial = {}, submitLabel = "Salvar", onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [saving, setSaving] = useState(false);

  function set(key: string, v: any) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields
        .filter((f) => f.type !== "computed")
        .map((f) => {
          const id = `df-${f.key}`;
          const v = values[f.key] ?? "";
          const commonLabel = (
            <Label htmlFor={id}>
              {f.label}
              {f.required ? <span className="ml-1 text-destructive">*</span> : null}
            </Label>
          );
          if (f.type === "long_text") {
            return (
              <div key={f.id} className="space-y-2">
                {commonLabel}
                <Textarea id={id} rows={3} required={f.required} value={v} onChange={(e) => set(f.key, e.target.value)} />
              </div>
            );
          }
          if (f.type === "boolean") {
            return (
              <div key={f.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <Label htmlFor={id} className="text-sm">{f.label}</Label>
                <Switch id={id} checked={!!v} onCheckedChange={(x) => set(f.key, x)} />
              </div>
            );
          }
          if (f.type === "select") {
            const options: string[] = ((f.config ?? {}).options as string[]) ?? [];
            return (
              <div key={f.id} className="space-y-2">
                {commonLabel}
                <Select value={typeof v === "string" ? v : ""} onValueChange={(x) => set(f.key, x)}>
                  <SelectTrigger id={id}><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
          }
          if (f.type === "number" || f.type === "currency") {
            return (
              <div key={f.id} className="space-y-2">
                {commonLabel}
                <Input id={id} type="number" step="any" required={f.required} value={v}
                  onChange={(e) => set(f.key, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            );
          }
          if (f.type === "date") {
            return (
              <div key={f.id} className="space-y-2">
                {commonLabel}
                <Input id={id} type="date" required={f.required} value={v ?? ""} onChange={(e) => set(f.key, e.target.value || null)} />
              </div>
            );
          }
          if (f.type === "datetime") {
            return (
              <div key={f.id} className="space-y-2">
                {commonLabel}
                <Input id={id} type="datetime-local" required={f.required} value={v ?? ""} onChange={(e) => set(f.key, e.target.value || null)} />
              </div>
            );
          }
          // text/email/phone/url/image/file/relation (uuid) as plain input
          const inputType =
            f.type === "email" ? "email" : f.type === "url" ? "url" : f.type === "phone" ? "tel" : "text";
          return (
            <div key={f.id} className="space-y-2">
              {commonLabel}
              <Input id={id} type={inputType} required={f.required} value={v ?? ""}
                placeholder={f.type === "relation" ? "UUID do registro relacionado" : undefined}
                onChange={(e) => set(f.key, e.target.value)} />
            </div>
          );
        })}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel ? <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button> : null}
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </div>
    </form>
  );
}
