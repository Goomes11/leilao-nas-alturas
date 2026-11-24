# Leilão nas Alturas | Ambiente interno GOL — Documentação do redesign

Este documento reúne as Partes 1, 2, 3 e 7 pedidas no prompt mestre. As Partes 4 (estrutura) e 6 (instruções) estão no `README.md`. A Parte 5 (código) são os próprios arquivos do projeto. Os testes estão em `TESTES.md`.

---

## PARTE 1 — Diagnóstico do HTML original (`Demo_Dois_Paineis.html`)

### Inventário funcional (o que existia)

| Área | Funcionalidades encontradas |
|---|---|
| Barra de demonstração | Troca entre 3 operadores e gestão; botão "Reiniciar dados de teste" |
| Operador | 4 indicadores (saldo, acumulados, situação, arrematados); catálogo de 10 prêmios com emoji, mínimo, maior lance principal e quantidade; formulário de lance (principal + segunda opção); "Meu histórico" (prêmio conquistado, lance atual, resumo de saldo); calendário fixo em HTML |
| Gestão | 4 indicadores; encerrar rodada; abrir próxima rodada; cadastro de operador; pontuação mensal com prévia; tabela de saldos; edição de prêmio (nome, mínimo, rodada); lances ativos; prêmios homologados; registro administrativo |
| Motor | `window.demoApi` com localStorage (`leilao2027_paineis_demo_v1`), função `call()` preparada para `google.script.run` |
| Dados fictícios | 3 operadores (`@exemplo.test`), 11 meses de pontuação fixa (114%, 112%, 110%), 10 prêmios, 4 rodadas |
| Perfis | Simulados por variável `selected` (operator1..3 / admin) |
| Armazenamento | localStorage sem versão, sem validação, `try/catch` que descarta o erro |

### Pontos fortes

- Conceito correto de separação operador × gestão e de privacidade (o catálogo mostrava só o maior lance principal).
- Regra de pontos já implementada com `floor(max(0, pct-100))*10`.
- Validações básicas de lance (inteiro, múltiplo de 10, mínimo, saldo, segunda opção diferente).
- Desempate com ordenação por pontos → horário → e-mail.
- Uso de função de escape (`esc`) ao montar HTML e de `textContent` nas mensagens.
- Camada `call()` já pensando em troca de backend (Apps Script).

### Problemas e riscos funcionais

1. **Encerrar = homologar sem prévia.** `adminEncerrarRodada` gravava vencedores direto após um `confirm()`. Não havia simulação, relatório nem lista de lances descartados.
2. **Homologação dependente da ordem global.** Os lances eram ordenados todos juntos (de todos os prêmios) e atribuídos em sequência. O resultado estava certo por coincidência, mas não registrava motivo, empate nem conflito.
3. **Participante inativo podia vencer.** `claim()` não verificava `ativo`.
4. **Saldo não revalidado na homologação.** Se a pontuação fosse reduzida depois do lance, o vencedor ficaria com saldo negativo.
5. **Lances de inativos inflavam o "maior lance" público.**
6. **Regra de pontos duplicada** (motor e prévia da tela), arriscando divergência.
7. **Datas sem efeito.** `today: '2027-12-01'` fixo; as rodadas abriam só por botão, sem calendário nem prazo.
8. **Bloqueio de edição de prêmio** considerava lances de qualquer status, sem regra clara do que pode mudar.
9. **Reabertura e reversão inexistentes**; uma homologação errada só se desfazia apagando tudo.
10. **Envio duplo**: havia flag `working`, mas a camada de dados não tinha idempotência.
11. **Segunda opção sem explicação ao participante** do impacto real (só valia se o prêmio sobrasse).
12. **Cadastro aceitava qualquer texto com "@"** e permitia sobrescrever participante pelo e-mail sem confirmação.
13. **Pontuação com `type=number`** não aceitava vírgula decimal brasileira em vários navegadores.

### Riscos de segurança (no contexto de demonstração)

