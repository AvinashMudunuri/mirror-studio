# Project MIRROR Studio

> AI-powered storytelling platform helping teenagers develop emotional intelligence through immersive interactive stories.

## Vision

Create a Netflix-style interactive series where every decision shapes the world, teaching emotional intelligence through story—not through tests or quizzes.

Behind the scenes, an AI studio of specialized agents collaborates to create, review, improve, and publish these stories.

## Mission

**Help young people practice life through stories before life tests them in reality.**

---

## Repository Structure

```
mirror-studio/
├── apps/
│   ├── web/          # React frontend (player experience)
│   └── api/          # Node.js backend API
├── packages/
│   ├── agents/       # AI agent framework and implementations
│   ├── prompts/      # Agent prompts and templates
│   ├── engine/       # Story engine (runtime for episodes)
│   ├── memory/       # Memory systems (agent learning, player data)
│   ├── analytics/    # Analytics and metrics
│   ├── ui/           # Shared UI components
│   ├── schemas/      # TypeScript types and Zod schemas
│   ├── stories/      # Story content and world definitions
│   └── evaluation/   # Quality evaluation and testing
├── docs/
│   ├── PRD-V1.md                    # Product Requirements Document
│   ├── AI-STUDIO-HANDBOOK-V1.md     # Complete agent specifications
│   └── ROADMAP.md                   # Implementation roadmap
└── tests/            # End-to-end and integration tests
```

---

## Core Philosophy

### The platform does NOT:
- Judge children
- Diagnose personalities
- Label users
- Compare users

### The platform DOES:
- Encourage reflection
- Promote discussion
- Create immersive experiences
- Help users understand themselves
- Show growth over time

---

## Technology Stack

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **MUI** - Component library
- **Framer Motion** - Animations
- **React Query** - Data fetching

### Backend
- **Node.js** - Runtime
- **Express** - API framework
- **PostgreSQL** - Primary database
- **Redis** - Caching and message bus
- **pgvector** - Vector similarity search

### AI
- **Claude Sonnet 4.5** - Strategic and creative agents (Anthropic)
- **GPT-5.4** - Specialist agents (OpenAI)
- **Sequential orchestrator script** (`scripts/create-real-episode.js`) - Agent
  orchestration (see ADR 001; LangGraph was considered early on but never
  adopted — ADR 002 lists what we port from it natively)

### Infrastructure
- **Turbo** - Monorepo build system
- **Docker** - Containerization
- **OpenTelemetry** - Observability
- **Grafana** - Metrics visualization
- **Sentry** - Error tracking

---

## Getting Started

### Prerequisites

- Node.js ≥ 20.0.0
- npm ≥ 10.0.0
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd mirror-studio

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and database credentials

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

### Development

```bash
# Run all packages in watch mode
npm run dev

# Run tests
npm run test

# Lint code
npm run lint

# Build for production
npm run build
```

---

## AI Studio

The heart of the system is an **AI Studio** where specialized agents collaborate to create episodes.

### Agent Organization

1. **CEO Agent** (Morgan) - Final decision-maker
2. **Creative Director** (Aria) - Creative vision keeper
3. **Story Architect** (River) - Story structure designer
4. **World Builder** - World consistency and lore
5. **Character Designer** (Kai) - Character psychology specialist
6. **Dialogue Writer** (Echo) - Authentic teen voice
7. **Game Designer** (Zara Patel) - Engagement and fun
8. **Child Psychologist** (Dr. Sam Okafor) - Age-appropriateness and safety
9. **Learning Scientist** - Educational frameworks
10. **Ethics Reviewer** (Dr. Alex Chen) - Ethics and representation
11. **Sports Consultant** - Sports world authenticity
12. **Anime Consultant** - Anime world authenticity
13. **Teen Reviewer** - Teen perspective
14. **Parent Reviewer** - Parent concerns
15. **QA Reviewer** - Quality assurance
16. **Publisher** - Production deployment
17. **Analytics Agent** - Data and insights
18. **Illustration Agent** - Visual assets
19. **Voice Script Agent** - Audio adaptation
20. **JSON Export Agent** - Data transformation

### Agent Workflow

```
CEO Sprint Planning
  ↓
Story Architect → Episode Outline
  ↓
Character Designer → Character Profiles
  ↓
Dialogue Writer → Full Dialogue
  ↓
Psychologist → Educational Review
  ↓
Game Designer → Engagement Review
  ↓
Ethics Reviewer → Safety Review
  ↓
QA → Quality Check
  ↓
CEO → Final Approval
  ↓
Publisher → Production Release
```

