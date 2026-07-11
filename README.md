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
│   ├── admin/        # Internal dashboard: runs, generate, publish (port 3300)
│   └── player/       # Player-facing app: published episodes (port 3400)
├── packages/
│   ├── agents/       # AI agent framework and implementations
│   ├── memory/       # Postgres agent memory (pgvector)
│   ├── message-bus/  # Redis Streams (built, not in runtime — ADR 001)
│   └── schemas/      # TypeScript types, Zod schemas, player projection
├── scripts/
│   └── create-real-episode.js   # Main pipeline orchestrator
├── infrastructure/db/           # Postgres schema + migrations
├── output/episodes/             # Run artifacts (source of truth on disk)
└── docs/
    ├── ROADMAP.md               # Current phase status (start here)
    ├── OPEN-QUESTIONS.md        # Backlog and open decisions
    └── decisions/               # ADRs
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
- **Next.js 15** — `apps/admin` and `apps/player`
- **React 19** + **TypeScript**

### Backend / data
- **Node.js ≥ 20** — monorepo (npm workspaces + Turbo)
- **PostgreSQL + pgvector** — episode persistence, agent memory, publish snapshots
- **Neon** (shared cloud Postgres for Codespaces + Cloud Agents — ADR 006)

### AI
- **Claude** — creation (`claude-sonnet-5`) and review board; direct Anthropic API or **AWS Bedrock** (`CLAUDE_BACKEND=bedrock`)
- **Sequential orchestrator** (`scripts/create-real-episode.js`) — 8 agents, ADR 001 (no message bus in runtime)

---

## Getting Started

### Prerequisites

- Node.js ≥ 20.0.0
- npm ≥ 10.0.0
- PostgreSQL 15+ (local dev) or **Neon** `DATABASE_URL` (shared publish/play — see `docs/runbooks/shared-postgres.md`)
- Claude API key **or** AWS Bedrock credentials (for episode generation)

### Installation

```bash
git clone <repository-url>
cd mirror-studio
npm install
cp .env.example .env   # set DATABASE_URL, CLAUDE_BACKEND, model IDs, etc.
npm run build
npm test
```

### Run locally

```bash
npm run dev -w @mirror/admin    # http://localhost:3300 — runs, generate, publish
npm run dev -w @mirror/player     # http://localhost:3400 — play published episodes
EPISODE_NUMBER=1 npm run real:episode   # generate (needs Claude/Bedrock creds)
npm test
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

See **[Roadmap](docs/ROADMAP.md)** for current, evidence-based status (v2.1, 2026-07-11). Summary:

- **Phases 1–3**: ✅ done (8-agent pipeline, review board, revision loop)
- **Phase 4 (Publish)**: ✅ minimal scope done — manual publish in admin, shared Neon Postgres
- **Phase 5 (Player)**: ⚠️ started — `apps/player` reads published episodes from Postgres
- **Phase 6 (Launch)**: ⚠️ partial — CI; Season 1 (5 eps) generated; monitoring not started
- **Backlog**: `docs/OPEN-QUESTIONS.md`

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
