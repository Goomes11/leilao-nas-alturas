# Testes — Leilão nas Alturas

## Testes automatizados (regras de negócio)

- **Node.js 18+**: `node tests/run-node.js`
- **Navegador**: abra `tests/index.html` (usa estado em memória; não altera a demonstração)

Resultado na entrega: **37 aprovados, 0 reprovados.**

| # | Cenário coberto |
|---|---|
| 1–3 | Regra de pontos (99,9 → 0 · 100,9 → 0 · 101 → 10 · 102,8 → 20 · 114 → 140), negativo/texto, decimal pt-BR |
| 4 | Fases do calendário (antes, pontuação, rodadas, repescagem, homologação, encerrada) |
| 5 | Lance válido registrado sem consumir saldo |
| 6 | Incremento inválido |
| 7 | Abaixo do mínimo, zero, negativo |
| 8 | Lance maior que o saldo (mensagem cita o saldo) |
| 9 | Segunda opção igual à primeira |
| 10 | Participante inativo |
| 11 | Prêmio fechado (rodada futura) |
| 12 | Rodada encerrada pelo calendário |
| 13 | Atualização de lance com histórico e um único ativo |
| 14 | Duas submissões quase simultâneas |
| 15 | Reenvio do mesmo `requestId` |
| 16 | Operador não recebe dados de outros participantes |
| 17 | Homologação dos dados iniciais (empate, prêmio só por segunda opção, inativo) |
| 18 | Prêmio sem lance principal |
| 19 | Empate exato → e-mail (critério técnico) |
| 20 | Resultado independe da ordem dos arrays |
| 21 | Participante como possível vencedor em mais de um cenário (conflito) |
| 22 | Participante já contemplado |
| 23 | Fluxo prévia → confirmação → bloqueio de dupla homologação → próxima rodada |
| 24 | Prévia desatualizada bloqueia confirmação |
| 25 | Contemplado não pode dar novo lance |
| 26 | Prêmio arrematado não recebe lance |
| 27 | Reversão com justificativa obrigatória |
| 28 | E-mail duplicado |
| 29 | Alterar mínimo com lance (bloqueado) e sem lance (permitido) |
| 30–31 | Importação CSV (válido, inválido, duplicado, inexistente, negativo, cabeçalho) |
| 32 | Auditoria de alteração manual de pontuação |
| 33 | Backup válido, de outro formato e corrompido |
| 34 | Estado inválido detectado na carga |
| 35 | Migração do protótipo original |
| 36 | Modo de erro com mensagem sem stack trace |
| 37 | CSV neutraliza fórmulas |

## Roteiro manual obrigatório (30 passos)

Antes de começar: **Controles da demonstração → Restaurar demonstração**.

| # | Passo | Resultado esperado |
|---|---|---|
| 1 | Abrir `index.html` | Abre como Alex (operador), Início, Rodada 1 aberta, contagem regressiva |
| 2 | Visualizar saldo | 1.540 pontos; acumulados 1.540; utilizados 0 |
| 3 | Prêmios → buscar "note", filtrar "Disponíveis" | 1 prêmio; contador anunciado |
| 4 | Clicar "Escolher" na Bicicleta | Vai para Meu lance com Bicicleta selecionada |
| 5 | Digitar 905 | Erro "Use múltiplos de 10 pontos. Exemplo: 910." |
| 6 | Corrigir para 1.000 | Erro some; resumo mostra saldo se vencer 540 |
| 7 | Revisar lance → Confirmar | Modal com rodada, valores e saldos; depois "Seu lance foi registrado. Você poderá atualizá-lo até 3 de dezembro, às 23h59." |
| 8 | Alterar para 1.100 e Notebook 900 como 2ª opção → confirmar | "Lance atualizado"; versão 2 |
| 9 | Histórico | Versão 1 "Substituído", versão 2 "Ativo" |
| 10 | Trocar perfil para Gestão | Visão geral com indicadores, gráficos e inconsistências |
| 11 | Participantes → Cadastrar (repita um e-mail existente, depois um novo) | Erro de e-mail duplicado; depois sucesso e auditoria |
| 12 | Pontuação → Alex, nov/2027, "120,5" → Salvar | Prévia 200 pontos; confirmação com antes/depois; auditoria |
| 13 | Prêmios → editar Smartphone (sem lance), mínimo 820 | Salvo |
| 14 | Editar Smart TV (com lance) | Mínimo e rodada bloqueados com cadeado e explicação |
| 15 | Rodadas → Simular encerramento | Prévia com vencedores, empates, conflitos e motivos |
| 16 | Conferir empate | Smart TV: Marina × Rafael 1.000, critério "lance registrado primeiro" + aviso de validação |
| 17 | Confirmar homologação (marcar a caixa) | Relatório abre; rodada "Homologada"; pontos consumidos |
| 18 | Abrir Rodada 2 | Rodada 2 aberta; data simulada ajustada para 04/12 09h00 |
| 19 | Participantes → Exportar CSV | Arquivo `participantes.csv` abre no Excel com acentos |
| 20 | Configurações → Exportar backup | Arquivo `.json` baixado |
| 21 | Importar o mesmo backup | Resumo → confirmação → "Backup restaurado" |
| 22 | Restaurar demonstração | Volta à Rodada 1 com dados iniciais |
| 23 | Navegar só pelo teclado (Tab, Shift+Tab, Enter, Esc) | Skip link, menus, modais com foco preso e retorno de foco |
| 24 | Largura 320 px | Sem rolagem horizontal; menu em gaveta; tabelas empilhadas |
| 25 | Largura 375 px | Saldo em destaque; CTA visível; grafismo oculto |
| 26 | Largura 768 px | Uma coluna nos formulários; filtros recolhíveis |
| 27 | Ativar "reduzir movimento" no sistema | Sem animações nem skeleton animado |
| 28 | No console: `localStorage.setItem('lna_gol2027_demo','{x')` e recarregar | Tela de recuperação com "Restaurar" e "Baixar dados corrompidos" |
| 29 | No Meu lance, clicar duas vezes rápido em "Confirmar lance" | Um único lance gravado; botão em "Processando" |
| 30 | Após homologar, tentar homologar a mesma rodada | Botão desabilitado; via API: "já foi homologada" + registro "Homologação bloqueada" |

### Verificação executada na entrega
Testes de ponta a ponta em Chrome headless: telas do operador e da gestão sem erros de console; fluxo de lance (erro → correção → confirmação → mensagem); simulação, homologação, relatório e abertura da Rodada 2; gaveta de menu com Escape e retorno de foco; tela de recuperação de dados corrompidos; sem rolagem horizontal em 320, 375 e 768 px.