### Agent Communication

Agents communicate via a message bus using structured messages:
- **REQUEST** - Agent needs input
- **RESPONSE** - Agent provides output
- **CHALLENGE** - Agent disputes output (triggers debate)
- **APPROVAL** - Agent approves output
- **REJECTION** - Agent rejects with feedback
- **BROADCAST** - System-wide notification

---

## Worlds & Content

### Season 1: New School
Themes: Belonging, Identity, Friendship, Integrity

### Season 2: Sports Academy
Themes: Resilience, Leadership, Teamwork, Competition

### Season 3: Anime Hero Journey
Themes: Courage, Self-Discovery, Responsibility, Sacrifice

### Season 4: Fantasy Kingdom
Themes: Justice, Power, Loyalty, Wisdom

### Season 5: Space Colony
Themes: Adaptability, Innovation, Cooperation, Survival

### Season 6: Detective Academy
Themes: Critical Thinking, Ethics, Curiosity, Truth

### Season 7: Zombie Survival
Themes: Fear Management, Group Dynamics, Moral Choices, Hope

### Season 8: Cricket World Cup
Themes: Sportsmanship, Pressure, Strategy, Cultural Pride

---

## Trait System

The platform tracks 10 core emotional intelligence traits:

1. **Empathy** - Understanding others' emotions
2. **Leadership** - Guiding and inspiring others
3. **Resilience** - Bouncing back from setbacks
4. **Curiosity** - Seeking knowledge and new experiences
5. **Integrity** - Staying true to values
6. **Communication** - Expressing thoughts clearly
7. **Adaptability** - Adjusting to change
8. **Confidence** - Self-assurance in abilities
9. **Judgment** - Making sound decisions
10. **Emotional Awareness** - Recognizing own emotions

**Important**: Traits are tracked subtly through story choices. One choice never dramatically changes a trait. **Patterns matter.**

---

## Success Metrics

- Player finishes first season: **>60%**
- Player returns next week: **>40%**
- Parent starts conversations: **>30%**
- Teacher uses stories in class: **>500 teachers**
- Average episode completion: **>80%**
- Replay rate: **>30%**
- Average session: **>12 minutes**

---

## Documentation

- **[PRD v1.0](docs/PRD-V1.md)** - Complete product requirements
- **[AI Studio Handbook v1.0](docs/AI-STUDIO-HANDBOOK-V1.md)** - Agent specifications and prompts
- **[Roadmap](docs/ROADMAP.md)** - Implementation timeline
- **[API Documentation](docs/API.md)** - Backend API reference (coming soon)
- **[Story Format](docs/STORY-FORMAT.md)** - Episode JSON schema (coming soon)

---

## Development Roadmap

See **[Roadmap](docs/ROADMAP.md)** for the current, evidence-based phase-by-phase status (last rewritten 2026-07-07 — this section used to duplicate it with a stale week-numbered plan). Summary:

- **Phase 1 (Foundation)**: ✅ done, on a different architecture than originally planned — message bus built but deliberately kept out of the runtime (ADR 001); Postgres memory live-verified.
- **Phase 2 (Core Agents)**: ✅ done, exceeded the original milestone — full episodes generated end-to-end, not just outlines.
- **Phase 3 (Review Agents)**: ⚠️ mostly done — 4 of 5 reviewers built (no Teen Reviewer); no agent-to-agent debate system (orchestrator-routed feedback instead).
- **Phase 4 (Production Agents)**: ❌ not started — no Publisher/Analytics/JSON Export agents, no API.
- **Phase 5 (Frontend)**: ❌ not started — `apps/admin` is an internal read-only dashboard, not a player-facing app.
- **Phase 6 (Polish & Launch)**: ❌ not started — no monitoring, no CI configured in this repo.

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Write tests
4. Run linting: `npm run lint`
5. Commit with clear message: `git commit -m "feat: add X"`
6. Push and create PR

---

## License

[License TBD]

---

## Contact

- **Project Lead**: [Name]
- **Email**: [email]
- **Discord**: [link]

---

## Guiding Principle

> People won't remember the score they received. They'll remember the story they lived—and the conversations it inspired.

---

**Let's help young people practice life through stories.**
