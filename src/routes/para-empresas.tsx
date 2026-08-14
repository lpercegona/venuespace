import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarCheck,
  FileText,
  Images,
  MessagesSquare,
  Search,
  Star,
  Handshake,
} from "lucide-react";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const CANONICAL = "https://venuespace.com.br/para-empresas";
const TITLE = "Cadastre sua empresa — Venuespace";
const DESCRIPTION =
  "Publique espaços para eventos, equipamentos e serviços no Venuespace: página própria, galeria, avaliações, contato direto e gestão de reservas. Cadastro gratuito.";

const FAQ = [
  {
    q: "Cadastrar minha empresa no Venuespace tem custo?",
    a: "Não. A criação da conta, o cadastro da organização e a publicação dos seus espaços e serviços são gratuitos. O Venuespace não cobra comissão sobre as negociações fechadas com os interessados.",
  },
  {
    q: "Quanto tempo leva para minha página ficar no ar?",
    a: "Assim que você conclui o cadastro e publica os registros, a página fica visível nas listagens públicas. A revisão de conteúdo é feita pela equipe e você pode editar tudo a qualquer momento.",
  },
  {
    q: "Quem tem acesso aos meus dados de contato?",
    a: "Os dados de contato aparecem apenas nas informações que você escolhe publicar. Pedidos e mensagens chegam pela plataforma, e apenas os membros da sua organização acessam o painel interno.",
  },
  {
    q: "Posso editar as informações depois de publicar?",
    a: "Sim. Fotos, descrição, campos técnicos, preços de referência e disponibilidade podem ser alterados a qualquer momento pelo painel da sua organização.",
  },
  {
    q: "Como recebo os contatos e pedidos de reserva?",
    a: "Cada interessado abre uma conversa vinculada ao registro. Você recebe notificações no painel, responde pelo chat, envia propostas com valores e acompanha o status da negociação até o fechamento.",
  },
  {
    q: "Já existe uma página com o meu espaço. Como reivindico?",
    a: "Envie um e-mail para contato@venuespace.com.br informando o nome do espaço e um comprovante de vínculo com a empresa. A equipe transfere a administração da página para a sua conta.",
  },
];

const BENEFITS = [
  {
    icon: Search,
    title: "Visibilidade em buscas",
    text: "Sua empresa aparece nas listagens por categoria, cidade e bairro, com filtros que levam o interessado direto ao que você oferece.",
  },
  {
    icon: Handshake,
    title: "Contato direto, sem comissão",
    text: "As conversas acontecem entre você e o cliente. O Venuespace não intermedia pagamento nem retém percentual sobre o valor fechado.",
  },
  {
    icon: CalendarCheck,
    title: "Agenda e reservas",
    text: "Controle períodos ocupados, evite datas sobrepostas e acompanhe as reservas confirmadas em um calendário único.",
  },
  {
    icon: FileText,
    title: "Propostas e orçamentos",
    text: "Monte orçamentos com vários itens, aplique descontos, gere PDF e registre cada etapa da negociação até o encerramento.",
  },
];

const STEPS = [
  {
    title: "Crie sua conta",
    text: "Cadastro com e-mail e senha ou com Google, em menos de um minuto.",
  },
  {
    title: "Cadastre sua organização",
    text: "Nome, logo, descrição, endereço e categorias de atuação da sua empresa.",
  },
  {
    title: "Publique espaços e serviços",
    text: "Adicione fotos, capacidade, comodidades e valores de referência de cada registro.",
  },
  {
    title: "Receba e negocie pedidos",
    text: "Responda no chat, envie propostas, confirme a reserva e feche o negócio.",
  },
];

const FEATURES = [
  { icon: BadgeCheck, text: "Página pública própria com endereço fixo" },
  { icon: Images, text: "Galeria de fotos otimizada para carregamento rápido" },
  { icon: Star, text: "Avaliações de clientes na página da organização" },
  { icon: MessagesSquare, text: "Chat com interessados vinculado a cada registro" },
  { icon: FileText, text: "Orçamento em PDF com identidade da sua empresa" },
  { icon: CalendarCheck, text: "Calendário de reservas com verificação de conflitos" },
];

export const Route = createFileRoute("/para-empresas")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: "https://venuespace.com.br/" },
            { "@type": "ListItem", position: 2, name: "Para empresas", item: CANONICAL },
          ],
        }),
      },
    ],
  }),
  component: ForBusinessPage,
});

function ForBusinessPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader showAuthActions={false} />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-linear-to-br from-surface via-muted to-primary/20">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <p className="text-sm font-medium text-primary">Para empresas</p>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Cadastre seu espaço ou serviço no Venuespace
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              O Venuespace conecta quem organiza eventos a quem oferece espaços, equipamentos
              audiovisuais e serviços. Publique sua empresa, receba pedidos qualificados e
              negocie diretamente — sem comissão sobre o valor fechado.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-11 rounded-full px-6">
                  Cadastrar empresa
                </Button>
              </Link>
              <Link to="/explore">
                <Button size="lg" variant="outline" className="h-11 rounded-full px-6">
                  Ver categorias
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Benefícios */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Por que estar no Venuespace
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <Card key={b.title} className="h-full">
                <CardHeader className="space-y-3">
                  <b.icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base">{b.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{b.text}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Como funciona */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Como funciona
            </h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="space-y-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="text-base font-medium text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* O que publicar */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            O que você pode publicar
          </h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <article className="space-y-2">
              <h3 className="text-lg font-medium text-foreground">Espaços para eventos</h3>
              <p className="text-sm text-muted-foreground">
                Salões, casas de festa, auditórios, estúdios, coworkings, chácaras e áreas ao ar
                livre. Informe capacidade mínima e máxima, comodidades, estrutura disponível e
                fotos do ambiente — os interessados filtram exatamente por esses critérios.
              </p>
              <Link to="/explore" className="text-sm font-medium text-primary hover:underline">
                Ver espaços publicados
              </Link>
            </article>
            <article className="space-y-2">
              <h3 className="text-lg font-medium text-foreground">Equipamentos e audiovisual</h3>
              <p className="text-sm text-muted-foreground">
                Som, iluminação, painéis de LED, projeção, palcos e estruturas. Cada item pode ter
                período de locação, valores de referência e disponibilidade por data, com
                verificação automática de conflitos de reserva.
              </p>
              <Link to="/explore" className="text-sm font-medium text-primary hover:underline">
                Ver equipamentos publicados
              </Link>
            </article>
            <article className="space-y-2">
              <h3 className="text-lg font-medium text-foreground">Serviços para eventos</h3>
              <p className="text-sm text-muted-foreground">
                Buffet, fotografia, decoração, cerimonial, segurança e demais serviços
                complementares. Descreva pacotes, diferenciais e área de atendimento para receber
                pedidos alinhados ao que sua empresa entrega.
              </p>
              <Link to="/explore" className="text-sm font-medium text-primary hover:underline">
                Ver serviços publicados
              </Link>
            </article>
          </div>
        </section>

        {/* Recursos */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Recursos incluídos na plataforma
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.text} className="flex items-start gap-3 text-sm text-foreground">
                  <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Perguntas frequentes
          </h2>
          <Accordion type="single" collapsible className="mt-6">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* CTA final */}
        <section className="border-t border-border bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Comece a receber pedidos hoje
              </h2>
              <p className="text-sm opacity-90">
                Cadastro gratuito. Publique sua empresa e apareça para quem está procurando.
              </p>
            </div>
            <Link to="/auth" className="shrink-0">
              <Button size="lg" variant="secondary" className="h-11 rounded-full px-6">
                Cadastrar empresa
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