- Perfil trocado por variável global e `window.demoApi` exposto: qualquer pessoa no console virava gestão (inevitável sem backend, mas não estava documentado como limitação).
- `innerHTML` em quase toda renderização. O escape existia, mas qualquer esquecimento futuro abriria XSS.
- JSON corrompido no localStorage era silenciosamente trocado por dados novos (perda de dados sem aviso).
- Sem versionamento de schema nem validação dos dados carregados.
- Auditoria registrava só uma palavra ("LANCE", "PRÊMIO"), sem valor anterior/posterior.
- Exportação inexistente; quando existir, CSV sem neutralizar fórmulas permitiria injeção em planilhas.

### Inconsistências de UX

- Página única e longa para a gestão (todas as funções empilhadas).
- `alert/confirm` nativos; mensagens genéricas ("Segunda opção inválida.", "Dados mensais inválidos.").
- Sem estados de carregamento, vazio ou erro por componente (só um "Carregando…" global).
- Formulário bloqueado sem explicar o motivo (contemplado, rodada fechada).
- Sem confirmação com resumo antes de registrar o lance; sem informar saldo potencial.
- Termos misturados: "oferta", "proposta", "lance", "alternativa", "segunda opção".
- Título em caixa alta ("SEUS PONTOS PODEM IR MAIS LONGE").

### Divergências da identidade GOL

- Paleta azul-marinho (`#10243a`) dominante — não existe na paleta GOL. Laranja aproximado (`#f36b26`) em vez de `#FF7020`.
- Logo improvisado com a palavra "GOL" em texto.
- Emojis como ícones dos prêmios.
- Gradiente diagonal azul/laranja no topo — não previsto no manual.
- Fonte Segoe UI; sem estrutura para GOL Sans.

### Acessibilidade

- Labels sem `for` no cadastro e na pontuação; tabelas sem `caption`/`scope`.
- Sem link "Pular para o conteúdo", landmarks incompletos, sem `aria-current`.
- Botão desabilitado apenas com opacidade; foco com contorno laranja claro de baixo contraste.
- Texto branco sobre laranja (contraste 2,85:1, reprovado).
- Mensagens dinâmicas parcialmente anunciadas (`role=status` só em dois pontos).

### Responsividade

- Tabelas com `min-width: 610px` sem alternativa empilhada.
- Barra de demonstração com select de 310 px que estoura em 320 px.
- Navegação inexistente (tudo em uma página), sem menu recolhível.

### Melhorias aplicadas (resumo)

Arquitetura em camadas (config → domínio puro → armazenamento → serviço → UI), homologação com prévia/assinatura/confirmação/relatório/reversão controlada, calendário real com data simulada, auditoria com antes/depois, backup/importação validados, estados de interface completos, identidade GOL com logo oficial extraído do PowerPoint, acessibilidade WCAG 2.1 AA e 37 testes automatizados.

---

## PARTE 2 — Padrões identificados no site oficial da GOL

> **Como a análise foi feita.** O site `voegol.com.br` foi lido pela ferramenta de leitura de páginas (estrutura, textos, navegação e componentes). O navegador conectado não pôde ser usado nesta sessão sem interromper o usuário para escolher entre três navegadores, então **não houve inspeção de pixels, CSS computado, hover ou comportamento mobile real**. Onde a análise depende de valores visuais (raios, sombras, larguras), as decisões vieram do PowerPoint e de boas práticas, e estão marcadas como "adaptação". Recomenda-se uma revisão visual lado a lado antes da apresentação.

### Padrões encontrados

