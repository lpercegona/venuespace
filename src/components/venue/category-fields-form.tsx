import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadField, GalleryField } from "@/components/venue/dynamic-form";

type CascadeField = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  config: Record<string, any> | null;
  order_index: number;
};

type Scope = "org" | "table";

type Props = {
  categoryId: string | null | undefined;
  scope: Scope;
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  title?: string;
};

export function CategoryFieldsForm({ categoryId, scope, value, onChange, title }: Props) {
  const [fields, setFields] = useState<CascadeField[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!categoryId) { setFields([]); setLoaded(true); return; }
    setLoaded(false);
    fetch(`/api/public/category-schema/${categoryId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = scope === "org" ? data.org_fields : data.table_fields;
        setFields((list ?? []) as CascadeField[]);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) { setFields([]); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [categoryId, scope]);

  function set(k: string, v: any) { onChange({ ...value, [k]: v }); }

  if (!categoryId || !loaded || fields.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title ?? "Campos da categoria"}
      </p>
      {fields.filter((f) => f.field_type !== "computed").map((f) => {
        const id = `cat-${scope}-${f.field_key}`;
        const v = value[f.field_key] ?? "";
        if (f.field_type === "boolean") {
          return (
            <div key={f.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor={id} className="text-sm">{f.label}</Label>
              <Switch id={id} checked={!!v} onCheckedChange={(x) => set(f.field_key, x)} />
            </div>
          );
        }
        if (f.field_type === "long_text" || f.field_type === "textarea") {
          return (
            <div key={f.id} className="space-y-2">
              <Label htmlFor={id}>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
              <Textarea id={id} rows={3} required={f.required} value={v} onChange={(e) => set(f.field_key, e.target.value)} />
            </div>
          );
        }
        if (f.field_type === "image" || f.field_type === "file") {
          return (
            <div key={f.id} className="space-y-2">
              <Label>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
              <UploadField value={typeof v === "string" ? v : ""} kind={f.field_type as "image" | "file"} onChange={(x) => set(f.field_key, x)} />
            </div>
          );
        }
        if (f.field_type === "gallery") {
          const arr = Array.isArray(v) ? (v as string[]) : [];
          return (
            <div key={f.id} className="space-y-2">
              <Label>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
              <GalleryField paths={arr} onChange={(x) => set(f.field_key, x)} />
            </div>
          );
        }
        if (f.field_type === "select") {
          const opts: string[] = ((f.config ?? {}).options as string[]) ?? [];
          return (
            <div key={f.id} className="space-y-2">
              <Label>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
              {opts.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem opções configuradas.</p>
              ) : (
                <Select value={typeof v === "string" ? v : ""} onValueChange={(x) => set(f.field_key, x)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        }
        if (f.field_type === "multiselect") {
          const opts: string[] = ((f.config ?? {}).options as string[]) ?? [];
          const arr: string[] = Array.isArray(v) ? (v as string[]) : [];
          return (
            <div key={f.id} className="space-y-2">
              <Label>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
              <div className="flex flex-wrap gap-2">
                {opts.map((o) => {
                  const active = arr.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => set(f.field_key, active ? arr.filter((x) => x !== o) : [...arr, o])}
                      className={`min-h-9 rounded-full border px-3 py-1 text-xs transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}
                      aria-pressed={active}
                    >{o}</button>
                  );
                })}
                {opts.length === 0 ? <span className="text-xs text-muted-foreground">Sem opções configuradas.</span> : null}
              </div>
            </div>
          );
        }
        if (f.field_type === "relation") {
          return (
            <div key={f.id} className="space-y-2">
              <Label htmlFor={id}>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
              <Input id={id} required={f.required} value={typeof v === "string" ? v : ""}
                placeholder="UUID do registro relacionado"
                onChange={(e) => set(f.field_key, e.target.value)} />
            </div>
          );
        }
        const inputType =
          f.field_type === "number" || f.field_type === "currency" ? "number" :
          f.field_type === "date" ? "date" :
          f.field_type === "datetime" ? "datetime-local" :
          f.field_type === "email" ? "email" :
          f.field_type === "url" ? "url" :
          f.field_type === "phone" ? "tel" : "text";
        return (
          <div key={f.id} className="space-y-2">
            <Label htmlFor={id}>{f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
            <Input id={id} type={inputType} required={f.required} value={v ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (f.field_type === "number" || f.field_type === "currency") set(f.field_key, val === "" ? null : Number(val));
                else set(f.field_key, val);
              }} />
          </div>
        );
      })}
    </div>
  );
}
