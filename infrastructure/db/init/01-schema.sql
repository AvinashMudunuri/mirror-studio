-- Initialize mirror-studio database with pgvector extension and base schema

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum types
CREATE TYPE agent_id AS ENUM (
  'CEO',
  'CREATIVE_DIRECTOR',
  'STORY_ARCHITECT',
  'WORLD_BUILDER',
  'CHARACTER_DESIGNER',
  'DIALOGUE_WRITER',
  'GAME_DESIGNER',
  'CHILD_PSYCHOLOGIST',
  'LEARNING_SCIENTIST',
  'ETHICS_REVIEWER',
  'SPORTS_CONSULTANT',
  'ANIME_CONSULTANT',
  'TEEN_REVIEWER',
  'PARENT_REVIEWER',
  'QA_REVIEWER',
  'PUBLISHER',
  'ANALYTICS',
  'ILLUSTRATION',
  'VOICE_SCRIPT',
  'JSON_EXPORT',
  'TECH_LEAD',
  'BACKEND_DEVELOPER',
  'FRONTEND_DEVELOPER',
  'DEVOPS'
);

CREATE TYPE message_type AS ENUM (
  'REQUEST',
  'RESPONSE',
  'CHALLENGE',
  'APPROVAL',
  'REJECTION',
  'BROADCAST',
  'QUERY'
);

CREATE TYPE workflow_status AS ENUM (
  'PLANNING',
  'CREATING',
  'REVIEWING',
  'DEBATING',
  'REVISING',
  'PUBLISHING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE episode_status AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE memory_scope AS ENUM (
  'EPISODE',
  'AGENT_WORKING',
  'INSTITUTIONAL',
  'PLAYER'
);

-- ============================================================================
-- CONTENT TABLES
-- ============================================================================

-- Worlds
CREATE TABLE worlds (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  themes TEXT[],
  target_age_min INTEGER NOT NULL,
  target_age_max INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seasons
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id VARCHAR(50) REFERENCES worlds(id),
  season_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  themes TEXT[],
  episode_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(world_id, season_number)
);

-- Episodes
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id),
  episode_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  synopsis TEXT,
  content JSONB NOT NULL, -- Full episode JSON. Mutated by every pipeline
                          -- run (persist-episode.js) — NOT what a
                          -- frontend should ever read directly.
  status episode_status DEFAULT 'DRAFT',
  created_by agent_id[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP,
  -- Durable publish snapshot (docs/decisions/003-publish-scope-proposal.md):
  -- frozen copies of content/metadata at the moment a human published this
  -- episode, decoupled from later pipeline re-runs. persist-episode.js's
  -- UPSERT never lists these columns, so ordinary runs never touch them —
  -- only the admin publish action does. A frontend should read
  -- published_content, never content.
  published_content JSONB,
  published_metadata JSONB,
  published_run_folder VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  UNIQUE(season_id, episode_number)
);

CREATE INDEX idx_episodes_status ON episodes(status);
CREATE INDEX idx_episodes_season ON episodes(season_id);

-- Characters
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id VARCHAR(50) REFERENCES worlds(id),
  name VARCHAR(255) NOT NULL,
  age INTEGER,
  pronouns VARCHAR(50),
  personality JSONB NOT NULL,
  background JSONB NOT NULL,
  voice_guidelines JSONB NOT NULL,
  relationships JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_characters_world ON characters(world_id);

-- ============================================================================
-- PLAYER TABLES
-- ============================================================================

-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  age INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Player Progress
CREATE TABLE player_progress (
  player_id UUID REFERENCES players(id),
  episode_id UUID REFERENCES episodes(id),
  completed_at TIMESTAMP,
  choices JSONB NOT NULL, -- All choices made
  play_time_seconds INTEGER,
  PRIMARY KEY(player_id, episode_id)
);

CREATE INDEX idx_player_progress_player ON player_progress(player_id);
CREATE INDEX idx_player_progress_episode ON player_progress(episode_id);

-- Player Traits
CREATE TABLE player_traits (
  player_id UUID REFERENCES players(id),
  trait_id VARCHAR(50) NOT NULL,
  value INTEGER NOT NULL CHECK (value >= 0 AND value <= 100),
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  history JSONB DEFAULT '[]',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(player_id, trait_id)
);

