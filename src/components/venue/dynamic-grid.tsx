import { useIsMobile } from "@/hooks/use-mobile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import type { FieldRow } from "@/lib/records.functions";

export type RecordRow = {
  id: string;
  data: Record<string, any>;
  status: string;
  deal_status: string;
  agreed_value: number | null;
  contribution_status: string | null;
  created_at: string;
  updated_at: string;
};

type RelationMap = Record<string, Record<string, { id: string; label: string }>>;

type Props = {
  fields: FieldRow[];
  records: RecordRow[];
  relations: RelationMap;
  canEdit: boolean;
  onEdit: (r: RecordRow) => void;
  onDelete: (r: RecordRow) => void;
  onTogglePublish: (r: RecordRow) => void;
};

function formatValue(field: FieldRow, value: any, relations: RelationMap): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "currency" || (field.type === "computed" && ((field.config ?? {}).kind !== "count"))) {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (field.type === "number" || field.type === "computed") {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("pt-BR");
  }
  if (field.type === "boolean") return value ? "Sim" : "Não";
  if (field.type === "date") return new Date(value).toLocaleDateString("pt-BR");
  if (field.type === "datetime") return new Date(value).toLocaleString("pt-BR");
  if (field.type === "multiselect" && Array.isArray(value)) return value.join(", ");
  if (field.type === "relation") {
    const map = relations[field.id] ?? {};
    if (Array.isArray(value)) return value.map((id) => map[id]?.label ?? id).join(", ");
    return map[value]?.label ?? String(value);
  }
  return String(value);
}

function RowActions({
  r, canEdit, onEdit, onDelete, onTogglePublish,
}: Pick<Props, "canEdit" | "onEdit" | "onDelete" | "onTogglePublish"> & { r: RecordRow }) {
  if (!canEdit) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Ações"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(r)}><Pencil className="h-4 w-4" />Editar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onTogglePublish(r)}>
          {r.status === "published" ? <><EyeOff className="h-4 w-4" />Despublicar</> : <><Eye className="h-4 w-4" />Publicar</>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(r)} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" />Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "published" ? "default" : "secondary"} className="shrink-0">
      {status === "published" ? "publicado" : status === "archived" ? "arquivado" : "rascunho"}
    </Badge>
  );
}

export function DynamicGrid({ fields, records, relations, canEdit, onEdit, onDelete, onTogglePublish }: Props) {
  const isMobile = useIsMobile();
  const visible = fields.filter((f) => f.type !== "relation" || (f.config ?? {}).target_table_id).sort((a, b) => a.position - b.position);

  if (isMobile) {
    return (
      <div className="grid gap-3">
        {records.map((r) => {
          const primary = visible[0];
          return (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold">
                      {primary ? formatValue(primary, r.data?.[primary.key], relations) : r.id.slice(0, 8)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                  <RowActions r={r} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} onTogglePublish={onTogglePublish} />
                </div>
                <dl className="grid gap-2 text-sm">
                  {visible.slice(1).map((f) => (
                    <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3">
                      <dt className="truncate text-muted-foreground">{f.label}</dt>
                      <dd className="truncate text-foreground">{formatValue(f, r.data?.[f.key], relations)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                {visible.map((f) => (
                  <TableHead key={f.id} className="whitespace-nowrap">{f.label}</TableHead>
                ))}
                <TableHead className="w-24 whitespace-nowrap">Status</TableHead>
                {canEdit ? <TableHead className="w-12" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  {visible.map((f) => (
                    <TableCell key={f.id} className="max-w-[280px] truncate">{formatValue(f, r.data?.[f.key], relations)}</TableCell>
                  ))}
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  {canEdit ? (
                    <TableCell className="text-right">
                      <RowActions r={r} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} onTogglePublish={onTogglePublish} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
