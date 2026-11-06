import { prisma } from '../lib/prisma';

export async function ensureSeededStories() {
  const count = await prisma.story.count();
  if (count > 0) {
    return;
  }

  console.log('[Seed] Populating initial reach.news multi-source stories...');

  const initialStories = [
    {
      slug: 'nothing-confirms-screenless-ai-native-device-december',
      category: 'technology',
      topicTagPt: 'Tecnologia Vestível',
      topicTagEn: 'Wearable Technology',
      titlePt: "Nothing confirma que dispositivo 'AI-Native' sem tela será lançado em dezembro",
      titleEn: "Nothing Confirms Screen-less 'AI-Native' Device Will Ship in December",
      summaryPt:
        'A empresa afirma que a ferramenta sem tela foi construída para capturar contexto fugaz do dia a dia e sinaliza uma transição ousada para wearables focados em IA.',
      summaryEn:
        'The company says the unnamed, display-free tool is built to capture fleeting context and signals a move toward AI-first wearables.',
      bulletPointsPt: [
        'Carl Pei revelou que o novo hardware sem tela da Nothing entra em produção comercial para envio já em dezembro.',
        'Diferente do Humane AI Pin, o dispositivo foca em captura contínua de áudio e contexto ambiental integrado ao ecossistema Android.',
        'O processamento híbrido combina modelos locais leves com roteamento em nuvem de baixa latência.',
        'Analistas apontam que o preço competitivo será decisivo para evitar os erros da primeira geração de wearables de IA.',
      ],
      bulletPointsEn: [
        'Carl Pei confirmed Nothing’s new display-free AI hardware will begin shipping to early buyers in December.',
        'Unlike earlier standalone pins, the device focuses on ambient context capture deeply paired with smartphones.',
        'Hybrid edge-to-cloud inference routes complex reasoning queries while keeping voice wake words local.',
        'Industry analysts view pricing and battery longevity as the make-or-break factors for screenless form factors.',
      ],
      perspectivesPt: [
        {
          label: 'Entusiastas de Hardware & IA',
          stance: 'Otimista',
          summary:
            'Acreditam que a Nothing tem o design industrial e a integração de ecossistema necessários para acertar onde Humane e Rabbit falharam.',
        },
        {
          label: 'Analistas de Mercado Mobile',
          stance: 'Cauteloso',
          summary:
            'Questionam se consumidores realmente desejam mais um gadget sem tela quando smartphones e fones já possuem assistentes de voz avançados.',
        },
        {
          label: 'Especialistas em Privacidade',
          stance: 'Crítico',
          summary:
            'Alertam para as implicações éticas e regulatórias de dispositivos vestíveis projetados para capturar "contexto ambiental contínuo".',
        },
      ],
      perspectivesEn: [
        {
          label: 'Hardware & AI Enthusiasts',
          stance: 'Bullish',
          summary:
            'Argue Nothing possesses the industrial design pedigree and smartphone integration needed to succeed where Humane and Rabbit struggled.',
        },
        {
          label: 'Mobile Market Analysts',
          stance: 'Cautious',
          summary:
            'Question whether consumers want an additional companion gadget when earbuds and phones already handle voice AI.',
        },
        {
          label: 'Privacy Advocates',
          stance: 'Critical',
          summary:
            'Raise concerns over always-on ambient context capture in public and workplace environments.',
        },
      ],
      fullArticlePt: `## A aposta silenciosa da Nothing em um mundo pós-tela

A fabricante britânica **Nothing**, comandada por Carl Pei, confirmou oficialmente que seu primeiro dispositivo vestível construído nativamente para inteligência artificial — e projetado inteiramente sem tela — começará a ser enviado aos primeiros compradores já em dezembro. O anúncio marca a entrada definitiva da marca londrina no disputado segmento de hardware contextual, com a promessa de capturar ideias, conversas e momentos fugazes do cotidiano sem exigir que o usuário desbloqueie o smartphone a cada minuto.

Enquanto gigantes do Vale do Silício tentam empurrar óculos inteligentes ou broches autônomos que pretendem substituir o celular de forma abrupta, a engenharia da Nothing escolheu um caminho mais pragmático. O novo equipamento nasce como uma extensão sensorial ultraleve do ecossistema Android e dos fones de ouvido da marca, priorizando velocidade de resposta, autonomia de bateria para o dia inteiro e discrição no uso público.

## Aprendendo com os tropeços da primeira geração de wearables de IA

O mercado de dispositivos dedicados à inteligência artificial atravessou um verdadeiro choque de realidade nos últimos meses. Lançamentos cercados de expectativa, como o *Humane AI Pin* e o *Rabbit R1*, enfrentaram duras críticas da imprensa especializada devido ao superaquecimento, lentidão nas respostas em nuvem, projetores a laser de baixa visibilidade sob a luz do sol e assinaturas mensais caras.

Nos bastidores de Londres, a equipe de produto da Nothing estudou cada uma dessas falhas antes de aprovar o design industrial do novo aparelho. A conclusão foi direta: o consumidor moderno não quer abandonar a tela de alta resolução que já carrega no bolso para tarefas visuais, mas sente falta de um gatilho imediato para registrar pensamentos e consultar informações rápidas enquanto caminha, dirige ou participa de reuniões.

> "O nosso objetivo nunca foi criar mais um retângulo brilhante competindo pela sua atenção visual, mas construir uma ponte invisível entre o pensamento humano e a ação imediata", destacaram executivos da Nothing em conversas com analistas do setor.

## Arquitetura híbrida e roteamento inteligente de modelos

Do ponto de vista técnico, a grande evolução do dispositivo está na forma como ele distribui o processamento entre o chip local e a nuvem. Microfones direcionais com cancelamento de ruído neural capturam comandos em voz baixa e acionam um modelo compacto embarcado apenas para triagem instantânea de intenção.

Quando a solicitação exige pesquisa em tempo real na web, síntese de múltiplos documentos ou integração com a agenda e aplicativos de mensagens, o sistema utiliza um roteador inteligente de baixa latência capaz de consultar os melhores modelos fundacionais disponíveis em frações de segundo. Essa arquitetura reduz drasticamente o consumo energético e elimina o incômodo silêncio de cinco segundos que arruinou a experiência dos primeiros concorrentes.

## O que esperar do lançamento comercial em dezembro

A chegada do produto às vésperas das festas de fim de ano coloca a Nothing em posição privilegiada para testar o apetite real do público por acessórios de memória assistida. Analistas de mercado apontam que o fator decisivo será a política de preços: se a empresa mantiver sua tradição de oferecer design arrojado por uma fração do valor cobrado pelas gigantes tradicionais, o dispositivo poderá finalmente inaugurar uma categoria viável de computação ambiental.`,
      fullArticleEn: `## Nothing’s Calculated Bet on a Post-Screen Ambient Future

London-based consumer technology company **Nothing**, led by co-founder Carl Pei, has officially confirmed that its first purpose-built **'AI-Native'** wearable—engineered entirely without a display—will begin shipping to customers in December. The move marks a bold expansion beyond smartphones and transparent earbuds into ambient computing hardware designed to capture fleeting thoughts and real-world context without pulling users into another glowing screen.

Rather than attempting to kill the smartphone overnight, Nothing’s industrial design and software teams have crafted a companion device that acts as an immediate sensory bridge. By pairing tactile physical controls with directional voice capture, the hardware aims to solve the friction of everyday digital note-taking, scheduling, and instant fact-checking.

## Learning from First-Generation AI Hardware Missteps

The announcement arrives at a delicate moment for dedicated AI gadgets. Early pioneers like the *Humane AI Pin* and *Rabbit R1* stumbled out of the gate, hampered by sluggish cloud round-trips, thermal throttling, awkward laser projection interfaces, and steep recurring subscription fees.

Inside Nothing’s London headquarters, engineers treated those high-profile stumbles as a roadmap of what to avoid. By stripping away power-hungry projectors and redundant camera gimbles, the company focused on acoustic clarity, instant wake-word responsiveness, and deep operating-system integration with Nothing OS and modern Android flagships.

> "Our goal isn't to build another glowing rectangle competing for your eyeballs, but an effortless, invisible bridge between human thought and digital action," company executives noted during industry briefings.

## Hybrid Edge-to-Cloud Inference Architecture

Under the hood, the wearable relies on a dual-tier processing pipeline. Lightweight on-device neural processors handle voice activity detection, encryption, and quick local reminders, ensuring near-zero latency for everyday micro-interactions.

When a user asks a complex research question or requests a synthesis of the morning’s news and calendar briefings, the companion app routes the query through a high-speed multi-model gateway. This hybrid approach preserves all-day battery life while delivering frontier-grade reasoning on demand.

## Market Outlook Ahead of the December Rollout

As the first production units prepare to ship in December, industry observers will closely watch consumer adoption and pricing strategy. If Nothing delivers its signature transparent aesthetic and tactile polish at an accessible price point, it could prove that screenless AI wearables were never a flawed concept—only waiting for the right execution.`,
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=85',
      dominantColor: '#1e78bd',
      secondaryColor: '#0f4c81',
      articleCount: 14,
      isRadarGenerated: false,
      sources: [
        {
          name: 'The Verge',
          title: 'Nothing confirms its screen-less AI-native device ships in December',
          url: 'https://www.theverge.com/tech',
          domain: 'theverge.com',
          publishedAt: '2h ago',
          snippet: 'The London tech company says its display-free wearable is built to capture fleeting context.',
        },
        {
          name: 'TechCrunch',
          title: 'Why Nothing believes ambient AI wearables still have a massive future',
          url: 'https://techcrunch.com/category/artificial-intelligence/',
          domain: 'techcrunch.com',
          publishedAt: '4h ago',
          snippet: 'Carl Pei outlines a companion-first strategy for AI hardware arriving this holiday season.',
        },
        {
          name: 'Wired',
          title: 'The race to build the post-smartphone AI interface heats up again',
          url: 'https://www.wired.com/tag/artificial-intelligence/',
          domain: 'wired.com',
          publishedAt: '6h ago',
          snippet: 'Industrial designers are moving away from screens toward voice and tactile memory devices.',
        },
        {
          name: 'Ars Technica',
          title: 'Inside the edge-to-cloud AI routing powering next-gen wearables',
          url: 'https://arstechnica.com/ai/',
          domain: 'arstechnica.com',
          publishedAt: '9h ago',
          snippet: 'Latency and battery constraints push hardware makers toward smart multi-model gateways.',
        },
      ],
    },
    {
      slug: 'enterprise-ai-autonomous-agents-reshape-software-engineering',
      category: 'technology',
      topicTagPt: 'IA Corporativa',
      topicTagEn: 'Enterprise AI',
      titlePt: 'Roteadores de IA Multi-Modelo e Agentes Autônomos Redefinem a Arquitetura Corporativa',
      titleEn: 'Multi-Model AI Routers and Autonomous Agents Reshape Enterprise Architecture',
      summaryPt:
        'Grandes empresas estão abandonando o lock-in de um único provedor de LLM em favor de gateways unificados com fallback automático e agentes de pesquisa em tempo real.',
      summaryEn:
        'Organizations are rapidly moving away from single-vendor LLM lock-in toward unified gateways with automatic failover and real-time research agents.',
      bulletPointsPt: [
        'Mais de 68% das equipes de engenharia adotaram arquiteturas multi-modelo para reduzir custos e evitar quedas de API.',
        'Gateways compatíveis com OpenAI (como OmniRoute) permitem alternar entre Gemini, Claude, GPT e DeepSeek em milissegundos.',
        'Agentes com Function Calling e busca na web substituem pipelines estáticos de RAG em aplicações críticas.',
        'Redução média de 42% na latência e 55% nos custos operacionais de inferência em produção.',
      ],
      bulletPointsEn: [
        'Over 68% of engineering teams have shifted to multi-model routing to prevent provider outages and rate-limit bottlenecks.',
        'Unified OpenAI-compatible gateways allow seamless millisecond failover across Gemini, Claude, OpenAI, and DeepSeek.',
        'Tool-calling research agents are rapidly replacing brittle static RAG pipelines across enterprise workflows.',
        'Benchmarks show an average 42% latency improvement and 55% reduction in token spend.',
      ],
      perspectivesPt: [
        {
          label: 'CTOs & Arquitetos de Software',
          stance: 'Entusiasta',
          summary:
            'Destacam que o roteamento inteligente garante resiliência de 99,99% mesmo quando provedores individuais sofrem instabilidades.',
        },
        {
          label: 'Equipes de FinOps',
          stance: 'Focado em Eficiência',
          summary:
            'Apontam que direcionar tarefas simples para modelos leves e reservar modelos frontier para síntese complexa corta custos drasticamente.',
        },
        {
          label: 'Segurança da Informação',
          stance: 'Prioridade Local',
          summary:
            'Valorizam gateways self-hosted que mantêm chaves de API, logs de auditoria e políticas de acesso sob controle interno.',
        },
      ],
      perspectivesEn: [
        {
          label: 'CTOs & Systems Architects',
          stance: 'Bullish',
          summary:
            'Emphasize that multi-tier failover guarantees high availability even during major upstream cloud outages.',
        },
        {
          label: 'FinOps & Engineering Leads',
          stance: 'Efficiency-Focused',
          summary:
            'Highlight dramatic cost savings by dynamically routing simple classifications to fast models and deep synthesis to frontier LLMs.',
        },
        {
          label: 'Security & Compliance Teams',
          stance: 'Local-First',
          summary:
            'Favor self-hosted AI gateways that keep credentials, telemetry, and governance policies on private infrastructure.',
        },
      ],
      fullArticlePt: `## O Fim do Monopólio de Modelo Único nas Empresas\n\nA arquitetura de inteligência artificial corporativa passou por uma transformação silenciosa, porém definitiva. Em vez de acoplar sistemas inteiros a uma única API proprietária, empresas de tecnologia estão adotando **roteadores inteligentes multi-modelo** capazes de orquestrar dezenas de provedores simultaneamente.\n\n## Resiliência, Fallback em Milissegundos e Soberania\n\nQuando uma aplicação depende de síntese em tempo real — como plataformas jornalísticas automatizadas e radares de mercado — atingir um limite de cota (*rate limit*) ou enfrentar uma queda de servidor interrompe toda a operação. Com gateways locais compatíveis com o padrão OpenAI, o tráfego é redirecionado automaticamente entre provedores primários, secundários e modelos gratuitos.\n\n## Agentes de Pesquisa com Function Calling\n\nOutro pilar dessa revolução é a combinação de LLMs com ferramentas externas de busca na web e leitura de feeds RSS. Em vez de depender apenas do conhecimento estático de treinamento, o agente executa buscas verificadas, extrai o conteúdo das fontes primárias e redige dossiês bilíngues completos.`,
      fullArticleEn: `## The End of Single-Vendor LLM Lock-In\n\nEnterprise AI architecture has undergone a decisive shift. Rather than hardcoding production systems against a single proprietary provider, engineering organizations are standardizing on **multi-model AI routers** capable of orchestrating dozens of upstream models through a single unified endpoint.\n\n## Millisecond Failover and Cost Intelligence\n\nFor real-time applications—such as automated newsrooms, live market radars, and customer synthesis engines—hitting a rate limit or upstream outage is unacceptable. Local-first gateways automatically reroute requests across primary subscriptions, secondary API keys, and fallback models in milliseconds.\n\n## Tool-Calling Research Agents\n\nEqually transformative is the rise of agentic function calling. By equipping models with live web search, RSS ingestion, and HTML scraping tools, platforms can synthesize verified, multi-perspective journalism on the fly.`,
      imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1000&q=85',
      dominantColor: '#1d4ed8',
      secondaryColor: '#1e3a8a',
      articleCount: 38,
      isRadarGenerated: false,
      sources: [
        {
          name: 'VentureBeat',
          title: 'Why multi-model AI routing is becoming mandatory for enterprise stacks',
          url: 'https://venturebeat.com/ai/',
          domain: 'venturebeat.com',
          publishedAt: '3h ago',
          snippet: 'Engineering leaders are adopting unified gateways to eliminate downtime and optimize token spend.',
        },
        {
          name: 'InfoQ',
          title: 'Designing resilient LLM gateways with multi-tier auto-fallback',
          url: 'https://www.infoq.com/ai-ml-data-eng/',
          domain: 'infoq.com',
          publishedAt: '5h ago',
          snippet: 'Architectural patterns for routing OpenAI-compatible requests across heterogeneous model providers.',
        },
        {
          name: 'MIT Technology Review',
          title: 'Autonomous web research agents move from lab demos to production workflows',
          url: 'https://www.technologyreview.com/topic/artificial-intelligence/',
          domain: 'technologyreview.com',
          publishedAt: '8h ago',
          snippet: 'Function calling and multi-source verification reduce hallucinations in automated reporting.',
        },
      ],
    },
    {
      slug: 'planetary-science-europa-subsurface-ocean-plumes-webb',
      category: 'science',
      topicTagPt: 'Ciência Planetária',
      topicTagEn: 'Planetary Science',
      titlePt: 'Telescópio James Webb Detecta Assinaturas Químicas Inéditas nas Plumas de Europa e Encélado',
      titleEn: 'James Webb Telescope Detects Complex Carbon Signatures in Subsurface Ocean Plumes',
      summaryPt:
        'Cientistas planetários confirmaram a presença de compostos orgânicos complexos expelidos por gêiseres gelados, reforçando o potencial de habitabilidade no Sistema Solar externo.',
      summaryEn:
        'Planetary scientists confirmed complex organic molecules venting from icy moons, strengthening the case for habitable ocean worlds in the outer Solar System.',
      bulletPointsPt: [
        'Espectrógrafos infravermelhos identificaram dióxido de carbono e traços orgânicos recém-emergidos do oceano subterrâneo.',
        'Os dados cruzados de 23 artigos científicos confirmam que o carbono tem origem interna e não de meteoritos externos.',
        'As descobertas vão guiar as trajetórias de sobrevoo das missões Europa Clipper e JUICE.',
        'Pesquisadores destacam fontes hidrotermais no fundo oceânico como principal hipótese energética.',
      ],
      bulletPointsEn: [
        'Near-infrared spectrographs pinpointed carbon dioxide and organic traces freshly vented from subsurface liquid oceans.',
        'Cross-referenced findings across 23 reports confirm the carbon originates from the interior ocean rather than surface impacts.',
        'The discovery directly informs target selection for upcoming Europa Clipper and ESA JUICE flybys.',
        'Astrobiologists point to deep seafloor hydrothermal vents as the primary chemical driver.',
      ],
      perspectivesPt: [
        {
          label: 'Astrobiólogos da NASA/ESA',
          stance: 'Empolgado',
          summary:
            'Consideram a detecção de carbono endógeno o indício mais forte até hoje de que oceanos cobertos por gelo possuem os ingredientes químicos essenciais à vida.',
        },
        {
          label: 'Geoquímicos Planetários',
          stance: 'Metódico',
          summary:
            'Ressaltam que a presença de compostos de carbono indica processos hidrotermais ativos, mas requer amostragem direta das plumas para confirmar cadeias biológicas.',
        },
      ],
      perspectivesEn: [
        {
          label: 'NASA & ESA Astrobiologists',
          stance: 'Excited',
          summary:
            'View endogenous carbon compounds as the strongest evidence yet that icy moons harbor chemically active, habitable environments.',
        },
        {
          label: 'Planetary Geochemists',
          stance: 'Methodical',
          summary:
            'Note that while hydrothermal chemistry is likely active, direct plume sampling during upcoming flybys is required to confirm complex prebiotic chains.',
        },
      ],
      fullArticlePt: `## Oceanos Ocultos e Química Pré-Biótica no Sistema Solar\n\nNovas observações conduzidas pelo **Telescópio Espacial James Webb (JWST)** revelaram assinaturas químicas detalhadas nas regiões geologicamente ativas das luas geladas de Júpiter e Saturno. Ao analisar o espectro infravermelho da luz refletida e das plumas de vapor, equipes internacionais confirmaram que o carbono detectado na superfície provém diretamente do oceano líquido subterrâneo.\n\n## Por Que Essa Descoberta Muda Tudo\n\nDurante décadas, cientistas debateram se o oceano salgado sob a crosta de gelo de **Europa** interagia quimicamente com seu núcleo rochoso. A concentração de dióxido de carbono em terrenos caóticos jovens comprova que há transporte ativo de material entre o fundo do mar e a superfície.\n\n## Implicações para as Missões Europa Clipper e JUICE\n\nCom 23 publicações e comunicados científicos consolidados hoje, os engenheiros de navegação espacial já planejam ajustar os sensores de espectrometria de massa das sondas para atravessar diretamente as regiões de maior atividade criovulcânica.`,
      fullArticleEn: `## Hidden Oceans and Prebiotic Chemistry in the Outer Solar System\n\nNew spectroscopic observations from the **James Webb Space Telescope (JWST)** have unveiled striking chemical signatures across the geologically active terrains of Jupiter's and Saturn's icy moons. International research teams confirmed that carbon-bearing molecules concentrated in fractured chaos regions originate directly from the subsurface liquid ocean.\n\n## Why Endogenous Carbon Matters\n\nFor decades, planetary scientists debated whether the deep global ocean beneath **Europa's** icy shell chemically interacts with a rocky seafloor. The detection of freshly deposited carbon dioxide proves active vertical transport between the deep interior and the surface.\n\n## Guiding Europa Clipper and ESA's JUICE\n\nSynthesizing 23 scientific reports and mission briefings, mission planners are now refining flyby trajectories so onboard mass spectrometers can directly sample cryovolcanic plumes.`,
      imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1000&q=85',
      dominantColor: '#a18c07',
      secondaryColor: '#716204',
      articleCount: 23,
      isRadarGenerated: false,
      sources: [
        {
          name: 'NASA Science',
          title: 'Webb Telescope identifies internal carbon source on Jupiter’s moon Europa',
          url: 'https://science.nasa.gov/',
          domain: 'nasa.gov',
          publishedAt: '5h ago',
          snippet: 'Spectroscopic data indicates carbon dioxide originated in the subsurface ocean.',
        },
        {
          name: 'Nature Astronomy',
          title: 'Endogenous CO2 and cryovolcanic transport on icy ocean worlds',
          url: 'https://www.nature.com/natastron/',
          domain: 'nature.com',
          publishedAt: '7h ago',
          snippet: 'High-resolution infrared mapping links surface chaos terrain to deep interior chemistry.',
        },
        {
          name: 'Space.com',
          title: 'How JWST findings are shaping the Europa Clipper science playbook',
          url: 'https://www.space.com/',
          domain: 'space.com',
          publishedAt: '11h ago',
          snippet: 'Mission scientists prepare to fly directly through potential water vapor plumes.',
        },
      ],
    },
    {
      slug: 'global-central-banks-digital-infrastructure-ai-productivity',
      category: 'economics',
      topicTagPt: 'Economia Global',
      topicTagEn: 'Global Economics',
      titlePt: 'Bancos Centrais Avaliam Choque de Produtividade da IA no Ciclo de Juros e Investimentos',
      titleEn: 'Central Banks Weigh AI Infrastructure Boom Against Global Interest Rate Trajectories',
      summaryPt:
        'Relatórios de política monetária apontam que o investimento trilionário em data centers, energia limpa e automação está redesenhando as projeções de PIB e inflação.',
      summaryEn:
        'Monetary policy reports indicate trillion-dollar capital expenditure in data centers, grid power, and automation is reshaping GDP and inflation forecasts.',
      bulletPointsPt: [
        'Investimentos globais em infraestrutura de IA e energia ultrapassaram US$ 450 bilhões no último ciclo anual.',
        'Economistas dividem-se entre o efeito desinflacionário do ganho de produtividade no médio prazo e a pressão imediata sobre custos de energia.',
        'Mercados emergentes, incluindo o Brasil, atraem novos polos de data centers graças à matriz elétrica renovável.',
        'Bolsas globais registram rotação para empresas de semicondutores, redes elétricas e software corporativo.',
      ],
      bulletPointsEn: [
        'Global capital expenditure on AI data centers and grid modernization surpassed $450B over the past annual cycle.',
        'Economists debate medium-term disinflationary productivity gains versus near-term power and supply chain pressures.',
        'Emerging markets with clean hydro and solar grids, including Brazil, are attracting hyperscale infrastructure.',
        'Equity markets show sustained rotation into semiconductors, utilities, and enterprise automation.',
      ],
      perspectivesPt: [
        {
          label: 'Economistas de Política Monetária',
          stance: 'Estrutural',
          summary:
            'Avaliam que o ganho de produtividade por trabalhador pode elevar o crescimento potencial do PIB sem gerar inflação salarial.',
        },
        {
          label: 'Analistas de Energia & Infraestrutura',
          stance: 'Alerta',
          summary:
            'Destacam que o gargalo físico de transformadores e transmissão elétrica é o maior desafio para o ritmo de expansão.',
        },
      ],
      perspectivesEn: [
        {
          label: 'Monetary Policy Economists',
          stance: 'Structural',
          summary:
            'Argue AI-driven output per worker could raise potential GDP growth without triggering wage-push inflation.',
        },
        {
          label: 'Energy & Grid Analysts',
          stance: 'Cautious',
          summary:
            'Warn that physical bottlenecks in transformers and power transmission remain the primary constraint on expansion.',
        },
      ],
      fullArticlePt: `## O Novo Ciclo de Capex Tecnológico e a Macroeconomia\n\nO volume extraordinário de capital direcionado para data centers de hiperescala, semicondutores avançados e modernização de redes elétricas entrou oficialmente no radar dos principais Bancos Centrais do mundo. Segundo 31 relatórios econômicos sintetizados pelo **reach.news**, o chamado "superciclo de infraestrutura de IA" já responde por uma parcela expressiva do crescimento do investimento privado.\n\n## Produtividade Desinflacionária vs. Demanda Energética\n\nO debate central entre formuladores de política monetária gira em torno do tempo de maturação desses investimentos. No curto prazo, a construção acelerada de infraestrutura pressiona insumos industriais e demanda elétrica. No médio prazo, contudo, a automação cognitiva reduz custos operacionais em setores de serviços, finanças, saúde e logística.\n\n## Oportunidade para Matrizes Renováveis\n\nPaíses com forte oferta de energia limpa e abundante — com destaque para o Brasil na América Latina — passaram a figurar no topo da lista de expansão de grandes operadores globais que buscam conciliar metas de descarbonização com poder computacional.`,
      fullArticleEn: `## The Tech Capex Supercycle Enters Central Bank Playbooks\n\nThe unprecedented wave of capital flowing into hyperscale data centers, custom silicon, and electrical grid upgrades has become a central variable for global monetary policymakers. Across 31 economic briefings synthesized by **reach.news**, analysts note that AI infrastructure investment is now a primary driver of private non-residential fixed investment.\n\n## Disinflationary Productivity vs. Near-Term Resource Demand\n\nCentral bankers are closely modeling two competing forces: in the near term, massive physical buildouts increase demand for copper, power generation, and specialized labor. Over the medium term, cognitive automation across software, finance, healthcare, and logistics is projected to expand supply-side productivity.\n\n## Clean Grid Geographies Gain Strategic Edge\n\nRegions with abundant renewable baseload power—including Latin America's clean hydro and wind corridors—are increasingly favored by hyperscalers seeking sustainable compute capacity.`,
      imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1000&q=85',
      dominantColor: '#047857',
      secondaryColor: '#064e3b',
      articleCount: 31,
      isRadarGenerated: false,
      sources: [
        {
          name: 'Bloomberg',
          title: 'Central banks examine how AI productivity shifts the neutral interest rate',
          url: 'https://www.bloomberg.com/economics',
          domain: 'bloomberg.com',
          publishedAt: '4h ago',
          snippet: 'Policymakers weigh surging infrastructure capex against long-term disinflationary efficiency.',
        },
        {
          name: 'Financial Times',
          title: 'The global race for clean gigawatts to power next-gen compute clusters',
          url: 'https://www.ft.com/global-economy',
          domain: 'ft.com',
          publishedAt: '6h ago',
          snippet: 'Energy grids and renewable corridors become the new kingmakers in digital infrastructure.',
        },
      ],
    },
    {
      slug: 'diplomacy-global-ai-safety-governance-treaty-summit',
      category: 'politics',
      topicTagPt: 'Governança & Política',
      topicTagEn: 'Global Governance',
      titlePt: 'Coalizão Internacional Firma Acordo sobre Padrões Abertos e Transparência em IA',
      titleEn: 'International Coalition Signs Accord on Open AI Standards and Algorithmic Transparency',
      summaryPt:
        'Representantes de 40 países estabeleceram diretrizes para auditoria de modelos fundacionais, preservando incentivos para o ecossistema open-source e pesquisa acadêmica.',
      summaryEn:
        'Delegates from 40 nations established interoperability and auditing guidelines for frontier models while protecting open-source research.',
      bulletPointsPt: [
        'O acordo cria protocolos mútuos de avaliação de segurança sem impor barreiras a modelos open-weight.',
        'Empresas jornalísticas e criadores de conteúdo ganharam novos mecanismos de atribuição de fonte e transparência.',
        'O Brasil teve papel de destaque defendendo soberania digital e infraestrutura pública de dados.',
      ],
      bulletPointsEn: [
        'The accord establishes mutual safety evaluation protocols while explicitly exempting open-weight academic research.',
        'News publishers and creators secured standardized source-attribution and provenance frameworks.',
        'Emerging economies championed digital sovereignty and interoperable public AI infrastructure.',
      ],
      perspectivesPt: [
        {
          label: 'Comunidade Open-Source',
          stance: 'Favorável',
          summary:
            'Celebra a proteção explícita aos modelos abertos e roteadores locais como essenciais para evitar concentração de mercado.',
        },
        {
          label: 'Veículos de Imprensa',
          stance: 'Apoio com Ressalvas',
          summary:
            'Aprovam a exigência de citação direta e links para as fontes originais, modelo já adotado por agregadores modernos.',
        },
      ],
      perspectivesEn: [
        {
          label: 'Open-Source Community',
          stance: 'Supportive',
          summary:
            'Welcomes explicit protections for open-weight models and local routing infrastructure.',
        },
        {
          label: 'News Publishers',
          stance: 'Constructive',
          summary:
            'Endorse mandatory source attribution and transparent linking to original reporting.',
        },
      ],
      fullArticlePt: `## Um Novo Consenso para Governança Digital\n\nLíderes governamentais, pesquisadores e representantes da sociedade civil de 40 nações concluíram hoje um novo marco de cooperação internacional voltado à transparência algorítmica e interoperabilidade de sistemas de inteligência artificial.\n\n## Proteção ao Open-Source e Atribuição Jornalística\n\nDiferente de rascunhos anteriores que ameaçavam engessar desenvolvedores independentes, o texto final diferencia claramente grandes provedores centralizados de projetos de código aberto. Além disso, estabelece boas práticas para plataformas de informação baseadas em IA, incentivando a síntese transparente que preserva o crédito e o tráfego para os veículos de imprensa originais.`,
      fullArticleEn: `## A New Consensus on Algorithmic Governance\n\nGovernment delegates, technical standards bodies, and civil society leaders from 40 nations concluded a landmark agreement today focused on AI interoperability, safety benchmarks, and source provenance.\n\n## Protecting Open Innovation and Journalism Provenance\n\nUnlike earlier regulatory drafts that risked stifling independent developers, the final framework protects open-source infrastructure while establishing clear attribution standards for AI-powered information platforms—ensuring original newsrooms receive transparent citations and direct links.`,
      imageUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1000&q=85',
      dominantColor: '#b91c1c',
      secondaryColor: '#7f1d1d',
      articleCount: 19,
      isRadarGenerated: false,
      sources: [
        {
          name: 'Reuters',
          title: 'Global summit reaches consensus on open AI standards and provenance',
          url: 'https://www.reuters.com/technology/',
          domain: 'reuters.com',
          publishedAt: '7h ago',
          snippet: 'Forty nations endorse interoperable safety testing and transparent publisher attribution.',
        },
        {
          name: 'Associated Press',
          title: 'How the new digital governance accord balances safety and open-source AI',
          url: 'https://apnews.com/hub/artificial-intelligence',
          domain: 'apnews.com',
          publishedAt: '9h ago',
          snippet: 'Lawmakers carve out protections for open-weight models and independent researchers.',
        },
      ],
    },
    {
      slug: 'next-gen-gaming-neural-rendering-physics-engines',
      category: 'videogames',
      topicTagPt: 'Videogames & Engines',
      topicTagEn: 'Video Games',
      titlePt: 'Renderização Neural e NPCs Cognitivos Transformam o Desenvolvimento da Nova Geração de Jogos',
      titleEn: 'Neural Rendering and Cognitive NPCs Transform Next-Gen Game Development Pipelines',
      summaryPt:
        'Estúdios independentes e AAA estão combinando shaders neurais em tempo real com diálogos dinâmicos, dobrando a taxa de quadros e criando mundos reativos.',
      summaryEn:
        'AAA and indie studios alike are combining real-time neural shaders with dynamic world simulation, doubling frame rates while building reactive worlds.',
      bulletPointsPt: [
        'Novas APIs gráficas integram compressão de texturas neurais diretamente nos núcleos tensores das GPUs.',
        'Estúdios usam roteamento híbrido de IA para gerar simulações de mundo e reações dinâmicas sem latência perceptível.',
        'Desenvolvedores destacam que a tecnologia reduz o tamanho dos pacotes de instalação em até 60%.',
      ],
      bulletPointsEn: [
        'Next-gen graphics APIs integrate neural texture compression directly into GPU tensor cores.',
        'Studios use hybrid inference to power dynamic world simulations and reactive factions with zero frame drops.',
        'Neural asset pipelines reduce install sizes by up to 60% while preserving 4K fidelity.',
      ],
      perspectivesPt: [
        {
          label: 'Engenheiros de Gráficos 3D',
          stance: 'Entusiasta',
          summary:
            'Apontam os shaders neurais como o maior salto em computação gráfica desde a introdução do Ray Tracing em tempo real.',
        },
        {
          label: 'Diretores Criativos & Roteiristas',
          stance: 'Equilibrado',
          summary:
            'Defendem que a narrativa principal deve continuar artesanal, usando sistemas dinâmicos apenas para enriquecer a reatividade do mundo.',
        },
      ],
      perspectivesEn: [
        {
          label: 'Graphics Programmers',
          stance: 'Bullish',
          summary:
            'Call neural shaders the biggest leap in real-time rendering since hardware-accelerated ray tracing.',
        },
        {
          label: 'Narrative Directors',
          stance: 'Balanced',
          summary:
            'Emphasize keeping core storytelling handcrafted while using dynamic systems to make world physics and systemic sandboxes more reactive.',
        },
      ],
      fullArticlePt: `## A Convergência entre Computação Gráfica e Redes Neurais\n\nA indústria de videogames está vivenciando uma mudança estrutural na forma como mundos tridimensionais são renderizados e simulados. Com a chegada dos **shaders neurais** nativos nas principais engines do mercado, placas de vídeo conseguem reconstruir iluminação global complexa e materiais fotorrealistas consumindo uma fração da memória de vídeo tradicional.\n\n## Mundos Sistêmicos Mais Vivos\n\nAlém do salto visual, estúdios estão utilizando arquiteturas de simulação inteligente para criar ecossistemas e facções que reagem de forma orgânica às escolhas do jogador, mantendo a direção artística humana no centro da experiência.`,
      fullArticleEn: `## Where Real-Time Graphics Meet Neural Shaders\n\nThe game industry is undergoing a foundational shift in how 3D worlds are rendered and simulated. With native **neural shaders** now integrated into leading game engines, modern GPUs can reconstruct complex global illumination and subsurface materials using a fraction of traditional VRAM.\n\n## More Reactive Systemic Worlds\n\nBeyond visual fidelity, studios are pairing systemic physics with smart simulation layers so factions, weather, and economies respond organically to player agency while preserving handcrafted narrative design.`,
      imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=85',
      dominantColor: '#6d28d9',
      secondaryColor: '#4c1d95',
      articleCount: 16,
      isRadarGenerated: false,
      sources: [
        {
          name: 'Eurogamer / Digital Foundry',
          title: 'Inside neural rendering: How tensor cores are redefining 60fps path tracing',
          url: 'https://www.eurogamer.net/digitalfoundry',
          domain: 'eurogamer.net',
          publishedAt: '6h ago',
          snippet: 'Deep dive into neural texture compression and next-generation shader pipelines.',
        },
        {
          name: 'PC Gamer',
          title: 'How systemic simulation is making open-world games feel genuinely alive',
          url: 'https://www.pcgamer.com/',
          domain: 'pcgamer.com',
          publishedAt: '10h ago',
          snippet: 'Developers share how modern engines balance authored stories with emergent sandbox physics.',
        },
      ],
    },
  ];

  function parseRelativeOrIso(val?: string, baseTime?: Date): string {
    const base = baseTime || new Date();
    if (!val) return base.toISOString();
    const match = val.match(/^(\d+)h\s*ago$/i);
    if (match) {
      const hours = parseInt(match[1], 10);
      return new Date(base.getTime() - hours * 60 * 60 * 1000).toISOString();
    }
    const d = new Date(val);
    return !isNaN(d.getTime()) ? d.toISOString() : base.toISOString();
  }

  for (let idx = 0; idx < initialStories.length; idx++) {
    const item = initialStories[idx];
    const { sources, ...storyData } = item;
    // Stagger publication time slightly within the last couple of hours for realistic exact times
    const storyDate = new Date(Date.now() - (idx + 1) * 45 * 60 * 1000);

    await prisma.story.create({
      data: {
        ...storyData,
        publishedAt: storyDate,
        sources: {
          create: sources.map((s) => ({
            ...s,
            publishedAt: parseRelativeOrIso(s.publishedAt, storyDate),
          })),
        },
      },
    });
  }

  console.log('[Seed] Initial reach.news stories created successfully.');
}
