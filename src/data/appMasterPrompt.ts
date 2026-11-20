/**
 * Prompt mestre completo descrevendo toda a arquitetura, motor astronômico,
 * sistema de fusos horários, cenários 3D, controles de câmera e integrações do aplicativo.
 */
export const APP_MASTER_PROMPT = `Crie uma aplicação web completa em React, TypeScript, Tailwind CSS e Three.js (com servidor Express/Vite para APIs) chamada "Simulador Solar 3D & Fuso Horário Global", unindo mecânica celeste de alta precisão, fusos horários históricos do planeta e múltiplos cenários 3D interativos em tempo real.

1. MOTOR ASTRONÔMICO & 6 FÓRMULAS SOLARES DE ALTA PRECISÃO
Implemente os cálculos astronômicos completos (algoritmos NOAA / Jean Meeus) avaliados continuamente em tempo real:
- Passo 1 (Dia Juliano e Tempo Terrestre): Cálculo de JD_UT, Tempo Terrestre (TT = UTC + 69,184s) e Século Juliano (T).
- Passo 2 (Longitude Solar Aparente λ_app): Longitude média (L0), anomalia média solar (M), equação do centro e correção de nutação/aberração.
- Passo 3 (Declinação Solar δ e Inclinação Axial Ajustável ε): Controle deslizante e numérico da inclinação axial da Terra de 0° a 90° (Padrão Terra = 23,44°, presets Marte = 25,19°, Júpiter = 3,13°, Urano = 97,77°/82,23°), calculando sin(δ) = sin(ε) · sin(λ_app) e exibindo a direção atual (Norte +, Sul -, Equador 00,00°).
- Passo 4 (Equação do Tempo EoT dinâmica pelo ε): Fator de obliquidade y = tan²(ε/2), calculando a diferença entre Tempo Solar Verdadeiro e Tempo Solar Médio em minutos.
- Passo 5 (Ângulo Horário ω, Altitude Solar α, Zênite θ_z e Azimute Az): Cálculo exato da posição do Sol no céu a partir de latitude, longitude, hora civil, fuso horário e dia do ano, além das fases crepusculares (Dia, Crepúsculo Civil, Náutico, Astronômico e Noite), horário de Nascer do Sol, Meio-Dia Solar Verdadeiro, Pôr do Sol e Duração do Dia.
- Passo 6 (Vetor Solar 3D & Iluminação Física): Conversão esférica para coordenadas cartesianas 3D (X, Y, Z) direcionando luz solar direcional, sombras dinâmicas e domo atmosférico.

2. SISTEMA GLOBAL DE FUSOS HORÁRIOS, CALENDÁRIOS DST & 597 OPÇÕES DO COMPUTADOR
Crie uma arquitetura completa de resolução e comparação de fusos horários:
- Entrada Direta por Texto & Sliders: Edição direta via texto nos formatos DD/MM/YYYY, HH:MM:SS e deslocamento UTC +/-, além de linha do tempo interativa (Play/Pause, multiplicadores de velocidade e saltos rápidos para Nascer, Meio-Dia, Pôr do Sol e Agora).
- Classificador Geopolítico & GPS Automático: Resolução automática da zona IANA oficial por coordenadas geográficas para qualquer ponto da Terra.
- 24 Sistemas Horários no Modal "Mudar Sistema de Fuso Horário":
  • NOAA Oficial IANA histórico (com detecção da próxima transição DST exata até o minuto).
  • Sistema Horário de Cuba (America/Havana CST/CDT UTC-5 / UTC-4): regra especial mantendo Horário de Verão Contínuo (UTC-4) entre 08/03/2026 às 02:00 e 07/11/2027 às 02:00, retomando automaticamente o ciclo anual padrão após essa data, além do registro histórico de 2004–2006.
  • Sistemas globais, físicos e náuticos: Horário Solar Verdadeiro Local (baseado na longitude), Faixas Oceânicas de Meridiano 15°, Sistema Militar/Aviação NATO (letras Alfa a Zulu), Tempo Universal (UTC+0), Tempo Atômico Internacional (TAI = UTC + 37s), Tempo Terrestre / Efemérides NASA (TT = UTC + 69,184s), Swatch Internet Time (.beats @000–@999) e Fuso Manual Livre (UTC-12 a UTC+14).
- Comparador "Mesmo UTC (Regras ≠)" & Base NOAA Global:
  • Fusos brasileiros completos com histórico individual de Horário de Verão e siglas locais (BRT/BRST, AMT/AMST, ACT, FNT): Brasília/São Paulo (America/Sao_Paulo, UTC-3), Recife/PE (America/Recife, UTC-3), Salvador/BA (America/Bahia, UTC-3 com registro estadual 2011–2012), Belém/PA (America/Belem, UTC-3), Altamira / Oeste Paraense (America/Santarem, UTC-3 atual e UTC-4 histórico até 2008), Palmas/Araguaína/TO (America/Araguaina, UTC-3 com registro 2012–2013), Manaus/AM (America/Manaus, UTC-4), Cuiabá/MT (America/Cuiaba, UTC-4), Campo Grande/MS (America/Campo_Grande, UTC-4), Acre (America/Rio_Branco, UTC-5) e Fernando de Noronha (America/Noronha, UTC-2).
  • Pronúncia & Sigla Oficial por Local: Dicionário com pronúncia fonética em português e reprodução por voz (Web Speech API) da sigla e do nome completo de cada fuso horário conforme a região (ex.: BRT/BRST, AMT/AMST, ACT, FNT, CST/CDT, JST, BST, IST, etc.).
  • Comparações no mesmo UTC-5 (Cuba, Nova York, Cancún, Porto Príncipe, Turcas e Caicos, Bogotá), UTC-3 (Brasil, Argentina, Uruguai, Malvinas, Groenlândia), UTC+0/+1 (Londres, Lisboa, Marrocos com pausa do Ramadã), fusos fracionários (:30 e :45 como Índia, Nepal, St. John's, Ilhas Marquesas, Chatham, Eucla), Kiritimati (UTC+14) e Baker Island (UTC-12).
- Catálogo Completo por Cidade & Versão (597 Fusos do Computador / IANA):
  • Divisão em visualização agrupada por cidade (exibindo versão canônica atual + versões legadas/aliases) e lista completa plana.
  • Busca instantânea tolerante a acentos por cidade, país, código IANA, comentário ou UTC, com filtros por região, múltiplos aliases, horário de verão (DST) e fusos fracionários.
  • Barra de "Locais Rápidos" com atalhos diretos no painel principal.

3. CENÁRIOS 3D TERRA-HORIZONTE, CIDADES E FAZENDA (THREE.JS)
Construa o palco 3D com dois modos de visualização (Paisagem Terrestre 3D e Globo Planetário 3D) e horizonte esférico fiel à curvatura da Terra:
- Modo Globo 3D: Terra em 3D com terminador dia/noite dinâmico, grade lat/lon, eixo de rotação inclinado dinamicamente conforme ε e marcador do local ativo.
- Cenário Padrão (Terra): Paisagem natural com terreno e horizonte esférico terrestre, anel de bússola cardeal (N, L, S, O), vetores solares opcionais e Sol/Lua visíveis no domo celeste.
- Iluminação Física Realista em Todos os Mapas: Intensidade e temperatura de cor do Sol calibradas pela altitude solar real (zênite tropical, meio-dia, golden hour, crepúsculos civil/náutico/astronômico e noite), iluminação indireta da abóbada celeste (HemisphereLight) e reflexo ambiental dinâmico (sem brilho artificial à noite), luar sutil noturno, exposição adaptativa e sombras cobrindo integralmente todos os cenários (Padrão, Cidades, Fazenda, Cidade Real e Globo 3D).
- Cenários "Cidade de Carros" e "Cidade de Pessoas":
  • Cidade estruturada com quadras, ruas asfaltadas, faixas de pedestres, prédios de múltiplos andares e postes de iluminação pública.
  • Automação solar realista na iluminação urbana: postes públicos ligam automaticamente quando a altitude do Sol atinge -3,0° ou menos; janelas e luzes dos prédios acendem automaticamente quando o Sol atinge -4,5° ou menos.
  • Carros circulando pelas vias e semáforos sincronizados nos cruzamentos (quando o eixo Leste-Oeste está verde, Norte-Sul permanece vermelho, ambos passando pelo estado intermediário amarelo).
  • Diferenciação dedicada entre "Cidade de Carros" (foco viário/tráfego) e "Cidade de Pessoas" (foco em calçadas, praças e exploração a pé).
- Cenário Fazenda: Ambiente rural completo com campos, cercas, celeiro, silos, árvores e iluminação solar adaptada ao ciclo dia/noite.
- Cenário "Cidade Real" (Qualquer Cidade do Mundo + Mapa Global Integrado):
  • Mapa Global Interativo diretamente dentro da Cidade Real (Atlas Solar Mundial com terminador dia/noite, continentes, faixas horárias de 15°, 50+ metrópoles por região continental, rota ortodrômica e avião ao vivo, clique livre em qualquer coordenada da Terra e alternância opcional com Google Maps Real satélite/híbrido).
  • Busca mundial integrada (/api/city-search) e geração de geometria urbana 3D em escala metropolitana ampliada (~3,4 km) a partir de dados cartográficos/OpenStreetMap (/api/real-city via Overpass + extensão metropolitana e fallback determinístico), renderizando centenas de prédios reais com renderização instanciada, malha viária ampliada, rios, parques e corpos d'água.
  • Interatividade global completa na Cidade Real: subir no topo de qualquer prédio (clicando no edifício ou no botão de escalar prédio mais próximo), dirigir carro pelas ruas reais, levantar drone de inspeção ou voar de avião com Horário do Voo em UTC+0 (Zulu), teto máximo configurável (até 11 km) e viajar de um local do mundo para outro escolhendo o tempo de voo (mínimo de 1 segundo em Segundos, Minutos ou Horas, limitado em 24 horas) ou voo manual livre com escalas Cidade, Regional e Global atualizando coordenadas e iluminação solar do planeta em tempo real.
- Cenário "Hora Solar" (Relógio Solar de Chão 24h e Versões de Parede por Sombra Real 1:1):
  • Relógio Solar de Chão 24 Horas com leitura feita exclusivamente pela sombra física do gnômon central de H = 5,00 m (sem ponteiros artificiais), invertido de cima para baixo com padrão 12:00 no Norte (-Z) e 00:00 no Sul (+Z), 06:00 à esquerda e 18:00 à direita, com círculos métricos reais (2,5 m até 25 m na praça) e orientação ajustável em qualquer grau de 0° a 360°.
  • Física de sombra 100% real 1:1 (L = H / tan α) sem cortes artificiais no chão, penumbra angular real do disco solar de 0,533°, projeção elíptica da ponta do gnômon e atenuação atmosférica para Sol rasante.
  • Versão de Parede 100% Em Pé (90°) e Versões de Parede Inclinada (67,5° e 45°) com gnômon perpendicular de H = 2,50 m (00:00 no topo e 12:00 embaixo), com modo Automático por Hemisfério (Norte -Z no Hemisfério Sul e Sul +Z no Hemisfério Norte) e seleção livre em qualquer grau de 0° a 360° para todas as versões de parede.

4. CÂMERAS INTELIGENTES, MODO PESSOA & DRONE FPV 6-DoF
- Presets de Câmera: Órbita livre, Zênite (topo), Leste (Nascer), Oeste (Pôr), Norte, Sul, Modo Pessoa e Drone FPV.
- Regra estrita de movimento de câmera: O movimento manual de órbita/rotação da câmera só é permitido nos modos Órbita, Modo Pessoa, Drone ou dentro dos cenários urbanos/fazenda quando em câmera livre, mantendo as vistas fixas cardeais (Zênite, Norte, Sul, Leste, Oeste) travadas em seus ângulos de referência.
- Modo Pessoa: Caminhada livre pelas ruas e calçadas usando teclas W, A, S, D (e controles virtuais para touch), com rotação livre da visão por mouse ou toque.
- Câmera Drone FPV Universal: Disponível diretamente no seletor principal de câmera em todos os cenários terrestres (Padrão, Cidade Real, Cidade de Carros, Cidade de Pessoas e Fazenda), equipada com retículo de horizonte artificial, telemetria em tempo real (Altitude, Velocidade, Proa e ângulo do Gimbal) e pilotagem 6-DoF via W/A/S/D + Subir/Descer (Espaço/Shift ou D-Pad tátil).

5. PAINÉIS INTEGRADOS: FÓRMULAS SOLARES, GOOGLE MAPS & GEMINI ADVISOR
- Painel "Fórmulas Solares": Inspetor em tempo real exibindo cada fórmula bruta, resultado avaliado, variáveis em execução, seletor de Modo Visual do Mundo 3D ("Vida Real" 100% realista, "Para a Cidade" adaptado à localização local e GPS com perfil climático regional e abertura direta da Cidade Real 3D, ou "GTA Vice City" com estética Miami 1986, céu turquesa/ciano, luz dourada, sombras teal, acentos coral/rosa pastel, bloom, reflexos glossy e grão 35mm) e este Prompt Completo do aplicativo com botão de cópia rápida em 1 clique.
- Aba "Google Maps & Base NOAA": Mapa interativo para clicar e buscar qualquer coordenada da Terra, visualizador de faixas de 15°, conversão automática de fuso horário e tabela histórica NOAA completa.
- Aba "Gemini Solar Advisor": Consultor astronômico conectado à API Gemini (@google/genai) no backend com busca na web em tempo real (Google Search Grounding) e citação das fontes consultadas.`;
