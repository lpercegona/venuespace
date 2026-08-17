import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MODULE_REGISTRY } from "@/lib/module-registry";
import { listPlatformModules } from "@/lib/modules.functions";
import { Button } from "@/components/ui/button";
import { ModuleBookingsConfig } from "@/components/admin/module-bookings-config";

/** Visão geral dos módulos da plataforma (base para novos módulos). */
export function ModulesSection() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["platform-modules"],
    queryFn: () => listPlatformModules(),
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (openKey) {
    const def = MODULE_REGISTRY.find((d) => d.key === openKey);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setOpenKey(null)} className="shrink-0">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Módulos
          </Button>
          <h3 className="min-w-0 truncate text-sm font-medium">{def?.name ?? openKey}</h3>
        </div>
        {openKey === "bookings" ? (
          <ModuleBookingsConfig />
        ) : (
          <p className="text-sm text-muted-foreground">Este módulo ainda não possui configuração.</p>
        )}
      </div>
    );
  }

  const rows = (q.data ?? []) as Array<{ key: string; name: string; description: string | null; is_active: boolean }>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Módulos são funções adicionais que podem ser ativadas por categoria. Cada módulo tem sua
        própria área de configuração no menu lateral.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((m) => {
          const def = MODULE_REGISTRY.find((d) => d.key === m.key);
          return (
            <Card
              key={m.key}
              role="button"
              tabIndex={0}
              onClick={() => setOpenKey(m.key)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenKey(m.key); } }}
              className="cursor-pointer transition hover:border-primary focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <CardTitle className="min-w-0 truncate text-base">{m.name}</CardTitle>
                <Badge variant={m.is_active ? "secondary" : "outline"} className="shrink-0">
                  {m.is_active ? "disponível" : "inativo"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{m.description ?? def?.description}</p>
                {def ? (
                  <div className="flex flex-wrap gap-2">
                    {def.features.includes("form") ? <Badge variant="outline">Formulário</Badge> : null}
                    {def.features.includes("pdf") ? <Badge variant="outline">Layout de PDF</Badge> : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
