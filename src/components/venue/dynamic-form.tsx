import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addFieldOption } from "@/lib/orgs.functions";
import type { FieldRow } from "@/lib/records.functions";
import { useLabels } from "@/hooks/use-instance-context";
import { optimizeImage } from "@/lib/image-optimizer";

type Props = {
  fields: FieldRow[];
  initial?: Record<string, any>;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  disableUploads?: boolean;
  disableOptionEditing?: boolean;
  onFieldsChanged?: () => void;
};

async function signedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data } = await supabase.storage.from("venue-uploads").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

function FilePreview({ path, kind }: { path: string; kind: "image" | "file" }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { signedUrl(path).then(setUrl); }, [path]);
  if (!url) return <span className="text-xs text-muted-foreground">Carregando...</span>;
  if (kind === "image") {
    return <img src={url} alt="" className="h-24 w-24 rounded-md border border-border object-cover" />;
  }
  return <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Abrir arquivo</a>;
}

export function UploadField({
  value, kind, disabled, onChange,
}: { value: string; kind: "image" | "file"; disabled?: boolean; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    setBusy(true);
    try {
      const file = kind === "image" ? await optimizeImage(original) : original;
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? "anon";
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${uid}/${kind}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("venue-uploads").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      onChange(path);
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); e.target.value = ""; }
  }
  if (disabled) {
    return (
      <Input value={value ?? ""} onChange={(ev) => onChange(ev.target.value)} placeholder={kind === "image" ? "URL da imagem" : "URL do arquivo"} />
    );
  }
  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3">
          <FilePreview path={value} kind={kind} />
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <X className="h-4 w-4" />Remover
          </Button>
        </div>
      ) : null}
      <label className="inline-flex">
        <input type="file" accept={kind === "image" ? "image/*" : undefined} className="hidden" onChange={onFile} />
        <Button type="button" variant="outline" size="sm" disabled={busy} asChild>
          <span><Upload className="h-4 w-4" />{busy ? "Enviando..." : value ? "Substituir" : `Enviar ${kind === "image" ? "imagem" : "arquivo"}`}</span>
        </Button>
      </label>
    </div>
  );
}

