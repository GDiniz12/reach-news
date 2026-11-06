export type Language = 'pt' | 'en';

export interface StorySource {
  id: string;
  name: string;
  title: string;
  url: string;
  domain: string;
  publishedAt?: string;
  snippet?: string;
}

export interface StoryPerspective {
  label: string;
  stance: string;
  summary: string;
}

export interface StoryChatMessage {
  id: string;
  storyId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface Story {
  id: string;
  slug: string;
  category: string;
  topicTagPt: string;
  topicTagEn: string;
  titlePt: string;
  titleEn: string;
  summaryPt: string;
  summaryEn: string;
  bulletPointsPt: string[];
  bulletPointsEn: string[];
  perspectivesPt: StoryPerspective[];
  perspectivesEn: StoryPerspective[];
  fullArticlePt: string;
  fullArticleEn: string;
  imageUrl: string;
  dominantColor: string;
  secondaryColor: string;
  articleCount: number;
  isRadarGenerated: boolean;
  radarQuery?: string;
  publishedAt: string;
  sources: StorySource[];
  chatMessages?: StoryChatMessage[];
  recommendationScore?: number;
  affinityScore?: number;
  matchReasonPt?: string;
  matchReasonEn?: string;
  isJustGenerated?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  interests?: string[];
  affinityMap?: Record<string, number>;
  savedStories?: Story[];
}

export interface OmniRouteStatus {
  online: boolean;
  baseUrl: string;
  model: string;
  availableModels: string[];
  latencyMs: number;
  error?: string;
  config?: {
    omnirouteBaseUrl: string;
    omnirouteModel: string;
    cronEnabled: boolean;
    cronIntervalMin: number;
  };
}

export interface PlatformCategory {
  id: string;
  labelPt: string;
  labelEn: string;
  isPopular?: boolean;
  is24h?: boolean;
}

export interface CategoryOption {
  id: string;
  labelPt: string;
  labelEn: string;
  groupPt: string;
  groupEn: string;
  descPt: string;
  descEn: string;
  isForYou?: boolean;
  isPopular?: boolean;
}

export const CATEGORIES: readonly PlatformCategory[] = [
  { id: 'popular', labelPt: 'Popular', labelEn: 'Popular', isPopular: true },
  { id: 'last_24h', labelPt: 'Últimas 24h', labelEn: 'Last 24h', is24h: true },
  { id: 'technology', labelPt: 'Tecnologia', labelEn: 'Technology' },
  { id: 'sports', labelPt: 'Esportes', labelEn: 'Sports' },
  { id: 'entertainment', labelPt: 'Entretenimento', labelEn: 'Entertainment' },
  { id: 'science', labelPt: 'Ciência', labelEn: 'Science' },
  { id: 'politics', labelPt: 'Política', labelEn: 'Politics' },
  { id: 'crime', labelPt: 'Segurança', labelEn: 'Crime' },
  { id: 'economics', labelPt: 'Economia', labelEn: 'Economics' },
  { id: 'videogames', labelPt: 'Videogames', labelEn: 'Video Games' },
] as const;

export interface SubTheme {
  id: string;
  labelPt: string;
  labelEn: string;
  keywords: string[];
}

export const CATEGORY_SUBTHEMES: Record<string, SubTheme[]> = {
  popular: [
    { id: 'pop_trending', labelPt: 'Em Alta', labelEn: 'Trending', keywords: ['alta', 'trending', 'destaque', 'viral', 'milhões'] },
    { id: 'pop_brasil', labelPt: 'Brasil', labelEn: 'Brazil', keywords: ['brasil', 'brasileiro', 'brasileira', 'nacional', 'governo'] },
    { id: 'pop_mundo', labelPt: 'Mundo', labelEn: 'World', keywords: ['eua', 'europa', 'global', 'internacional', 'mundo', 'china'] },
    { id: 'pop_tech', labelPt: 'Tecnologia & IA', labelEn: 'Tech & AI', keywords: ['ia', 'tecnologia', 'google', 'apple', 'meta', 'microsoft'] },
    { id: 'pop_negocios', labelPt: 'Negócios & Mercado', labelEn: 'Business & Market', keywords: ['mercado', 'economia', 'dólar', 'bolsa', 'bilhões'] },
  ],
  last_24h: [
    { id: '24h_urgente', labelPt: 'Plantão Urgente', labelEn: 'Breaking News', keywords: ['urgente', 'agora', 'plantão', 'breaking', 'últimas'] },
    { id: '24h_brasil', labelPt: 'Brasil', labelEn: 'Brazil', keywords: ['brasil', 'brasileiro', 'brasileira', 'stf', 'governo'] },
    { id: '24h_mundo', labelPt: 'Internacional', labelEn: 'World', keywords: ['eua', 'europa', 'oriente médio', 'china', 'internacional'] },
    { id: '24h_financas', labelPt: 'Finanças & Câmbio', labelEn: 'Finance & Markets', keywords: ['dólar', 'selic', 'bolsa', 'mercado', 'juros'] },
    { id: '24h_giro', labelPt: 'Giro Rápido', labelEn: 'Daily Brief', keywords: ['decisão', 'anúncio', 'vitória', 'acordo'] },
  ],
  technology: [
    { id: 'tech_ia', labelPt: 'Inteligência Artificial', labelEn: 'Artificial Intelligence', keywords: ['inteligência artificial', 'ia', 'ai', 'llm', 'openai', 'gemini', 'anthropic', 'chatgpt'] },
    { id: 'tech_bigtech', labelPt: 'Big Tech', labelEn: 'Big Tech', keywords: ['apple', 'google', 'microsoft', 'meta', 'amazon', 'nvidia'] },
    { id: 'tech_cloud', labelPt: 'Nuvem & Software', labelEn: 'Cloud & Software', keywords: ['nuvem', 'cloud', 'azure', 'aws', 'software', 'desenvolvedores'] },
    { id: 'tech_sec', labelPt: 'Cibersegurança', labelEn: 'Cybersecurity', keywords: ['cibersegurança', 'hacker', 'ransomware', 'segurança digital', 'vazamento'] },
    { id: 'tech_hardware', labelPt: 'Hardware & Chips', labelEn: 'Hardware & Chips', keywords: ['chips', 'semicondutores', 'hardware', 'nothing', 'wearable', 'processador'] },
    { id: 'tech_startups', labelPt: 'Startups & Inovação', labelEn: 'Startups & Innovation', keywords: ['startup', 'startups', 'unicórnio', 'venture capital', 'investimento'] },
  ],
  sports: [
    { id: 'sport_futebol_br', labelPt: 'Futebol Brasileiro', labelEn: 'Brazilian Football', keywords: ['futebol brasileiro', 'brasileirão', 'flamengo', 'palmeiras', 'corinthians', 'cruzeiro', 'são paulo', 'bruno rodrigues'] },
    { id: 'sport_futebol_eur', labelPt: 'Champions & Europa', labelEn: 'Champions & Europe', keywords: ['champions', 'europa', 'real madrid', 'barcelona', 'premier league', 'lens', 'salzburg', 'anderlecht', 'cristiano ronaldo'] },
    { id: 'sport_f1', labelPt: 'Fórmula 1 & Motores', labelEn: 'Formula 1 & Racing', keywords: ['fórmula 1', 'f1', 'ferrari', 'hamilton', 'leclerc', 'vasseur', 'red bull', 'gp'] },
    { id: 'sport_nba', labelPt: 'Basquete & NBA', labelEn: 'Basketball & NBA', keywords: ['nba', 'basquete', 'warriors', 'heat', 'thompson', 'chase center'] },
    { id: 'sport_ufc', labelPt: 'UFC & Lutas', labelEn: 'UFC & Combat', keywords: ['ufc', 'dana white', 'makhachev', 'carlos prates', 'cinturão', 'mma'] },
    { id: 'sport_olimpicos', labelPt: 'Olímpicos & Atletismo', labelEn: 'Olympics & Athletics', keywords: ['atletismo', 'olimpíadas', 'olímpico', 'vôlei', 'tênis', 'duplantis', 'sheilla castro'] },
  ],
  entertainment: [
    { id: 'ent_cinema', labelPt: 'Cinema & Premiações', labelEn: 'Cinema & Awards', keywords: ['cinema', 'filme', 'filmes', 'oscar', 'ccxp', 'vingadores', 'hollywood', 'stallone', 'samuel l. jackson'] },
    { id: 'ent_streaming', labelPt: 'Séries & Streaming', labelEn: 'Series & Streaming', keywords: ['série', 'séries', 'streaming', 'netflix', 'hbo', 'disney', 'max'] },
    { id: 'ent_novelas', labelPt: 'Novelas & TV', labelEn: 'Soaps & TV', keywords: ['novela', 'novela das nove', 'globo', 'tv globo', 'ana maria braga', 'huck', 'quem ama cuida'] },
    { id: 'ent_musica', labelPt: 'Música & Shows', labelEn: 'Music & Concerts', keywords: ['música', 'show', 'shows', 'turnê', 'álbum', 'anitta', 'cantor', 'cantora', 'festival'] },
    { id: 'ent_famosos', labelPt: 'Celebridades & Cultura', labelEn: 'Celebrities & Culture', keywords: ['bacci', 'celebridades', 'famosos', 'paçoca', 'luto'] },
  ],
  science: [
    { id: 'sci_espaco', labelPt: 'Espaço & Astronomia', labelEn: 'Space & Astronomy', keywords: ['espaço', 'telescópio', 'james webb', 'nasa', 'spacex', 'europa', 'encélado', 'nancy grace'] },
    { id: 'sci_saude', labelPt: 'Saúde & Biologia', labelEn: 'Health & Medicine', keywords: ['saúde', 'medicina', 'vacina', 'genética', 'biologia', 'células', 'hospital'] },
    { id: 'sci_mulheres', labelPt: 'Mulheres na Ciência', labelEn: 'Women in Science', keywords: ['mulheres na ciência', 'mulheres cientistas', 'meninas na ciência', 'pesquisadoras'] },
    { id: 'sci_clima', labelPt: 'Clima & Terra', labelEn: 'Climate & Earth', keywords: ['clima', 'meio ambiente', 'aquecimento global', 'energia', 'sustentabilidade'] },
    { id: 'sci_pesquisa', labelPt: 'Pesquisa & Inovação', labelEn: 'Research & Innovation', keywords: ['pesquisa', 'cientistas', 'descoberta', 'descobertas', 'cern', 'física'] },
  ],
  politics: [
    { id: 'pol_gov', labelPt: 'Governo & Planalto', labelEn: 'Federal Government', keywords: ['lula', 'governo federal', 'ministério', 'haddad', 'galípolo', 'planalto', 'ministros'] },
    { id: 'pol_eleicoes', labelPt: 'Eleições 2026', labelEn: 'Elections', keywords: ['eleições', 'eleição', 'eleições 2026', 'segundo turno', 'votos', 'urnas', 'flávio bolsonaro', 'candidatos'] },
    { id: 'pol_congresso', labelPt: 'Congresso & STF', labelEn: 'Congress & Courts', keywords: ['congresso', 'senado', 'câmara', 'stf', 'deputados', 'cnj', 'judiciário'] },
    { id: 'pol_geopolitica', labelPt: 'Relações Globais & Mercosul', labelEn: 'Global Diplomacy', keywords: ['mercosul', 'cúpula do mercosul', 'diplomacia', 'geopolítica', 'trump', 'eua', 'guerra', 'irã', 'midterms'] },
  ],
  crime: [
    { id: 'crime_investigacoes', labelPt: 'Investigações & PF', labelEn: 'Investigations & Police', keywords: ['pf', 'polícia federal', 'polícia civil', 'investigação', 'inquérito', 'espionagem'] },
    { id: 'crime_seguranca', labelPt: 'Segurança Pública', labelEn: 'Public Safety', keywords: ['segurança pública', 'letalidade policial', 'certidões de óbito', 'polícia militar', 'operações'] },
    { id: 'crime_justica', labelPt: 'Tribunais & Julgamentos', labelEn: 'Courts & Trials', keywords: ['russell brand', 'estupro', 'agressão', 'prisão', 'tribunal', 'condenado', 'júri'] },
    { id: 'crime_fraudes', labelPt: 'Fraudes & Crimes', labelEn: 'Frauds & Financial Crime', keywords: ['fraude', 'golpe', 'desvio milionário', 'lavagem', 'esquema'] },
  ],
  economics: [
    { id: 'eco_bc_selic', labelPt: 'Banco Central & Selic', labelEn: 'Central Bank & Rates', keywords: ['banco central', 'selic', 'taxa selic', 'juros', 'copom', 'inflação', 'ipca'] },
    { id: 'eco_mercado', labelPt: 'Mercado Financeiro & B3', labelEn: 'Stock Market & B3', keywords: ['mercado financeiro', 'bolsa', 'ibovespa', 'b3', 'ações', 'dólar', 'câmbio', 'lara resende'] },
    { id: 'eco_fiscal', labelPt: 'Dívida & Política Fiscal', labelEn: 'Fiscal Policy & Debt', keywords: ['dívida pública', 'haddad', 'durigan', 'galípolo', 'corte de gastos', 'pacote fiscal'] },
    { id: 'eco_empresas', labelPt: 'Empresas & Negócios', labelEn: 'Business & Startups', keywords: ['cimed', 'ueno bank', 'insurtech', 'empresas', 'startups', 'lucro', 'receita'] },
  ],
  videogames: [
    { id: 'game_lancamentos', labelPt: 'Lançamentos & Destaques', labelEn: 'Releases & Highlights', keywords: ['gta vi', 'grand theft auto', 'zelda', 'ocarina of time', 'lançamentos', 'games'] },
    { id: 'game_playstation', labelPt: 'PlayStation', labelEn: 'PlayStation', keywords: ['playstation', 'ps5', 'sony', 'black friday', 'dualsense'] },
    { id: 'game_xbox_nintendo', labelPt: 'Xbox, Nintendo & PC', labelEn: 'Xbox, Nintendo & PC', keywords: ['xbox', 'nintendo', 'switch', 'game pass', 'pc gaming', 'steam'] },
    { id: 'game_engines', labelPt: 'Indústria & Engines', labelEn: 'Industry & Engines', keywords: ['engines', 'renderização neural', 'npcs cognitivos', 'unreal', 'estúdios'] },
  ],
  for_you: [
    { id: 'fy_ai', labelPt: 'Inteligência Artificial', labelEn: 'Artificial Intelligence', keywords: ['ia', 'inteligência artificial', 'ai', 'tech'] },
    { id: 'fy_tech', labelPt: 'Tecnologia & Big Tech', labelEn: 'Technology & Big Tech', keywords: ['tecnologia', 'google', 'apple', 'microsoft'] },
    { id: 'fy_brasil', labelPt: 'Brasil & Notícias', labelEn: 'National News', keywords: ['brasil', 'nacional', 'governo', 'mercado'] },
  ],
};

export const INTEREST_CATEGORIES: CategoryOption[] = [
  {
    id: 'artificial_intelligence',
    labelPt: 'Inteligência Artificial',
    labelEn: 'Artificial Intelligence',
    groupPt: 'Tecnologia & Futuro',
    groupEn: 'Technology & Future',
    descPt: 'LLMs, agentes autônomos, OpenAI, Gemini, Anthropic e revolução da IA',
    descEn: 'LLMs, autonomous agents, OpenAI, Gemini, Anthropic, and AI breakthroughs',
  },
  {
    id: 'technology',
    labelPt: 'Tecnologia & Big Tech',
    labelEn: 'Technology & Big Tech',
    groupPt: 'Tecnologia & Futuro',
    groupEn: 'Technology & Future',
    descPt: 'Inovação digital, software, nuvem, Apple, Google, Microsoft e Meta',
    descEn: 'Digital innovation, software, cloud, Apple, Google, Microsoft, and Meta',
  },
  {
    id: 'startups',
    labelPt: 'Startups & Venture Capital',
    labelEn: 'Startups & VC',
    groupPt: 'Tecnologia & Futuro',
    groupEn: 'Technology & Future',
    descPt: 'Rodadas de investimento, unicórnios, ecossistema de inovação e fundadores',
    descEn: 'Funding rounds, unicorns, innovation ecosystem, and founders',
  },
  {
    id: 'cybersecurity',
    labelPt: 'Cibersegurança',
    labelEn: 'Cybersecurity',
    groupPt: 'Tecnologia & Futuro',
    groupEn: 'Technology & Future',
    descPt: 'Segurança da informação, privacidade, defesa cibernética e ameaças globais',
    descEn: 'Information security, privacy, cyber defense, and global threats',
  },
  {
    id: 'hardware',
    labelPt: 'Chips & Hardware',
    labelEn: 'Chips & Hardware',
    groupPt: 'Tecnologia & Futuro',
    groupEn: 'Technology & Future',
    descPt: 'Semicondutores, GPUs, Nvidia, processadores, smartphones e robótica',
    descEn: 'Semiconductors, GPUs, Nvidia, processors, smartphones, and robotics',
  },
  {
    id: 'economics',
    labelPt: 'Economia',
    labelEn: 'Economics',
    groupPt: 'Economia & Negócios',
    groupEn: 'Economics & Business',
    descPt: 'PIB, inflação, juros, Banco Central, políticas fiscais e comércio global',
    descEn: 'GDP, inflation, interest rates, Central Banks, and global trade',
  },
  {
    id: 'finance',
    labelPt: 'Mercado Financeiro',
    labelEn: 'Financial Markets',
    groupPt: 'Economia & Negócios',
    groupEn: 'Economics & Business',
    descPt: 'Bolsa de valores, Ibovespa, Wall Street, ações, dividendos e fundos',
    descEn: 'Stock markets, Wall Street, equities, dividends, and hedge funds',
  },
  {
    id: 'crypto',
    labelPt: 'Cripto & Blockchain',
    labelEn: 'Crypto & Web3',
    groupPt: 'Economia & Negócios',
    groupEn: 'Economics & Business',
    descPt: 'Bitcoin, Ethereum, ativos digitais, DeFi, ETFs e regulação cripto',
    descEn: 'Bitcoin, Ethereum, digital assets, DeFi, ETFs, and regulation',
  },
  {
    id: 'business',
    labelPt: 'Negócios & Empresas',
    labelEn: 'Corporate & Business',
    groupPt: 'Economia & Negócios',
    groupEn: 'Economics & Business',
    descPt: 'Fusões e aquisições, balanços corporativos, varejo e liderança executiva',
    descEn: 'Mergers & acquisitions, corporate earnings, retail, and leadership',
  },
  {
    id: 'science',
    labelPt: 'Ciência',
    labelEn: 'Science',
    groupPt: 'Ciência, Espaço & Saúde',
    groupEn: 'Science, Space & Health',
    descPt: 'Descobertas científicas, física quântica, biologia e grandes pesquisas',
    descEn: 'Scientific discoveries, quantum physics, biology, and research',
  },
  {
    id: 'space',
    labelPt: 'Espaço & Astronomia',
    labelEn: 'Space & Astronomy',
    groupPt: 'Ciência, Espaço & Saúde',
    groupEn: 'Science, Space & Health',
    descPt: 'NASA, SpaceX, foguetes, telescópio James Webb e exploração planetária',
    descEn: 'NASA, SpaceX, rockets, James Webb telescope, and planetary missions',
  },
  {
    id: 'health',
    labelPt: 'Saúde & Medicina',
    labelEn: 'Health & Medicine',
    groupPt: 'Ciência, Espaço & Saúde',
    groupEn: 'Science, Space & Health',
    descPt: 'Avanços médicos, biotecnologia, longevidade, neurociência e bem-estar',
    descEn: 'Medical breakthroughs, biotech, longevity, neuroscience, and wellness',
  },
  {
    id: 'climate',
    labelPt: 'Clima & Energia',
    labelEn: 'Climate & Clean Energy',
    groupPt: 'Ciência, Espaço & Saúde',
    groupEn: 'Science, Space & Health',
    descPt: 'Transição energética, sustentabilidade, clima extremo e energia limpa',
    descEn: 'Energy transition, sustainability, extreme weather, and clean tech',
  },
  {
    id: 'politics',
    labelPt: 'Política Nacional',
    labelEn: 'Politics',
    groupPt: 'Política, Mundo & Sociedade',
    groupEn: 'Politics, World & Society',
    descPt: 'Governo, Congresso, STF, eleições, bastidores do poder e leis',
    descEn: 'Government, Congress, Supreme Court, elections, and public policy',
  },
  {
    id: 'geopolitics',
    labelPt: 'Geopolítica & Mundo',
    labelEn: 'Geopolitics & World',
    groupPt: 'Política, Mundo & Sociedade',
    groupEn: 'Politics, World & Society',
    descPt: 'Relações internacionais, diplomacia, conflitos globais e alianças',
    descEn: 'International relations, diplomacy, global conflicts, and alliances',
  },
  {
    id: 'crime',
    labelPt: 'Justiça & Segurança',
    labelEn: 'Justice & Public Safety',
    groupPt: 'Política, Mundo & Sociedade',
    groupEn: 'Politics, World & Society',
    descPt: 'Investigações, operações policiais, decisões judiciais e segurança pública',
    descEn: 'Investigations, law enforcement operations, and court rulings',
  },
  {
    id: 'education',
    labelPt: 'Carreira & Educação',
    labelEn: 'Career & Education',
    groupPt: 'Política, Mundo & Sociedade',
    groupEn: 'Politics, World & Society',
    descPt: 'Futuro do trabalho, universidades, ensino superior e mercado profissional',
    descEn: 'Future of work, universities, higher education, and workplace trends',
  },
  {
    id: 'football',
    labelPt: 'Futebol',
    labelEn: 'Football / Soccer',
    groupPt: 'Esportes & Competições',
    groupEn: 'Sports & Competitions',
    descPt: 'Brasileirão, Libertadores, Champions League, mercado da bola e seleções',
    descEn: 'Champions League, Premier League, Brasileirão, and transfer market',
  },
  {
    id: 'sports',
    labelPt: 'Esportes Olímpicos & NBA',
    labelEn: 'Sports & NBA',
    groupPt: 'Esportes & Competições',
    groupEn: 'Sports & Competitions',
    descPt: 'Basquete, tênis, vôlei, UFC, atletismo e grandes torneios mundiais',
    descEn: 'Basketball, NBA, tennis, MMA, athletics, and global tournaments',
  },
  {
    id: 'motorsport',
    labelPt: 'Fórmula 1 & Automobilismo',
    labelEn: 'Formula 1 & Motorsport',
    groupPt: 'Esportes & Competições',
    groupEn: 'Sports & Competitions',
    descPt: 'Fórmula 1, bastidores das equipes, pilotos, corridas e engenharia',
    descEn: 'Formula 1, team paddocks, drivers, Grand Prix, and engineering',
  },
  {
    id: 'entertainment',
    labelPt: 'Cinema, Séries & TV',
    labelEn: 'Movies, Series & TV',
    groupPt: 'Cultura, Games & Estilo de Vida',
    groupEn: 'Culture, Gaming & Lifestyle',
    descPt: 'Streaming, estreias do cinema, Hollywood, premiações e cultura pop',
    descEn: 'Streaming, box office releases, Hollywood, awards, and pop culture',
  },
  {
    id: 'music',
    labelPt: 'Música & Shows',
    labelEn: 'Music & Festivals',
    groupPt: 'Cultura, Games & Estilo de Vida',
    groupEn: 'Culture, Gaming & Lifestyle',
    descPt: 'Lançamentos musicais, grandes turnês, festivais e indústria fonográfica',
    descEn: 'Album releases, world tours, festivals, and music industry',
  },
  {
    id: 'videogames',
    labelPt: 'Videogames',
    labelEn: 'Video Games',
    groupPt: 'Cultura, Games & Estilo de Vida',
    groupEn: 'Culture, Gaming & Lifestyle',
    descPt: 'PlayStation, Xbox, Nintendo, PC Gaming, grandes lançamentos e estúdios',
    descEn: 'PlayStation, Xbox, Nintendo, PC Gaming, major releases, and studios',
  },
  {
    id: 'esports',
    labelPt: 'eSports & Competitivo',
    labelEn: 'eSports',
    groupPt: 'Cultura, Games & Estilo de Vida',
    groupEn: 'Culture, Gaming & Lifestyle',
    descPt: 'League of Legends, CS2, Valorant, campeonatos mundiais e organizações',
    descEn: 'League of Legends, CS2, Valorant, pro tournaments, and teams',
  },
  {
    id: 'automotive',
    labelPt: 'Carros & Mobilidade',
    labelEn: 'Cars & EV Mobility',
    groupPt: 'Cultura, Games & Estilo de Vida',
    groupEn: 'Culture, Gaming & Lifestyle',
    descPt: 'Carros elétricos, veículos autônomos, lançamentos automotivos e montadoras',
    descEn: 'Electric vehicles, autonomous driving, new models, and automakers',
  },
];

export const UI_TEXT = {
  pt: {
    signIn: 'Entrar',
    signUp: 'Criar conta',
    signOut: 'Sair',
    myProfile: 'Meu Perfil',
    savedStories: 'Salvos',
    omnirouteGateway: 'OmniRoute IA',
    introducingRadar: 'Apresentando',
    radarTitle: 'Radar',
    radarBannerDesc:
      'Pesquise o que centenas de fontes globais e modelos de IA via OmniRoute estão dizendo sobre qualquer tópico, empresa ou pessoa.',
    exploreRadar: 'Explorar Radar',
    radarInputPlaceholder: 'Digite um tópico, empresa ou pessoa para a IA investigar via OmniRoute...',
    radarActionBtn: 'Investigar Agora',
    radarSynthesizing: 'Agente OmniRoute pesquisando fontes e sintetizando dossiê...',
    articlesCount: 'ARTIGOS',
    hoursAgo: 'H ATRÁS',
    justNow: 'AGORA',
    synthesizeNewCategoryStory: 'Gerar Nova Pauta com IA',
    synthesizingCategory: 'Pesquisando via OmniRoute...',
    particleMode: 'Modo Particle (Síntese 360°)',
    fullArticleMode: 'Artigo Jornalístico Completo',
    keyTakeaways: 'Pontos-Chave Sintetizados',
    perspectivesTitle: 'Múltiplas Perspectivas & Ângulos',
    sourcesTitle: 'Fontes Cruzadas Verificadas',
    askAiTitle: 'Pergunte ao Assistente OmniRoute sobre esta notícia',
    askAiPlaceholder: 'Ex: Qual o impacto disso no Brasil? Quais os argumentos contrários?',
    askAiSend: 'Perguntar',
    closeModal: 'Fechar',
    bookmarkSave: 'Salvar matéria',
    bookmarkSaved: 'Salva no perfil',
    omnirouteModalTitle: 'Configuração do Gateway OmniRoute',
    omnirouteModalDesc:
      'O reach.news utiliza o seu roteador OmniRoute (OpenAI-compatible) com Function Calling para buscar fontes e sintetizar notícias.',
    saveSettings: 'Salvar e Testar Conexão',
    authSignInTitle: 'Entrar no reach.news',
    authSignUpTitle: 'Criar sua conta no reach.news',
    nameLabel: 'Seu nome',
    emailLabel: 'E-mail',
    passwordLabel: 'Senha',
    noAccountYet: 'Ainda não tem conta? Cadastre-se',
    alreadyHaveAccount: 'Já possui uma conta? Entre aqui',
    footerTerms: 'Termos de Serviço',
    footerPrivacy: 'Política de Privacidade',
    footerAbout: 'Sobre o reach.news',
    last24hBadge: 'Plantão 24h',
    last24hTitle: 'Plantão Últimas 24 Horas',
    last24hDesc: 'Cobertura em tempo real com foco estrito em notícias e acontecimentos ocorridos exclusivamente nas últimas 24h.',
    synthesize24hBtn: 'Sintetizar notícia de 24h com IA',
    synthesizing24hBtn: 'IA investigando e sintetizando fatos de hoje...',
    aiFocus24hBadge: 'Foco da IA: 24h',
    no24hStoriesTitle: 'Nenhuma notícia nas últimas 24h encontrada',
    no24hStoriesDesc: 'Clique no botão abaixo para a IA investigar as fontes ao vivo e gerar uma reportagem com foco nas últimas 24 horas.',
    generate24hNow: 'Investigar notícias das últimas 24h com IA',
  },
  en: {
    signIn: 'Sign in',
    signUp: 'Sign up',
    signOut: 'Sign out',
    myProfile: 'My Profile',
    savedStories: 'Saved',
    omnirouteGateway: 'OmniRoute AI',
    introducingRadar: 'Introducing',
    radarTitle: 'Radar',
    radarBannerDesc:
      'Search what hundreds of global outlets and AI models via OmniRoute are saying about any topic, company, or person.',
    exploreRadar: 'Explore Radar',
    radarInputPlaceholder: 'Search any topic, company, or person for OmniRoute AI to investigate...',
    radarActionBtn: 'Synthesize Now',
    radarSynthesizing: 'OmniRoute Agent searching live sources & synthesizing dossier...',
    articlesCount: 'ARTICLES',
    hoursAgo: 'H AGO',
    justNow: 'JUST NOW',
    synthesizeNewCategoryStory: 'Synthesize New AI Story',
    synthesizingCategory: 'Researching via OmniRoute...',
    particleMode: 'Particle Mode (360° Synthesis)',
    fullArticleMode: 'Full Journalistic Article',
    keyTakeaways: 'Synthesized Key Takeaways',
    perspectivesTitle: 'Multi-Source Perspectives & Angles',
    sourcesTitle: 'Verified Cross-Referenced Sources',
    askAiTitle: 'Ask OmniRoute AI about this story',
    askAiPlaceholder: 'E.g., What are the main counterarguments? How does this impact the market?',
    askAiSend: 'Ask AI',
    closeModal: 'Close',
    bookmarkSave: 'Save story',
    bookmarkSaved: 'Saved to profile',
    omnirouteModalTitle: 'OmniRoute AI Gateway Configuration',
    omnirouteModalDesc:
      'reach.news connects to your local or remote OmniRoute OpenAI-compatible router with Function Calling for live news synthesis.',
    saveSettings: 'Save & Test Connection',
    authSignInTitle: 'Sign in to reach.news',
    authSignUpTitle: 'Create your reach.news account',
    nameLabel: 'Full Name',
    emailLabel: 'Email address',
    passwordLabel: 'Password',
    noAccountYet: "Don't have an account? Sign up",
    alreadyHaveAccount: 'Already have an account? Sign in',
    footerTerms: 'Terms of Service',
    footerPrivacy: 'Privacy Policy',
    footerAbout: 'About Us',
    last24hBadge: '24h Breaking',
    last24hTitle: 'Last 24 Hours Breaking',
    last24hDesc: 'Real-time coverage strictly focused on news and developments that occurred within the last 24 hours.',
    synthesize24hBtn: 'Synthesize 24h Story with AI',
    synthesizing24hBtn: 'AI investigating and synthesizing today’s events...',
    aiFocus24hBadge: 'AI Focus: 24h',
    no24hStoriesTitle: 'No stories found for the last 24h',
    no24hStoriesDesc: 'Click the button below for the AI to investigate live sources and generate breaking coverage for the last 24 hours.',
    generate24hNow: 'Investigate Last 24h News with AI',
  },
} as const;
