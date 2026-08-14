import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ALLOW_ALL,
  DENY_ALL,
  OPEN_PREFERENCES_EVENT,
  applyConsentToGtm,
  readConsent,
  writeConsent,
  type ConsentCategories,
} from "@/lib/cookie-consent";

export function CookieConsent() {
  const [ready, setReady] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentCategories>(DENY_ALL);

  useEffect(() => {
    const saved = readConsent();
    if (saved) {
      setDraft(saved.categories);
      applyConsentToGtm(saved.categories);
    } else {
      setBannerOpen(true);
    }
    setReady(true);

    const onOpen = () => {
      setDraft(readConsent()?.categories ?? DENY_ALL);
      setPrefsOpen(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, onOpen);
  }, []);

  function save(categories: ConsentCategories) {
    writeConsent(categories);
    setDraft(categories);
    setBannerOpen(false);
    setPrefsOpen(false);
  }

  if (!ready) return null;

  return (
    <>
      {bannerOpen ? (
        <div
          role="region"
          aria-label="Aviso de cookies"
          className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-6 sm:pb-6"
        >
          <div className="mx-auto w-full max-w-4xl rounded-xl border border-border bg-card p-4 text-card-foreground shadow-elegant sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 gap-3">
                <Cookie className="mt-0.5 hidden h-5 w-5 shrink-0 text-brand sm:block" aria-hidden />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Usamos cookies necessários para o funcionamento do site e, mediante seu
                  consentimento, cookies analíticos e de marketing para medir audiência e
                  personalizar comunicação (LGPD, Lei nº 13.709/2018, art. 7º). Você pode
                  aceitar, recusar os não essenciais ou escolher por categoria a qualquer
                  momento. Saiba mais na{" "}
                  <Link to="/politica-de-cookies" className="text-foreground underline underline-offset-2">
                    Política de Cookies
                  </Link>{" "}
                  e na{" "}
                  <Link to="/politica-de-privacidade" className="text-foreground underline underline-offset-2">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto lg:shrink-0">
                <Button
                  variant="ghost"
                  className="h-11 whitespace-nowrap"
                  onClick={() => {
                    setDraft(readConsent()?.categories ?? DENY_ALL);
                    setPrefsOpen(true);
                  }}
                >
                  Preferências
                </Button>
                <Button variant="outline" className="h-11 whitespace-nowrap" onClick={() => save(DENY_ALL)}>
                  Rejeitar não essenciais
                </Button>
                <Button className="h-11 whitespace-nowrap" onClick={() => save(ALLOW_ALL)}>
                  Aceitar todos
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preferências de cookies</DialogTitle>
            <DialogDescription>
              Escolha quais categorias deseja permitir. Sua escolha é registrada neste
              navegador e vale por 12 meses; você pode alterá-la quando quiser pelo rodapé
              do site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <CategoryRow
              id="cat-necessary"
              title="Necessários"
              description="Essenciais para autenticação, segurança, prevenção a fraudes e funcionamento das páginas. Não podem ser desativados. Base legal: legítimo interesse e execução de contrato."
              checked
              disabled
            />
            <CategoryRow
              id="cat-analytics"
              title="Analíticos"
              description="Medem visitas, páginas acessadas e desempenho (Google Tag Manager / Google Analytics), de forma agregada, para melhorarmos a plataforma. Base legal: consentimento."
              checked={draft.analytics}
              onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
            />
            <CategoryRow
              id="cat-marketing"
              title="Marketing"
              description="Permitem mensurar campanhas e exibir comunicação mais relevante em plataformas de anúncios. Base legal: consentimento."
              checked={draft.marketing}
              onChange={(v) => setDraft((d) => ({ ...d, marketing: v }))}
            />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Você pode revogar o consentimento a qualquer momento e exercer seus direitos de
            titular (acesso, correção, eliminação, portabilidade e oposição) pelo e-mail{" "}
            <a href="mailto:contato@venuespace.com.br" className="underline underline-offset-2">
              contato@venuespace.com.br
            </a>
            .
          </p>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" className="h-11" onClick={() => save(DENY_ALL)}>
              Rejeitar não essenciais
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11" onClick={() => save(ALLOW_ALL)}>
                Aceitar todos
              </Button>
              <Button className="h-11" onClick={() => save(draft)}>
                Salvar preferências
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoryRow({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {title}
        </Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange?.(!!v)}
        aria-label={title}
        className="shrink-0"
      />
    </div>
  );
}
