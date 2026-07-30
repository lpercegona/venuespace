import type { ReactNode } from "react";
import { Globe, Mail, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Contact = { phone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null };

function digits(v: string) {
  return v.replace(/\D+/g, "");
}

/**
 * Ações de contato da organização (Iteração 24).
 * `formSlot` recebe o botão do formulário público; os ícones ficam ao lado dele.
 */
export function ContactActions({
  contact,
  orgName,
  formSlot,
}: {
  contact?: Contact | null;
  orgName: string;
  formSlot?: ReactNode;
}) {
  const website = contact?.website?.trim() || "";
  const email = contact?.email?.trim() || "";
  const phone = contact?.phone?.trim() || "";
  const whatsapp = contact?.whatsapp?.trim() || "";
  const hasIcons = Boolean(email || whatsapp || phone);
  if (!website && !hasIcons && !formSlot) return null;

  const href = website && !/^https?:\/\//i.test(website) ? `https://${website}` : website;

  return (
    <div className="space-y-3">
      {href ? (
        <Button asChild size="lg" variant="outline" className="min-h-11 w-full">
          <a href={href} target="_blank" rel="noreferrer noopener">
            <Globe className="h-4 w-4" />
            Acessar o site
          </a>
        </Button>
      ) : null}
      {(formSlot || hasIcons) ? (
        <div className="flex flex-wrap items-center gap-2">
          {formSlot ? <div className="min-w-0 flex-1">{formSlot}</div> : null}
          {whatsapp ? (
            <Button asChild size="icon" variant="outline" className="h-11 w-11 shrink-0">
              <a
                href={`https://wa.me/${digits(whatsapp)}`}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`WhatsApp de ${orgName}`}
              >
                <MessageSquare className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {phone ? (
            <Button asChild size="icon" variant="outline" className="h-11 w-11 shrink-0">
              <a href={`tel:${digits(phone)}`} aria-label={`Telefone de ${orgName}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {email ? (
            <Button asChild size="icon" variant="outline" className="h-11 w-11 shrink-0">
              <a href={`mailto:${email}`} aria-label={`Enviar e-mail para ${orgName}`}>
                <Mail className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
