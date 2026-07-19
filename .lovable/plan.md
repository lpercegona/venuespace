## Problema identificado

O painel do super admin em **Admin › Layout público › Card de organização** só oferece campos vindos de `category_org_fields` (cascade). Os campos-base da organização (`name`, `description`, `logo_url`, `address.*`) não aparecem como opção, então:

1. Não há como o super admin selecionar "Cidade", "Logo", "Descrição" etc. para o card público.
2. Layouts existentes referenciam chaves (`foto_capa`, `endereco`) que não existem em nenhum lugar → cards ficam vazios.
3. Mesmo se o super admin escolhesse `address.city`, `listPublicOrganizations` só entrega no `data` do card `{ name, slug, description, logo_url, ...category_data }` — o endereço nunca é incluído, então o renderer não teria como exibir.

Registros (`record_card`) já funcionam porque os campos padrão viram colunas de `fields` da tabela, populam `records.data` e o layout referencia as mesmas chaves.

## Correções

### 1. Backend — `src/lib/public.server.ts` (`listPublicOrganizations`)
- Incluir no `data` de cada organização as chaves de endereço achatadas (`address.cep`, `address.street`, `address.number`, `address.complement`, `address.neighborhood`, `address.city`, `address.state`), lendo de `organizations.address`.
- Estender `ORG_BUILTIN_FIELDS` com esses campos-base de endereço (type `text`) e manter `logo_url` como `image`.
- `PublicCardBody` já usa `data[field_key]` — como as chaves incluem ponto, garantir acesso literal (Record) sem tratamento especial.

### 2. Admin — `src/routes/_authenticated.admin.index.tsx` (`LayoutEditor`, escopo `organization_card`)
- Ao montar `available`, unir campos-base de organização (name, description, logo_url, address.city, address.state, address.neighborhood, address.street, address.number, address.complement, address.cep) com os `category_org_fields` retornados por `listCategoryCascadeFields`.
- Marcar visualmente cada opção com sua origem (Base / Cascata) para clareza.
- Manter o filtro `!rows.some((r) => r.field_key === f.field_key)` para não duplicar.

### 3. Comunicação ao usuário
- O layout salvo hoje contém `foto_capa` e `endereco` — chaves inexistentes. Após o deploy, o super admin precisa abrir Admin › Layout público › Card de organização, remover essas linhas e escolher os novos campos-base (ex.: Logo, Descrição, Cidade/UF). Nada é apagado automaticamente.

### 4. Registro
- Atualizar `CHANGELOG.md` com a Iteração 17 (correção de layout público de organização + exposição de campos-base para o super admin).

Fora do escopo: alterar formatação/renderização dos cards, mexer no card de registro (já correto), tocar em qualquer lógica de dados que não seja a montagem do payload público de organização.
