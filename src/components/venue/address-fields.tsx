import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export type AddressValue = {
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

type Props = {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  title?: string;
};

/**
 * Padrão de endereço para organizações. CEP dispara autocomplete via
 * proxy server-side /api/public/viacep/{cep}.
 */
export function AddressFields({ value, onChange, title = "Endereço" }: Props) {
  const [loadingCep, setLoadingCep] = useState(false);

  function set<K extends keyof AddressValue>(k: K, v: AddressValue[K]) {
    onChange({ ...value, [k]: v });
  }

  async function handleCepBlur() {
    const digits = String(value.cep ?? "").replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoadingCep(true);
    try {
      const r = await fetch(`/api/public/viacep/${digits}`);
      if (!r.ok) return;
      const b = await r.json();
      onChange({
        ...value,
        cep: digits,
        street: b.logradouro ?? value.street ?? "",
        neighborhood: b.bairro ?? value.neighborhood ?? "",
        city: b.localidade ?? value.city ?? "",
        state: b.uf ?? value.state ?? "",
      });
    } catch {
      // silencioso
    } finally {
      setLoadingCep(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="addr-cep" className="flex items-center gap-2">
            CEP {loadingCep ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
          </Label>
          <Input
            id="addr-cep"
            inputMode="numeric"
            placeholder="00000-000"
            value={value.cep ?? ""}
            onChange={(e) => set("cep", e.target.value)}
            onBlur={handleCepBlur}
          />
        </div>
        <div className="space-y-2 sm:col-span-4">
          <Label htmlFor="addr-street">Logradouro</Label>
          <Input id="addr-street" value={value.street ?? ""} onChange={(e) => set("street", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="addr-number">Número</Label>
          <Input id="addr-number" value={value.number ?? ""} onChange={(e) => set("number", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-4">
          <Label htmlFor="addr-complement">Complemento</Label>
          <Input id="addr-complement" value={value.complement ?? ""} onChange={(e) => set("complement", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="addr-neigh">Bairro</Label>
          <Input id="addr-neigh" value={value.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="addr-city">Cidade</Label>
          <Input id="addr-city" value={value.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="addr-state">UF</Label>
          <Input id="addr-state" maxLength={2} value={value.state ?? ""} onChange={(e) => set("state", e.target.value.toUpperCase())} />
        </div>
      </div>
    </div>
  );
}
