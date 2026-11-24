# Leilão nas Alturas | Ambiente interno GOL — Demonstração

Aplicação demonstrativa da campanha de incentivo **Leilão nas Alturas | GOL 2027**, com perfis **Operador** e **Gestão**. Funciona 100% local, sem servidor, sem internet e sem dependências externas. **Todos os dados são fictícios.**

> Diagnóstico, padrões do site oficial, premissas e checklist: `DOCUMENTACAO.md`. Roteiro de testes: `TESTES.md`.

---

## PARTE 4 — Estrutura do projeto

```
/index.html                      Página única (SPA com rotas #/...)
/DOCUMENTACAO.md                 Partes 1, 2, 3 e 7
/README.md                       Este arquivo (Partes 4 e 6, produção, segurança)
/TESTES.md                       Roteiro manual + testes automatizados
/assets/css/tokens.css           Paleta GOL, tipografia, espaçamentos, @font-face pronto
/assets/css/base.css             Reset, foco visível, utilitários
/assets/css/layout.css           Barra de demonstração, cabeçalho, navegação, hero, rodapé
/assets/css/components.css       Botões, campos, cards, chips, avisos, tabelas, modais, toasts
/assets/css/responsive.css       1024 / 900 / 768 / 640 / 375 px
/assets/css/print.css            Impressão do relatório de homologação
/assets/js/config.js             Datas, rodadas, localidades, regras numéricas, chaves
/assets/js/validators.js         Números pt-BR, e-mail, CSV (leitura e escrita segura)
/assets/js/domain.js             Regras de negócio puras (pontos, lance, homologação)
/assets/js/mock-data.js          Dados fictícios
/assets/js/storage.js            localStorage versionado, validação, migração, backup
/assets/js/services.js           DemoStorageService + contratos BackendApi / AppsScript
/assets/js/accessibility.js      Focus trap, anúncios aria-live, menu recolhível
/assets/js/ui.js                 Componentes (sem innerHTML), ícones SVG, gráficos
/assets/js/operator.js           6 telas do operador
/assets/js/admin.js              8 telas da gestão
/assets/js/app.js                Inicialização, rotas, cabeçalho, Controles da demonstração
/assets/images/logo-gol-fundo-claro.png    Logo oficial (PowerPoint, slide "Logos")
/assets/images/logo-gol-fundo-escuro.png   Logo oficial para fundos escuros
/assets/images/logo-gol-fundo-laranja.png  Logo oficial para fundo laranja
/assets/fonts/                   Local para os .woff2 da GOL Sans (vazio)
/tests/domain.tests.js           37 testes de regras
/tests/run-node.js               Executor em Node.js
/tests/index.html, run-browser.js  Executor no navegador
```

**Por que scripts clássicos e não ES modules?** Navegadores bloqueiam `type="module"` quando a página é aberta com duplo clique (`file://`). Cada arquivo registra seu módulo em um único namespace (`window.LNA`), sem variáveis globais soltas.

**Camadas:** `config` → `domain` (puro, testável em Node) → `storage` → `services` (única porta de entrada da interface) → `ui` → `operator`/`admin` → `app`. A interface nunca acessa o localStorage nem aplica regra de negócio por conta própria; o serviço revalida tudo.

---

## PARTE 6 — Instruções

### Como salvar e abrir
1. Descompacte a pasta `leilao-nas-alturas` mantendo a estrutura.
2. Dê duplo clique em `index.html` (Chrome, Edge, Firefox ou Safari atualizados).
3. Opcional, para simular um servidor: na pasta, rode `python -m http.server 8080` e acesse `http://localhost:8080`.

### Como testar os perfis
Na faixa grafite do topo, **Controles da demonstração → Abrir controles**:
- **Perfil**: Operador ou Gestão.
- **Participante**: Alex (Aracaju), Marina (Maceió) ou Lucas (Montes Claros).

Sugestão de apresentação: entre como Alex, faça um lance na Bicicleta; troque para Gestão → Rodadas → Simular encerramento → Confirmar homologação; volte como Marina para ver o prêmio conquistado.

### Como alterar a data
Controles da demonstração → **Data simulada**, ou Gestão → Configurações da demonstração (atalhos "Ir para Rodada 2", etc.). Para usar a data do computador, escolha **Relógio: Data real**. A data inicial é 02/12/2027 10h00 (Rodada 1 aberta).

### Como resetar
Controles da demonstração → **Restaurar demonstração** (pede confirmação). Se os dados salvos estiverem corrompidos, a aplicação mostra uma tela de recuperação com as opções "Restaurar" e "Baixar dados corrompidos".

