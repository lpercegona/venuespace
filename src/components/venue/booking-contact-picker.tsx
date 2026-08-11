import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DynamicForm } from "@/components/venue/dynamic-form";
import { createBookingContact } from "@/lib/bookings.functions";

export type ContactOption = { id: string; label: string; email: string | null };
export type ContactFieldDef = {
  key: string; label: string; type: string; required: boolean; config: any; position: number;
};

/** Seleção de contato existente ou criação de novo contato com os campos do formulário padrão. */
export function BookingContactPicker({
  organizationId,
  contacts,
  schema,
  value,
  onChange,
  onCreated,
}: {
  organizationId: string;
  contacts: ContactOption[];
  schema: ContactFieldDef[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreated: (c: ContactOption) => void;
}) {
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return contacts.slice(0, 50);
    return contacts
      .filter((c) => `${c.label} ${c.email ?? ""}`.toLowerCase().includes(t))
      .slice(0, 50);
  }, [contacts, term]);

  async function submitNew(values: Record<string, any>) {
    setSaving(true);
    try {
      const created = await createBookingContact({
        data: { organization_id: organizationId, values },
      });
      onCreated(created);
      onChange(created.id);
      setCreating(false);
      toast.success("Contato criado.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 truncate text-sm font-medium">Novo contato</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
            Voltar
          </Button>
        </div>
        {schema.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum campo de contato configurado para esta categoria.
          </p>
        ) : (
          <DynamicForm
            fields={schema.map((f, i) => ({
              id: `contact-${f.key}`,
              key: f.key,
              label: f.label,
              type: f.type,
              required: f.required,
              position: f.position ?? i,
              config: f.config ?? {},
            })) as any}
            submitLabel={saving ? "Salvando..." : "Salvar contato"}
            onSubmit={submitNew}
          />
        )}
      </div>
    );
  }

  const selected = contacts.find((c) => c.id === value) ?? null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 sm:h-10"
            placeholder="Buscar contato por nome ou e-mail"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Buscar contato"
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-11 shrink-0 sm:h-10" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />Novo
        </Button>
      </div>

      {selected ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
          <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm">
            {selected.label}{selected.email ? ` — ${selected.email}` : ""}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Trocar</Button>
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum contato cadastrado ainda.</p>
      ) : (
        <ScrollArea className="max-h-52">
          <ul className="grid gap-1">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onChange(c.id)}
                  className="flex w-full min-h-11 items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left text-sm hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Check className={`h-4 w-4 shrink-0 ${value === c.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0 flex-1 truncate">
                    {c.label}{c.email ? ` — ${c.email}` : ""}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted-foreground">Nenhum contato encontrado.</li>
            ) : null}
          </ul>
        </ScrollArea>
      )}

      {saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}
