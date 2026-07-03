# Phase 0: Bootstrap Foundation

## Goal
Build the minimal foundation that enables AI agents (both content and developer agents) to operate autonomously.

## What's Included

### Infrastructure
- **Docker Compose**: PostgreSQL 15 + pgvector + Redis 7
- **Database Schema**: Complete initial schema with all tables
- **Environment Config**: Local development setup

### Core Services (To Be Built)
- [ ] Message Bus (Redis Streams)
- [ ] Memory System (PostgreSQL + vector search)
- [ ] Base Agent Framework (complete)
- [ ] LLM Integration (Claude + OpenAI)
- [ ] First Developer Agent

## Quick Start

### 1. Start Infrastructure

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Add your API keys
# Edit .env and add:
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
```

### 3. Verify Database

```bash
# Connect to PostgreSQL
docker exec -it mirror-postgres psql -U mirror -d mirror_studio

# Check tables
\dt

# Check pgvector extension
\dx

# Exit
\q
```

### 4. Install Dependencies

```bash
# Install root dependencies
npm install

# Build packages
npm run build
```

## Database Schema

### Content Tables
- `worlds` - Story worlds (New School, Sports Academy, etc.)
- `seasons` - Seasons within worlds
- `episodes` - Full episode content (JSONB)
- `characters` - Character profiles

### Player Tables
- `players` - User accounts
- `player_progress` - Episode completion and choices
- `player_traits` - Emotional intelligence tracking
- `character_relationships` - Player-character bonds

### Analytics Tables
- `analytics_events` - Player behavior tracking

### Agent System Tables
- `agent_messages` - Inter-agent communication
- `agent_memory` - Agent learning and context (with vector embeddings)
- `workflows` - Episode creation workflows
- `debates` - Agent disagreement resolution

## Architecture

```
Docker Compose
  ├── PostgreSQL 15 (port 5432)
  │   ├── pgvector extension
  │   └── mirror_studio database
  └── Redis 7 (port 6379)
      ├── Caching
      └── Message Bus (Streams)
```

## Next Steps

After infrastructure is running:

1. **Build Message Bus** - Redis Streams wrapper for agent communication
2. **Build Memory System** - PostgreSQL access + vector search
3. **Complete Base Agent** - Finish BaseAgent class
4. **Integrate LLMs** - Claude + OpenAI clients
5. **Build Developer Agent** - First AI agent that writes code

## Validation

Infrastructure is ready when:
- [ ] Docker containers running (postgres + redis)
- [ ] Database has all tables
- [ ] pgvector extension enabled
- [ ] Redis responding to ping
- [ ] Environment variables set
- [ ] Dependencies installed

## Troubleshooting

### PostgreSQL won't start
```bash
# Check logs
docker-compose logs postgres

# Remove old data and restart
docker-compose down -v
docker-compose up -d
```

### Redis connection refused
```bash
# Check if Redis is running
docker-compose ps redis

# Restart Redis
docker-compose restart redis
```

### Can't connect to database
```bash
# Verify connection string
echo $DATABASE_URL

# Test connection
docker exec -it mirror-postgres psql -U mirror -d mirror_studio -c "SELECT version();"
```

## Files Created

- `docker-compose.yml` - Infrastructure definition
- `infrastructure/db/init/01-schema.sql` - Database schema
- `.env.example` - Environment template
- `.env` - Local configuration
- `infrastructure/README.md` - This file