| Tema | O que o site mostra | Como foi adaptado aqui |
|---|---|---|
| Cabeçalho | Link "Pular para o conteúdo" primeiro; logo à esquerda levando ao início; área utilitária (check-in, minhas viagens, acessar conta) | Skip link; logo oficial à esquerda; à direita, chip "Dados fictícios", avisos, usuário e "Sair (simulação)" |
| Navegação | Menu principal por grupos (Serviços, Informações, Atendimento…), cada grupo com ícone + título | Menu por tarefas com ícone + rótulo: 6 itens (operador, barra superior) e 8 itens (gestão, menu lateral) |
| Mobile | Menu em gaveta lateral ("Menu" + botão voltar) | Gaveta com `aria-expanded`, Escape, foco preso e retorno do foco |
| Cards | Ícone/imagem + título em negrito + descrição curta + link de ação | Cards de prêmio, atalhos e indicadores no mesmo esquema |
| Títulos | H1 único de página; H2 de seção em negrito, às vezes com segunda parte destacada | H1 por tela; saudação com segunda parte em destaque ("Olá, Alex. **Seus pontos podem ir mais longe.**") |
| Avisos | Faixa "Importante:" curta e direta | Componente `alert` em 6 variações com título curto + frase acionável |
| Estado vazio de busca | "Nenhum resultado…" + sugestão do que fazer | Estados vazios específicos com ação ("Limpar filtros") |
| Formulários | Campos com rótulo claro, uma ação por formulário ("Enviar", "Aplicar") | Campos amplos (48 px), rótulo visível, ajuda e erro associados, um botão principal |
| CTAs | Verbos curtos no imperativo ("Compre agora", "Saiba mais") | "Fazer meu lance", "Ver prêmios", "Simular encerramento" |
| Tom | Segunda pessoa ("você"), direto | Mesmo tom, sem caixa alta e sem ponto de exclamação excessivo |
| Rodapé | Fundo escuro, colunas, marcas do grupo | Rodapé grafite com logo para fundo escuro e identificação do ambiente interno |

### Elementos que NÃO foram copiados (e por quê)

Busca de voos, ofertas, preços, banners, fotos comerciais, Smiles, seletor de idioma/moeda, newsletter, CNPJ/endereço, cookies, analytics, código-fonte e qualquer recurso hospedado no site. Nenhum arquivo é carregado do domínio da GOL: o app funciona offline. O formulário de lance não imita o buscador de passagens.

### Como a identidade do Leilão foi preservada

O nome "Leilão nas Alturas" aparece ao lado do logo em todas as telas, junto da etiqueta "Ambiente interno GOL · Campanha 2027". A barra "Controles da demonstração" e o chip "Dados fictícios" deixam claro que não é o site público nem um sistema em produção.

### Aplicação do manual (PowerPoint)

- **Paleta**: os 23 valores dos slides "Paleta de Cores" viraram tokens em `tokens.css`. Foram criados 7 tons derivados (fundos suaves de alerta e hover) a partir da própria paleta, documentados no arquivo.
- **Proporção**: off-white nos fundos, branco nos cards, grafite nos textos, laranja só em marca, ação principal, estado ativo e destaques.
- **Logo**: extraídos os 3 arquivos oficiais (fundo claro, escuro e laranja) do slide "Logos", sem recorte, distorção ou efeito.
- **Grafismos**: círculos interligados com traço fino (slide "Grafismos"), usados no hero e no card de saldo, ocultos abaixo de 375 px.
- **Tipografia**: hierarquia XBold/Bold/Regular. A fonte GOL Sans existe embutida no PPTX, mas não foi extraída por questão de licença; há estrutura `@font-face` pronta.

### Decisões de contraste (prioridade 1: acessibilidade)

| Combinação | Contraste | Decisão |
|---|---|---|
| Branco sobre Laranja `#FF7020` | 2,85:1 ✘ | Não usado para texto |
| Grafite sobre Laranja | 4,58:1 ✔ | Texto do botão primário |
| Branco sobre Laranja Escuro `#DB5014` | 4,06:1 ✘ (texto normal) | Laranja escuro só em títulos grandes |
| Laranja sobre Grafite | 4,58:1 ✔ | Destaques no rodapé e no card de saldo |
| Vermelho `#FF4F4F` com texto | 3,9:1 ✘ | Vermelho como borda/ícone; texto de erro em Vinho (7,1:1) |
| Verde `#009A8B` com texto | 3,5:1 ✘ | Verde como borda; texto de sucesso em Musgo (5,3:1) |

