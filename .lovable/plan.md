## Enquadramento (sem nova iteração)

Esta entrega é registrada como **Correção**, não como Iteração 24.

Iterações corrigidas, conforme o CHANGELOG:
- **Iteração 11 / 12 — Cascata de campos por categoria e consolidação em "Campos padrão"**: origem do bug de persistência de `config.options`.
- **Iteração 2 — Records + Grid/Form dinâmicos**: paridade de renderização por tipo de campo nos componentes genéricos.
- **Iteração 20/21 — Tabelas padrão**: apenas referência comparativa (o editor de tabelas padrão já grava corretamente; serve de baseline).

Entrada no `CHANGELOG.md` no formato já usado no projeto:
`## YYYY-MM-DD HH:MM (America/Sao_Paulo) — Correção das Iterações 11/12 e 2 — select/multiselect: persistência de opções e plotagem`

## Diagnóstico (verificado no banco e no código)

```text
category_org_fields.tipos_de_eventos (multiselect) → config = {}
organization_category_default_fields.tipos_de_layout (multiselect) → config = {}
category_standard_table_fields.tipos_de_layout (multiselect) → config = {options:[...]}  ← único correto
```

1. **Opções não persistem** — em `src/routes/_authenticated.admin.index.tsx`, o `ScopeEditor` (l. 542-560) mapeia as linhas dos três escopos **descartando `config`**. Assim `openEdit()` não repovoa `optionsText` e o salvamento grava `config` vazio, apagando as opções. O editor de Tabelas padrão (l. ~1501) restaura o `config` e por isso funciona.
2. **Campo renderizado como texto** — `src/components/venue/category-fields-form.tsx` trata `boolean`, `long_text`, `image/file`, `gallery` e `select`, mas **não trata `multiselect`** (cai no `<Input type="text">`) nem `relation`.
3. **Validação compartilhada desatualizada** — `src/lib/field-schema.ts`: `FIELD_TYPES` sem `long_text`, `gallery`, `phone`; `zodForField` sem o caso `gallery` (array validado como string). `records.functions.ts` já foi corrigido na Iteração 20.

## Escopo da correção

### 1. Painel super admin — persistência
- Incluir `config` em `UnifiedField` e nos três mapeamentos de query (org, tabela, registro).
- `openEdit()` repovoa `optionsText` de `config.options` e o papel `cep` de `config.role`.
- Ao salvar, fazer **merge** com o `config` existente; gravar `options` só para `select`/`multiselect` e limpá-las na troca de tipo.
- Listagem exibe as opções cadastradas (contagem/preview) para conferência.

### 2. `CategoryFieldsForm` — plotagem
- Implementar `multiselect` (checkboxes a partir de `config.options`, valor como array), no mesmo padrão de `dynamic-form.tsx` (l. 240-262).
- Implementar `relation` com rótulo explícito; manter `computed` fora do formulário.
- Conferir tipos de input de `phone`, `email`, `url`, `number`, `currency`, `date`, `datetime`.

### 3. Alinhamento de tipos
- `src/lib/field-schema.ts`: `FIELD_TYPES` e `zodForField` alinhados à lista canônica (`long_text`, `gallery`, `phone`).

### 4. Auditoria de propagação (§0)
Declarar item a item o estado de cada superfície que lê/exibe campos: `DynamicGrid`, `DynamicForm`, `public-card-renderer.tsx`, `public.$slug.$tableId.$recordId.tsx`, `/api/public/*`, `/explore`, landing — corrigindo `multiselect`/`select`/`url`/`phone` onde a formatação estiver inconsistente.

### 5. Reparo dos dados existentes
Migração pontual para restaurar as opções perdidas de `tipos_de_eventos` (escopo organização) e `tipos_de_layout` (escopo registro). Para `tipos_de_layout` reutilizo as opções já existentes no campo homônimo de tabela padrão; para `tipos_de_eventos` preciso da lista de opções desejada — **confirmar antes de aplicar** (ambiguidade = parada, §0).

### 6. Skill — nova norma em §0
Adicionar à Diretriz de Desenvolvimento, na seção de registro obrigatório:

> **Correções não abrem iteração**: quando a entrega corrige comportamento de escopo já entregue, ela é registrada como `Correção`, identificando explicitamente as iterações corrigidas (`Correção da Iteração N` / `Correção das Iterações N/M`). Nova numeração de iteração é reservada a escopo novo aprovado. A entrada do `CHANGELOG.md` deve citar a iteração de origem do bug e a auditoria de propagação correspondente.

## Detalhes técnicos

- Arquivos: `src/routes/_authenticated.admin.index.tsx`, `src/components/venue/category-fields-form.tsx`, `src/lib/field-schema.ts`, possivelmente `dynamic-grid.tsx` / `public-card-renderer.tsx` / rota pública de detalhe, `CHANGELOG.md`, e a skill do projeto.
- Sem mudança de esquema; apenas conteúdo `jsonb` de `config` e código de UI.
- Validação: build/typecheck, 360/768/1280 em light+dark, e verificação com Playwright de criação/edição de um campo `multiselect` em cada escopo com persistência das opções.
