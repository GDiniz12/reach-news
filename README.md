# [Reach] NEWS (`reach.news`)

Plataforma de jornalismo inteligente e síntese multi-fonte em tempo real com design editorial inspirado no **Perplexity Discover**, alimentada via **OmniRoute AI Gateway**.

## Principais Funcionalidades

- **Design Editorial Perplexity Discover**: Tipografia serifada (`Source Serif 4`), tema escuro refinado (`#191a1a` / `#202222`), página dedicada de grande reportagem (`/story/[slug]`) e modo de leitura duplo (**Artigo Jornalístico Completo** vs. **Síntese 360°**).
- **Algoritmo Adaptativo & Aba "Para Você"**:
  - Onboarding em 2 etapas na criação da conta (`/auth`) com mais de 25 áreas de interesse detalhadas.
  - Telemetria comportamental em tempo real (visualização, tempo de leitura > 20s, favoritos, perguntas ao bot e pesquisas no Radar).
  - Aba exclusiva **Para Você** para usuários autenticados com pontuação dinâmica de afinidade.
- **Pesquisa Inteligente no Radar IA**:
  - Exibe imediatamente notícias relacionadas já existentes no banco enquanto a IA interpreta o escopo do tema e gera **3+ reportagens sob ângulos distintos** (para temas amplos) ou **1 reportagem dedicada** (para fatos específicos), marcadas com a tag **"Gerada agora"**.
- **Ciclo Editorial Automático (30 em 30 min)**:
  - Busca os **5 assuntos mais comentados do momento** (Google Trends + X/Twitter + Top Media).
  - Produz no mínimo **2 reportagens inéditas para cada editoria** da plataforma.
  - Limpeza automática de notícias publicadas há mais de **7 dias** para manter o banco PostgreSQL enxuto.
- **Assistente de IA Flutuante**: Bot no canto inferior direito com renderização completa de Markdown para responder dúvidas sobre a notícia atual ou qualquer outro assunto.
- **PWA Instalável (iOS / Android / Desktop)**: Manifesto web app, Service Worker e ícones nativos (`apple-touch-icon`) para adicionar à tela de início do iPhone/Android em tela cheia.