Isso difere do site público, que usa texto branco sobre laranja. A regra de prioridade do prompt (acessibilidade acima de padrões do site) decidiu.

---

## PARTE 3 — Premissas adotadas

| Tema | Decisão | Origem |
|---|---|---|
| Pontos no lance | **Não são consumidos ao registrar**; o desconto ocorre só na homologação. A tela mostra saldo atual, pontos comprometidos e saldo potencial se vencer | Prompt §10 |
| Saldo × lances | Principal e segunda opção são validados **cada um** contra o saldo inteiro (só um deles pode vencer) | Decisão justificada |
| Um prêmio por participante | Na campanha inteira. Contemplado não pode dar novos lances | Prompt §12 |
| Lance ativo | Um por participante por rodada. Atualizar cria nova versão e marca a anterior como "substituído" (fica no histórico) | Prompt §10 |
| Prioridade no empate após atualização | Vale o **horário da versão atual**. Atualizar o lance "volta para a fila" | Comportamento do HTML original preservado; validar com o negócio |
| Desempate | 1º maior pontuação → 2º lance registrado primeiro → 3º e-mail em ordem alfabética (**critério técnico, precisa de validação do negócio**). Aviso exibido na prévia | Prompt §12 |
| Segunda opção | Avaliada só depois de todos os lances principais, só para quem não venceu e só para prêmios ainda sem vencedor; mesmos critérios | Prompt §11 |
| Homologação | Simular → revisar → confirmar (com caixa de confirmação) → relatório. A confirmação compara uma **assinatura** dos dados; se algo mudou desde a prévia, é bloqueada | Prompt §12 e §30 |
| Encerramento | A confirmação da homologação encerra a rodada para lances. Na demonstração é possível homologar antes do fim do prazo (com aviso); em produção, só após o encerramento | Simplificação para apresentação |
| Reversão | Só da última rodada homologada, antes de abrir a seguinte, com justificativa ≥ 20 caracteres e confirmação. Prêmios ficam como "revertido" (não são apagados) | Prompt §12 item 16 |
| Repescagem | Rodada 4: todos os prêmios ativos sem vencedor ficam elegíveis, para quem não foi contemplado | HTML original |
| Liberação de prêmios | Prêmio entra na rodada indicada e continua nas seguintes até ser arrematado | HTML original |
| Lances de inativos | Ficam gravados, não contam no "maior lance" público e são descartados na homologação com motivo | Correção |
| Edição de prêmio | Descrição, ícone e ordem: sempre. Nome: até ser homologado. Mínimo e rodada: só sem lances. Inativar com lances: justificativa | Prompt §29 |
| Participantes | Sem exclusão física; só inativação lógica com justificativa | Prompt §27 |
| Importação CSV | Nome precisa conferir com o cadastro do e-mail; duplicidade no mesmo arquivo é rejeitada; mês existente é atualizado | Decisão conservadora |
| Data simulada | Relógio = data escolhida + tempo real decorrido desde a escolha (a contagem regressiva anda). Ao abrir a próxima rodada, se a data estiver antes do início, é ajustada para o 1º dia às 09h00 (registrado na auditoria) | Recurso de demonstração |
| Dados fictícios | 10 participantes `@exemplo.test` (domínio reservado), 10 prêmios, 6 lances na Rodada 1 montados para mostrar empate, segunda opção, conflito, atualização e inativo | Prompt §45 |
| Modo local | localStorage não é banco, não autentica, não autoriza, não tem transação nem concorrência; pode ser editado pelo navegador. Toda regra deve ser revalidada no servidor | Prompt §33 |

**Resultado esperado da Rodada 1 com os dados iniciais (sem novos lances):** Smart TV → Marina (empate de 1.000 com Rafael; Marina registrou antes) · Notebook → Beatriz (950 × 900) · Bicicleta → Rafael pela **segunda opção** (empate de 900 com Lucas; Rafael antes) · Carla (inativa) descartada · Lucas sem prêmio.

