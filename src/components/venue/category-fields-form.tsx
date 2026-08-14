import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadField, GalleryField } from "@/components/venue/dynamic-form";
import { FieldLabel } from "@/components/venue/field-label";

type CascadeField = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  config: Record<string, any> | null;
  order_index: number;
  group_id?: string | null;
};

type FieldGroup = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  order_index: number;
};

type Scope = "org" | "table";

type Props = {
  categoryId: string | null | undefined;
  scope: Scope;
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  title?: string;
  /** Valores de system_data — usados por campos com config.system_key. */
  systemValue?: Record<string, any>;
  onSystemChange?: (v: Record<string, any>) => void;
};

function readSystem(sys: Record<string, any>, path: string) {
  return path.split(".").reduce<any>((acc, part) => (acc == null ? undefined : acc[part]), sys);
}

function writeSystem(sys: Record<string, any>, path: string, v: any): Record<string, any> {
  const parts = path.split(".");
  const next = { ...sys };
  let cur: any = next;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = { ...(cur[parts[i]] ?? {}) };
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = v;
  return next;
}

export function CategoryFieldsForm({
  categoryId, scope, value, onChange, title, systemValue, onSystemChange,
}: Props) {
  const [fields, setFields] = useState<CascadeField[]>([]);
  const [groups, setGroups] = useState<FieldGroup[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!categoryId) { setFields([]); setGroups([]); setLoaded(true); return; }
    setLoaded(false);
    fetch(`/api/public/category-schema/${categoryId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = scope === "org" ? data.org_fields : data.table_fields;
        setFields((list ?? []) as CascadeField[]);
        setGroups(((data.groups?.[scope] ?? []) as FieldGroup[]));
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) { setFields([]); setGroups([]); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [categoryId, scope]);

  function set(f: CascadeField, v: any) {
    const systemKey = (f.config ?? {}).system_key as string | undefined;
    if (systemKey && onSystemChange) onSystemChange(writeSystem(systemValue ?? {}, systemKey, v));
    else onChange({ ...value, [f.field_key]: v });
  }

  function get(f: CascadeField) {
    const systemKey = (f.config ?? {}).system_key as string | undefined;
    if (systemKey) return readSystem(systemValue ?? {}, systemKey) ?? "";
    return value[f.field_key] ?? "";
  }

  if (!categoryId || !loaded || fields.length === 0) return null;

  const visible = fields.filter((f) => f.field_type !== "computed");
  const grouped = groups
    .map((g) => ({ group: g, items: visible.filter((f) => f.group_id === g.id) }))
    .filter((g) => g.items.length > 0);
  const ungrouped = visible.filter((f) => !f.group_id || !groups.some((g) => g.id === f.group_id));

  return (
    <div className="space-y-4">
      {grouped.map(({ group, items }) => (
        <div key={group.id} className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p>
            {group.description ? (
              <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
            ) : null}
          </div>
          {items.map((f) => renderField(f))}
        </div>
      ))}
      {ungrouped.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title ?? "Campos da categoria"}
          </p>
          {ungrouped.map((f) => renderField(f))}
        </div>
      ) : null}
    </div>
  );

  function renderField(f: CascadeField) {
    const id = `cat-${scope}-${f.field_key}`;
    const cfg = f.config ?? {};
    const tip = typeof cfg.tooltip === "string" ? cfg.tooltip : null;
    const v = get(f);

    if (f.field_type === "boolean") {
      return (
        <div key={f.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
          <FieldLabel htmlFor={id} tooltip={tip}>{f.label}</FieldLabel>
          <Switch id={id} checked={!!v} onCheckedChange={(x) => set(f, x)} />
        </div>
      );
    }
    if (f.field_type === "long_text" || f.field_type === "textarea") {
      return (
        <div key={f.id} className="space-y-2">
          <FieldLabel htmlFor={id} required={f.required} tooltip={tip}>{f.label}</FieldLabel>
          <Textarea id={id} rows={3} required={f.required} value={v} onChange={(e) => set(f, e.target.value)} />
        </div>
      );
    }
    if (f.field_type === "image" || f.field_type === "file") {
      return (
        <div key={f.id} className="space-y-2">
          <FieldLabel required={f.required} tooltip={tip}>{f.label}</FieldLabel>
          <UploadField value={typeof v === "string" ? v : ""} kind={f.field_type as "image" | "file"} onChange={(x) => set(f, x)} />
        </div>
      );
    }
    if (f.field_type === "gallery") {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      return (
        <div key={f.id} className="space-y-2">
          <FieldLabel required={f.required} tooltip={tip}>{f.label}</FieldLabel>
          <GalleryField paths={arr} onChange={(x) => set(f, x)} />
        </div>
      );
    }
    if (f.field_type === "select") {
      const opts: string[] = (cfg.options as string[]) ?? [];
      return (
        <div key={f.id} className="space-y-2">
          <FieldLabel required={f.required} tooltip={tip}>{f.label}</FieldLabel>
          {opts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem opções configuradas.</p>
          ) : (
            <Select value={typeof v === "string" ? v : ""} onValueChange={(x) => set(f, x)}>
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
      const opts: string[] = (cfg.options as string[]) ?? [];
      const arr: string[] = Array.isArray(v) ? (v as string[]) : [];
      return (
        <div key={f.id} className="space-y-2">
          <FieldLabel required={f.required} tooltip={tip}>{f.label}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => {
              const active = arr.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => set(f, active ? arr.filter((x) => x !== o) : [...arr, o])}
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
          <FieldLabel htmlFor={id} required={f.required} tooltip={tip}>{f.label}</FieldLabel>
          <Input id={id} required={f.required} value={typeof v === "string" ? v : ""}
            placeholder="UUID do registro relacionado"
            onChange={(e) => set(f, e.target.value)} />
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
        <FieldLabel htmlFor={id} required={f.required} tooltip={tip}>{f.label}</FieldLabel>
        <Input id={id} type={inputType} required={f.required}
          placeholder={typeof cfg.placeholder === "string" ? cfg.placeholder : undefined}
          value={v ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            if (f.field_type === "number" || f.field_type === "currency") set(f, val === "" ? null : Number(val));
            else set(f, val);
          }} />
      </div>
    );
  }
}

// Mantém a importação de Label usada por consumidores legados do módulo.
export { Label };
