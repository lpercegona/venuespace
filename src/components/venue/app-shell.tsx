import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, FileHeart, CalendarDays, Users, ChevronDown, Building2, Check, List } from "lucide-react";
import { getOrganizationBySlug, listMyOrganizations } from "@/lib/orgs.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { NotificationsBell } from "./notifications-bell";
import { ChatWidget } from "./chat-widget";

type Props = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

export function AppShell({ title, subtitle, actions, children }: Props) {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { orgSlug?: string };
  const orgSlug = params.orgSlug;
  const org = useQuery({
    queryKey: ["org", orgSlug],
    queryFn: () => getOrganizationBySlug({ data: { slug: orgSlug! } }),
    enabled: !!orgSlug,
  });
  const me = useQuery({ queryKey: ["me-profile"], queryFn: () => getMyProfile() });
  const myOrgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => listMyOrganizations() });

  const initial = (me.data?.display_name ?? me.data?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/app" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary" aria-hidden />
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              Venuespace
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-[200px] gap-1.5">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {org.data?.name ?? (orgSlug ? orgSlug : "Selecionar organização")}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Organizações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(myOrgs.data ?? []).map((o: any) => (
                  <DropdownMenuItem
                    key={o.id}
                    onSelect={() => navigate({ to: "/app/$orgSlug", params: { orgSlug: o.slug } })}
                  >
                    <span className="truncate">{o.name}</span>
                    {o.slug === orgSlug ? <Check className="ml-auto h-4 w-4" /> : null}
                  </DropdownMenuItem>
                ))}
                {(myOrgs.data ?? []).length === 0 ? (
                  <DropdownMenuItem disabled>Nenhuma organização</DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/app" })}>
                  <List className="h-4 w-4" />Ver todas as organizações
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {orgSlug && org.data ? (
              <NotificationsBell organizationId={org.data.id} orgSlug={orgSlug} />
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Menu do perfil"
                  className="rounded-full outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Avatar className="h-9 w-9">
                    {me.data?.avatar_url ? <AvatarImage src={me.data.avatar_url} alt="" /> : null}
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {me.data?.display_name ?? me.data?.email ?? "Perfil"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/me/settings" })}>
                  <Settings className="h-4 w-4" />Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate({ to: "/me/applications" })}>
                  <FileHeart className="h-4 w-4" />Minhas candidaturas
                </DropdownMenuItem>
                {orgSlug ? (
                  <>
                    <DropdownMenuItem onSelect={() => navigate({ to: "/app/$orgSlug/calendar", params: { orgSlug } })}>
                      <CalendarDays className="h-4 w-4" />Calendário
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate({ to: "/app/$orgSlug/members", params: { orgSlug } })}>
                      <Users className="h-4 w-4" />Membros
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async () => {
                    await supabase.auth.signOut();
                    navigate({ to: "/auth" });
                  }}
                >
                  <LogOut className="h-4 w-4" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {(title || actions) && (
          <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              {title ? (
                <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
        )}
        {children}
      </main>
      {orgSlug && org.data ? <ChatWidget organizationId={org.data.id} /> : null}
    </div>
  );
}