export function GalleryField({
  paths, disabled, onChange,
}: { paths: string[]; disabled?: boolean; onChange: (next: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? "anon";
      const uploaded: string[] = [];
      for (const original of files) {
        const file = await optimizeImage(original);
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${uid}/gallery/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${safe}`;
        const { error } = await supabase.storage.from("venue-uploads").upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw error;
        uploaded.push(path);
      }
      onChange([...paths, ...uploaded]);
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); e.target.value = ""; }
  }
  if (disabled) {
    return <p className="text-xs text-muted-foreground">Upload desabilitado.</p>;
  }
  return (
    <div className="space-y-2">
      {paths.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {paths.map((p, i) => (
            <div key={p + i} className="relative">
              <FilePreview path={p} kind="image" />
              <Button type="button" variant="secondary" size="icon" className="absolute -right-1 -top-1 h-6 w-6"
                onClick={() => onChange(paths.filter((_, idx) => idx !== i))}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <label className="inline-flex">
        <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
        <Button type="button" variant="outline" size="sm" disabled={busy} asChild>
          <span><Upload className="h-4 w-4" />{busy ? "Enviando..." : "Adicionar imagens"}</span>
        </Button>
      </label>
    </div>
  );
}

function OptionInliner({
  fieldId, current, disabled, onAdded,
}: { fieldId: string; current: string[]; disabled?: boolean; onAdded: (opts: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  if (disabled) return null;
  if (!adding) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(true)}>
        <Plus className="h-3 w-3" />Adicionar opção
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Nova opção" className="h-8 w-40" />
      <Button
        type="button" size="sm" disabled={busy || !val.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await addFieldOption({ data: { field_id: fieldId, option: val.trim() } });
            onAdded(res.options);
            setVal(""); setAdding(false);
          } catch (err) { toast.error((err as Error).message); }
          finally { setBusy(false); }
        }}
      >OK</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setVal(""); }}>Cancelar</Button>
    </div>
  );
}

export function DynamicForm({
  fields, initial = {}, submitLabel = "Salvar", onCancel, onSubmit,
  disableUploads, disableOptionEditing, onFieldsChanged,
}: Props) {
  const { t } = useLabels();
  const recordLabel = t("record", "registro").toLowerCase();
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [saving, setSaving] = useState(false);
  const [localOptions, setLocalOptions] = useState<Record<string, string[]>>({});

  function set(key: string, v: any) { setValues((prev) => ({ ...prev, [key]: v })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(values); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields
        .filter((f) => f.type !== "computed")
        .map((f) => {
          const id = `df-${f.key}`;
          const v = values[f.key] ?? "";
          const labelEl = (
            <Label htmlFor={id}>
              {f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}
            </Label>
          );

          if (f.type === "long_text") {
            return (
              <div key={f.id} className="space-y-2">
                {labelEl}
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
            const cfgOpts: string[] = ((f.config ?? {}).options as string[]) ?? [];
            const options = localOptions[f.id] ?? cfgOpts;
            return (
              <div key={f.id} className="space-y-2">
                {labelEl}
                <Select value={typeof v === "string" ? v : ""} onValueChange={(x) => set(f.key, x)}>
                  <SelectTrigger id={id}><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
                <OptionInliner
                  fieldId={f.id} current={options} disabled={disableOptionEditing}
                  onAdded={(opts) => { setLocalOptions((s) => ({ ...s, [f.id]: opts })); onFieldsChanged?.(); }}
                />
              </div>
            );
          }
          if (f.type === "multiselect") {
            const cfgOpts: string[] = ((f.config ?? {}).options as string[]) ?? [];
            const options = localOptions[f.id] ?? cfgOpts;
            const arr: string[] = Array.isArray(v) ? v : [];
            return (
              <div key={f.id} className="space-y-2">
                {labelEl}
                <div className="flex flex-wrap gap-2">
                  {options.map((o) => {
                    const active = arr.includes(o);
                    return (
                      <button
                        key={o} type="button"
                        onClick={() => set(f.key, active ? arr.filter((x) => x !== o) : [...arr, o])}
                        className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}
                      >{o}</button>
                    );
                  })}
                  {options.length === 0 ? <span className="text-xs text-muted-foreground">Sem opções.</span> : null}
                </div>
                <OptionInliner
                  fieldId={f.id} current={options} disabled={disableOptionEditing}
                  onAdded={(opts) => { setLocalOptions((s) => ({ ...s, [f.id]: opts })); onFieldsChanged?.(); }}
                />
                {arr.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {arr.map((x) => <Badge key={x} variant="secondary">{x}</Badge>)}
                  </div>
                ) : null}
              </div>
            );
          }
          if (f.type === "number" || f.type === "currency") {
            return (
              <div key={f.id} className="space-y-2">
                {labelEl}
                <Input id={id} type="number" step="any" required={f.required} value={v}
                  onChange={(e) => set(f.key, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            );
          }
          if (f.type === "date") {
            return (
              <div key={f.id} className="space-y-2">
                {labelEl}
                <Input id={id} type="date" required={f.required} value={v ?? ""} onChange={(e) => set(f.key, e.target.value || null)} />
              </div>
            );
          }
          if (f.type === "datetime") {
            return (
              <div key={f.id} className="space-y-2">
                {labelEl}
                <Input id={id} type="datetime-local" required={f.required} value={v ?? ""} onChange={(e) => set(f.key, e.target.value || null)} />
              </div>
            );
          }
          if (f.type === "image" || f.type === "file") {
            return (
              <div key={f.id} className="space-y-2">
                {labelEl}
                <UploadField
                  kind={f.type} disabled={disableUploads}
                  value={typeof v === "string" ? v : ""}
                  onChange={(p) => set(f.key, p)}
                />
              </div>
            );
          }
          if (f.type === "gallery") {
            const arr: string[] = Array.isArray(v) ? v : [];
            return (
              <div key={f.id} className="space-y-2">
                {labelEl}
                <GalleryField paths={arr} disabled={disableUploads} onChange={(next) => set(f.key, next)} />
              </div>
            );
          }
          const cfgRole = ((f.config ?? {}) as any).role as string | undefined;
          if (f.type === "text" && cfgRole === "cep") {
            const targets = ((f.config ?? {}) as any).cep_targets as Record<string, string> | undefined;
            return (
              <div key={f.id} className="space-y-2">
                {labelEl}
                <Input id={id} type="text" required={f.required} value={v ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  onBlur={async (e) => {
                    const cep = e.target.value.replace(/\D/g, "");
                    if (cep.length !== 8) return;
                    try {
                      const r = await fetch(`/api/public/viacep/${cep}`);
                      if (!r.ok) return;
                      const body = await r.json();
                      setValues((prev) => {
                        const next = { ...prev };
                        const map = targets ?? { logradouro: "logradouro", bairro: "bairro", localidade: "cidade", uf: "estado" };
                        for (const [via, target] of Object.entries(map)) {
                          if (body[via]) next[target] = body[via];
                        }
                        return next;
                      });
                      toast.success("Endereço preenchido pelo CEP");
                    } catch {}
                  }}
                />
              </div>
            );
          }
          const inputType =
            f.type === "email" ? "email" : f.type === "url" ? "url" : f.type === "phone" ? "tel" : "text";
          return (
            <div key={f.id} className="space-y-2">
              {labelEl}
              <Input id={id} type={inputType} required={f.required} value={v ?? ""}
                placeholder={f.type === "relation" ? `UUID do ${recordLabel} relacionado` : undefined}
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
