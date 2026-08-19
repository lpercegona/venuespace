# Corrigir de vez o erro "JWT issued at future"

## O que já existe hoje

O projeto já tem duas camadas de paliativo (Iteração 1):

- `src/hooks/use-auth.ts` — trata o erro como transitório e tenta renovar o token.
- `src/lib/auth-retry-middleware.ts` — repete a server function uma vez após renovar a sessão.

Elas escondem o sintoma, mas não eliminam a causa: a validação continua falhando na primeira tentativa e, quando a renovação também cai na mesma janela de desvio, o erro reaparece.

## Onde o erro nasce

O único ponto do código que valida o token **localmente** (sem consultar o servidor de auth) é `src/integrations/supabase/auth-middleware.ts`, que chama `supabase.auth.getClaims(token)`. Como o projeto usa chaves assimétricas (ES256), essa chamada verifica a assinatura no próprio runtime usando a biblioteca `jose`, com tolerância de relógio **zero**. Se o relógio do runtime que executa a server function estiver alguns segundos atrás do relógio que emitiu o token, o `iat` do token fica "no futuro" e a validação falha.

Observação honesta: os relógios do sandbox e do servidor de auth estão sincronizados neste momento (diferença < 1s), então o desvio ocorre em produção/no runtime serverless ou no dispositivo do usuário. O primeiro passo do plano é confirmar de qual lado vem o desvio antes de assumir.

## Plano

1. **Diagnóstico (primeiro passo, rápido)**
   - Instrumentar a validação para registrar, quando falhar, o `iat` do token, o horário do runtime e a diferença em segundos.
   - Com isso fica registrado no log se o desvio é do runtime do servidor (esperado) ou de outra origem.

2. **Validação tolerante a desvio de relógio (correção principal)**
   - Criar um middleware próprio do projeto, `src/lib/require-auth.server.ts`, que substitui o uso direto de `getClaims`:
     - valida o token via `supabase.auth.getUser(token)` (autoridade remota, imune a desvio local) **ou**
     - mantém a verificação local, porém com tolerância explícita de relógio (~60s) para `iat`/`nbf`.
   - Manter exatamente o mesmo contrato de contexto (`supabase`, `userId`, `claims`) para que as 23 server functions que hoje importam `requireSupabaseAuth` continuem funcionando sem alteração de assinatura.
   - Trocar o import nesses arquivos para o middleware do projeto. O arquivo gerado `auth-middleware.ts` não é editado.

3. **Lado do cliente**
   - Ampliar a detecção de erro em `use-auth.ts` e `auth-retry-middleware.ts` para também reconhecer as variantes de mensagem do GoTrue/jose ("token used before issued", "JWTClaimValidationFailed", "before nbf").
   - Garantir que a renovação só ocorra uma vez por ciclo, evitando laço de refresh quando o relógio do dispositivo do usuário estiver muito fora.

4. **Registro**
   - Registrar a correção no `CHANGELOG.md` referenciando a Iteração 1 (correção definitiva do mesmo item).

## Detalhes técnicos

- Tolerância de relógio: 60 segundos, aplicada apenas a `iat`/`nbf`; `exp` continua sem tolerância, para não estender a vida útil do token.
- Se optarmos pela validação remota (`getUser`), há um custo de ~1 requisição HTTP por chamada protegida; nesse caso adiciono uma pequena cache em memória por token (TTL curto) para não penalizar rotas com várias chamadas.
- Nenhuma alteração de banco, política RLS ou chave de assinatura é necessária.
