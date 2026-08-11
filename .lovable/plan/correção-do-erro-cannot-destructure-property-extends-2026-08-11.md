# Correção do erro "Cannot destructure property '__extends'"

## Diagnóstico (verificado)

O erro vem da geração de orçamento em PDF (Iteração 32), não do código da tela de reservas.

- `src/lib/bookings.server.ts` importa `pdf-lib` (1.17.1).
- `pdf-lib` depende de `tslib: ^1.11.1` e a versão instalada no projeto é **tslib 1.14.1**.
- tslib 1.x é somente CommonJS e não expõe exportações nomeadas em ESM. Quando o bundler converte o módulo (`__toESM(...)`), `__extends` fica indefinido e a desestruturação quebra em runtime — exatamente a mensagem relatada.

## Correção proposta

1. Atualizar `tslib` para a linha 2.x (compatível: mantém `__extends`, `__awaiter`, etc., e publica build ESM com exportações nomeadas). Isso resolve a interop para `pdf-lib` e para qualquer outro pacote que use helpers do tslib.
2. Garantir que a resolução aponte para uma única cópia do tslib, adicionando um alias explícito em `vite.config.ts` (via `vite: { resolve: { alias: { tslib: 'tslib' } } }`), evitando que uma cópia aninhada 1.x volte a ser usada em builds futuros.
3. Validar chamando a geração de orçamento em PDF de uma reserva e conferindo o download do arquivo, além de rodar o build de produção (o erro só aparece no bundle, não em dev com Node).

Plano B, caso o `pdf-lib` ainda apresente incompatibilidade com tslib 2: trocar para o fork mantido `@cantoo/pdf-lib` (API idêntica; só muda a linha de import em `src/lib/bookings.server.ts`).

## Fora do escopo

Existe também um aviso de hydration mismatch na home (`src/routes/index.tsx`), sem relação com este erro. Posso tratá-lo em seguida, se quiser.

## Registro

Entrada em `CHANGELOG.md` como correção da Iteração 32.
