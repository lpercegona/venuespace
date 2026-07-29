import { Globe, Mail, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Contact = { phone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null };

function digits(v: string) {
  return v.replace(/\D+/g, "");
}

/** Ações de contato da organização (Iteração 24). */
export function ContactActions({ contact, orgName }: { contact?: Contact | null; orgName: string }) {
  const website = contact?.website?.trim() || "";
  const email = contact?.email?.trim() || "";
  const phone = contact?.phone?.trim() || "";
  const whatsapp = contact?.whatsapp?.trim() || "";
  if (!website && !email && !phone && !whatsapp) return null;

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
      {(email || whatsapp || phone) ? (
        <div className="flex flex-wrap gap-2">
          {email ? (
            <Button asChild size="icon" variant="outline" className="h-11 w-11">
              <a href={`mailto:${email}`} aria-label={`Enviar e-mail para ${orgName}`}>
                <Mail className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {whatsapp ? (
            <Button asChild size="icon" variant="outline" className="h-11 w-11">
              <a href={`https://wa.me/${digits(whatsapp)}`} target="_blank" rel="noreferrer noopener" aria-label={`WhatsApp de ${orgName}`}>
                <MessageSquare className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {phone ? (
            <Button asChild size="icon" variant="outline" className="h-11 w-11">
              <a href={`tel:${digits(phone)}`} aria-label={`Telefone de ${orgName}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
