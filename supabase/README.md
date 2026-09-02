# Banco de dados do CRM

Um banco atende todos os clientes. O isolamento é garantido pelo próprio
Postgres (RLS), não por separação física — e é verificado por teste.

## Instalar

1. Crie um projeto no [Supabase](https://supabase.com), região **South America (São Paulo)**.
2. Abra o **SQL Editor**, cole o conteúdo de [`INSTALAR.sql`](INSTALAR.sql) e execute.
3. Crie sua agência e o primeiro cliente:

```sql
insert into agencies (nome, slug)
values ('Nome da sua agência', 'sua-agencia')
returning id;

select app.criar_cliente('<id devolvido acima>', 'Nome do Cliente', 'slug-do-cliente');
```

O cliente já nasce com funil, sete etapas e seis motivos de perda. Renomeie as
etapas à vontade: a coluna `categoria` é o que mantém os relatórios funcionando
mesmo com nomes trocados.

**Nenhuma credencial precisa sair da sua máquina.** A chave `service_role` do
Supabase ignora toda a RLS — nunca a cole em chat, e-mail ou repositório.

## Quem enxerga o quê

| Papel | Alcance |
|---|---|
| `agencia` | Todos os clientes da agência dele |
| `admin` | A organização dele inteira |
| `gestor` | Ele e os times que gerencia |
| `vendedor` | Os próprios leads, mais a fila de leads sem dono |

Lead sem dono (`owner_id is null`) é visível para todos da organização de
propósito: é dessa fila que o vendedor puxa trabalho.

## Atualizar depois

`INSTALAR.sql` é só para a primeira vez. Mudanças posteriores entram como
migrations novas em `migrations/`, aplicadas na ordem do nome do arquivo.

## Testes

```bash
# normalização de telefone, e-mail e hashes de Meta/Google
node --experimental-strip-types supabase/functions/_shared/identidade.test.ts

# isolamento entre clientes — roda como usuário real, não superusuário
createdb crmtest
psql -d crmtest -f supabase/INSTALAR.sql
psql -d crmtest -f supabase/tests/rls_isolamento.sql
```

O teste de isolamento **precisa** rodar sob o papel `authenticated`. Superusuário
ignora RLS e faria qualquer teste passar — foi exatamente essa a armadilha que
levou à criação deste arquivo.

O que ele verifica:

| Verificação |
|---|
| Vendedor de um cliente vê apenas os deals dele |
| Vendedor de um cliente não alcança nenhum contato de outro |
| Usuário de agência vê os clientes dele, e só |
| Agência concorrente não alcança nada da sua |
| Sessão sem login não vê nada |
| Vendedor é impedido de gravar na organização de outro cliente |
| Usuário comum não consegue executar `ingerir_lead` |
| Usuário comum não lê `webhook_deliveries` |
| Cliente novo nasce com o funil completo |

### Por que as funções privilegiadas são fechadas

`ingerir_lead`, `app.criar_cliente`, `app.fundir_contatos` e `app.semear_org`
são `SECURITY DEFINER`: rodam com os privilégios do dono do banco e **ignoram a
RLS** por construção. O Postgres, por padrão, concede execução a `PUBLIC` em
função nova — o que deixaria qualquer usuário logado passar o `org_id` de outro
cliente e escrever na base dele.

A migration 0004 revoga esse acesso e o devolve só ao `service_role`, usado
pelas Edge Functions. A RLS não protegeria contra isso; a defesa é privilégio
de execução.

## Campos por nicho

O núcleo é fixo: nome, telefone, e-mail, dono, etapa, valor, datas, origem, UTMs
e histórico do funil são colunas tipadas, iguais em todo nicho. Só os campos de
qualificação variam, e eles são **declarados como dado**:

```sql
select app.definir_campos('<org_id>', $$[
  {"chave":"benefit_type","rotulo":"Tipo de benefício","tipo":"escolha",
   "opcoes":["aposentado","pensionista","militar","ativa"],"mostrar_no_funil":true},
  {"chave":"valor_ir_mensal","rotulo":"IR mensal","tipo":"moeda"}
]$$::jsonb);
```

Cliente novo, ou nicho inteiramente novo, entra **sem uma linha de DDL**.
A ficha do vendedor e os filtros do funil se montam lendo `v_ficha_campos`.

Campo não declarado, tipo errado ou opção inválida são **recusados com mensagem
clara** na ingestão — nunca gravados tortos em silêncio. É o que faz o contrato
valer quando alguém mexer num prompt daqui a seis meses.

### Desempenho, medido

100 mil contatos, filtro por campo de nicho presente em 0,1% das linhas:

| Montagem | Tempo | Plano |
|---|---|---|
| `custom jsonb` + índice GIN | **0,13 ms** | Bitmap Index Scan |
| Coluna tipada + índice btree | **0,07 ms** | Index Only Scan |

A coluna é ~2× mais rápida, e as duas são sub-milissegundo. A diferença é de
0,06 ms — não paga o custo de uma tabela por cliente.

## Captura de leads no site

- Todo site e landing page: [`packages/tracker/crm.js`](../packages/tracker/crm.js),
  com a `site_key` do registro em `sites`.
- WordPress: [`packages/wordpress-plugin/`](../packages/wordpress-plugin/),
  configurado em Ajustes › CRM Lead Bridge.

Rodar os dois juntos é seguro — a ingestão deduplica.

O subdomínio de rastreamento (`t.seudominio.com.br`) **não é opcional**: é o que
faz a atribuição sobreviver no Safari. Ver [`docs/crm/03-captura-web.md`](../docs/crm/03-captura-web.md).

## Ainda não construído

`ingest-uazapi`, `ingest-waba`, `ingest-leadgen`, `push-dispatch` e o worker do
outbox de conversões. Ordem e critérios em [`docs/crm/07-roadmap.md`](../docs/crm/07-roadmap.md).