### Como trocar o logo
Substitua os arquivos em `assets/images/` mantendo os nomes: `logo-gol-fundo-claro.png` (cabeçalho), `logo-gol-fundo-escuro.png` (rodapé) e `logo-gol-fundo-laranja.png` (reserva para áreas laranja). Proporção 2,44:1 (ex.: 488 × 200 px, ou SVG). Não aplique sombra, recorte ou efeito.

### Como instalar a GOL Sans
1. Obtenha os arquivos licenciados `.woff2` com a área de marca.
2. Salve em `assets/fonts/` como `GOLSans-Regular.woff2`, `GOLSans-Medium.woff2`, `GOLSans-Bold.woff2` e `GOLSans-XBold.woff2`.
3. Em `assets/css/tokens.css`, remova o comentário do bloco `@font-face`.
A pilha `--font-family` já começa por `"GOL Sans"`; sem os arquivos, usa Arial/Helvetica.

### Como substituir os dados fictícios
Edite `assets/js/mock-data.js` (participantes, perfis de atingimento, prêmios, lances de exemplo) e clique em **Restaurar demonstração**. Localidades e datas ficam em `config.js`. Nunca use dados reais de colaboradores.

### Como importar CSV de pontuação
Gestão → Pontuação → **Importação simulada por CSV** → "Baixar modelo". Formato (separador `;` ou `,`):
```
nome;email;mes;atingimento
Alex Silva;operador1@exemplo.test;2027-11;112,5
```
Clique em **Validar arquivo**, revise válidos/inválidos/duplicados e os pontos que serão gerados, e confirme.

### Como exportar e importar backup
Gestão → Configurações da demonstração → **Exportar backup JSON**. Para restaurar, escolha o arquivo e clique em **Validar e importar backup**; um resumo aparece antes da substituição.

### Como migrar para backend
1. Implemente `createBackendApiService()` em `services.js` com **os mesmos métodos e formatos de resposta** do `DemoStorageService` (`getOperatorDashboard`, `submitBid`, `simulateHomologation`, `confirmHomologation`, etc.).
2. Em `app.js`, troque `LNA.services.createDemoService()` pela nova fábrica.
3. Porte `domain.js` para o servidor (ele não depende de DOM) e **revalide no servidor** toda regra: saldo, rodada, incremento, elegibilidade, desempate, assinatura da prévia.
4. Remova a barra de demonstração e o seletor de perfil; o perfil passa a vir do token corporativo.
5. Substitua o relógio simulado pela hora do servidor.

---

## Segurança

O que foi feito nesta versão: nenhuma inserção de dados em `innerHTML` (toda a interface é montada com `createElement`/`textContent`); nenhum `eval`, `new Function`, evento inline ou recurso de CDN; validação de entradas e números; bloqueio de envio duplicado (trava por operação + `requestId`); confirmação em ações destrutivas; erros sem stack trace; CSV com neutralização de fórmulas; operador recebe do serviço apenas os próprios dados.

O que **não** existe: autenticação, autorização real, proteção contra edição pelo console do navegador, auditoria imutável. **Este protótipo não é seguro para produção.**

### Content Security Policy recomendada (para quando houver servidor)
```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self';
  img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://<api-corporativa>;
  form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'
```
Ela não é aplicada por `<meta>` nesta versão porque navegadores tratam `'self'` de forma inconsistente em `file://`, o que poderia impedir a abertura local. Estilos dinâmicos usam CSSOM (`el.style`), compatível com essa política.

---

## Requisitos para produção

- **Autenticação corporativa com Microsoft Entra ID** (SSO, MFA conforme política).
- **Autorização por perfil** (operador, gestão, auditoria) validada no servidor em cada requisição.
- **API segura** (HTTPS, tokens de curta duração, rate limiting, validação de esquema).
- **Banco de dados** relacional com chaves únicas (ex.: um lance ativo por participante/rodada).
- **Validações no servidor** de todas as regras de `domain.js`.
- **Controle de concorrência** (bloqueio otimista por versão; fila ou lock na homologação).
- **Transações** atômicas na homologação e na importação.
- **Versionamento de registros** (lances, prêmios, pontuação) sem exclusão física.
- **Auditoria imutável** (append-only, assinada ou em serviço dedicado), com retenção definida.
- **Logs** técnicos sem dados pessoais desnecessários.
- **Backup** automático com teste de restauração.
- **LGPD**: base legal, minimização, prazo de retenção, aviso aos participantes, controle de acesso a e-mails.
- **Monitoramento** e alertas (erros, latência, picos no fim das rodadas).
- **Tratamento de incidentes** com responsáveis e plano de comunicação.
- **Testes de segurança** (pentest, análise estática, dependências).
- **Homologação da área de negócio**: critério de desempate, prioridade após atualização de lance, regras de repescagem e de reversão.