-- Character Relationships (player-specific)
CREATE TABLE character_relationships (
  player_id UUID REFERENCES players(id),
  character_id UUID REFERENCES characters(id),
  friendship INTEGER DEFAULT 50 CHECK (friendship >= -100 AND friendship <= 100),
  trust INTEGER DEFAULT 50 CHECK (trust >= -100 AND trust <= 100),
  respect INTEGER DEFAULT 50 CHECK (respect >= -100 AND respect <= 100),
  rivalry INTEGER DEFAULT 0 CHECK (rivalry >= -100 AND rivalry <= 100),
  last_interaction TIMESTAMP,
  history JSONB DEFAULT '[]',
  PRIMARY KEY(player_id, character_id)
);

-- ============================================================================
-- ANALYTICS TABLES
-- ============================================================================

-- Analytics Events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  episode_id UUID REFERENCES episodes(id),
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_player ON analytics_events(player_id);
CREATE INDEX idx_analytics_episode ON analytics_events(episode_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp);

-- ============================================================================
-- AGENT SYSTEM TABLES
-- ============================================================================

-- Agent Messages
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent agent_id NOT NULL,
  to_agent agent_id NOT NULL,
  thread_id UUID NOT NULL,
  workflow_id UUID NOT NULL,
  type message_type NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  payload JSONB NOT NULL,
  reply_to UUID,
  requires_response BOOLEAN DEFAULT false,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_messages_thread ON agent_messages(thread_id);
CREATE INDEX idx_messages_workflow ON agent_messages(workflow_id);
CREATE INDEX idx_messages_to ON agent_messages(to_agent);
CREATE INDEX idx_messages_timestamp ON agent_messages(timestamp);

-- Agent Memory (with vector embeddings)
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id agent_id NOT NULL,
  scope memory_scope NOT NULL,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  embedding vector(3072), -- text-embedding-3-large dimensions
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  -- MemorySystem.store() upserts with ON CONFLICT (agent_id, key);
  -- without this constraint every store() throws.
  CONSTRAINT agent_memory_agent_id_key_unique UNIQUE (agent_id, key)
);

CREATE INDEX idx_memory_agent ON agent_memory(agent_id);
CREATE INDEX idx_memory_scope ON agent_memory(scope);
-- NOTE: no vector index. ivfflat/hnsw cap at 2000 dimensions and the
-- embedding column is 3072 (text-embedding-3-large) — the old ivfflat
-- index made the whole init script fail. Sequential scan is fine at
-- current memory volumes; revisit (halfvec or 1536-dim embeddings) if
-- semantic search gets slow.

-- Workflows
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(100) NOT NULL,
  status workflow_status DEFAULT 'PLANNING',
  target JSONB NOT NULL,
  state JSONB DEFAULT '{}',
  participants agent_id[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_type ON workflows(type);

-- Debates
CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  topic VARCHAR(500) NOT NULL,
  participants agent_id[] NOT NULL,
  positions JSONB NOT NULL,
  evidence JSONB DEFAULT '[]',
  resolution JSONB,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_debates_workflow ON debates(workflow_id);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert initial worlds
INSERT INTO worlds (id, name, description, themes, target_age_min, target_age_max) VALUES
('NEW_SCHOOL', 'New School', 'Navigate friendships, identity, and belonging in a new school environment', 
 ARRAY['Belonging', 'Identity', 'Friendship', 'Integrity'], 11, 14),
('SPORTS_ACADEMY', 'Sports Academy', 'Learn resilience, leadership, and teamwork through competitive sports',
 ARRAY['Resilience', 'Leadership', 'Teamwork', 'Competition'], 12, 16),
('ANIME_HERO', 'Anime Hero Journey', 'Discover courage and responsibility in a hero''s journey',
 ARRAY['Courage', 'Self-Discovery', 'Responsibility', 'Sacrifice'], 12, 17);

-- Create initial season for New School
INSERT INTO seasons (world_id, season_number, title, description, themes)
VALUES ('NEW_SCHOOL', 1, 'First Days', 'The challenges and opportunities of starting at a new school',
        ARRAY['First Impressions', 'Making Friends', 'Finding Your Place']);

COMMIT;