---

## PARTE 7 — Checklist

### Funcionalidades
- [x] Operador: início, meus pontos, prêmios, meu lance, histórico, regras e calendário
- [x] Gestão: visão geral, participantes, pontuação, prêmios, lances, rodadas, auditoria, configurações
- [x] Pesquisa, filtros, ordenação e paginação
- [x] Exportação CSV (participantes, pontuação, lances, auditoria, relatório de importação)
- [x] Backup JSON: exportar, validar, importar com confirmação
- [x] Importação CSV com prévia, erros, duplicados e confirmação
- [x] Contagem regressiva, toasts e modais acessíveis
- [x] Modo de erro, modo de dados vazios, data simulada, reset
- [x] Impressão do relatório de homologação
- [x] Migração automática dos dados do protótipo original

### Regras
- [x] Pontos: `floor(max(0, atingimento-100))*10` em um único ponto (`domain.calcPoints`)
- [x] Lance: inteiro, > 0, ≥ mínimo, múltiplo de 10, ≤ saldo, participante ativo, rodada aberta no prazo, prêmio liberado
- [x] Segunda opção diferente e com as mesmas validações
- [x] Um lance ativo por rodada, histórico de versões
- [x] Um prêmio por participante; prêmio com no máximo um vencedor
- [x] Desempate determinístico independente da ordem dos arrays
- [x] Prévia obrigatória, assinatura, bloqueio de dupla homologação, reversão controlada

### Responsividade
- [x] 320, 375, 768, 1024, 1366, 1440 px e maiores sem rolagem horizontal na página
- [x] Menu recolhível, filtros recolhíveis, tabelas empilhadas, modais como "bottom sheet"

### Acessibilidade
- [x] Skip link, landmarks, H1 por tela, foco no título após navegação
- [x] Labels associados, erros em texto ligados por `aria-describedby`, `aria-invalid`
- [x] `aria-live`, `aria-current`, `aria-expanded`, `aria-sort`, `aria-pressed`
- [x] Modais com focus trap, Escape, retorno de foco e fundo `inert`
- [x] Contraste AA calculado; estados com cor + ícone + texto
- [x] `prefers-reduced-motion`; áreas de toque ≥ 44 px; gráficos com tabela alternativa

### Identidade GOL
- [x] Logo oficial do PowerPoint nas três versões corretas
- [x] Paleta oficial em tokens; laranja usado com moderação
- [x] Grafismo de círculos interligados, decorativo e oculto em telas pequenas
- [x] Estrutura pronta para GOL Sans (fallback Arial)
- [ ] Revisão visual lado a lado com o site oficial (pendente — ver Parte 2)

### Segurança (limites de demonstração)
- [x] Nenhum `innerHTML` com dados; construção por `createElement`/`textContent`
- [x] Sem `eval`, `Function`, eventos inline ou CDN
- [x] CSV neutraliza fórmulas (`=`, `+`, `-`, `@`)
- [x] Erros sem stack trace para o usuário
- [x] Operador recebe do serviço só os próprios dados (teste automatizado)
- [ ] Autenticação/autorização reais — **dependem de produção**

### Persistência
- [x] Schema versionado, validação na carga, migração, tratamento de JSON corrompido com tela de recuperação
- [x] Fallback em memória quando o navegador bloqueia o localStorage

### Testes
- [x] 37 testes automatizados de regras (`node tests/run-node.js` ou `tests/index.html`)
- [x] Roteiro manual de 30 passos em `TESTES.md`

### Limitações conhecidas
- Qualquer pessoa com acesso ao console do navegador pode alterar dados e perfil.
- A trilha de auditoria é local e editável.
- Concorrência entre abas não é tratada (a última gravação vence).
- Fonte GOL Sans não incluída (licença).
- Ícones dos prêmios são placeholders em SVG até a chegada de imagens oficiais.
