# Phase 2 Plan: Review & Validation Agents + Developer Tools

**Date**: July 5, 2026  
**Status**: Planning  
**Prerequisites**: ✅ Phase 1 Complete (4 content-creation agents working)

## Overview

This phase combines two parallel tracks:
1. **Track A**: Build 4 Review & Validation Agents for quality assurance
2. **Track B**: Build Developer Tools to make the system easier to use and manage

Both tracks can proceed in parallel with some synchronization points.

---

## Track A: Review & Validation Agents (4 Agents)

### 1. Child Psychologist Agent (Dr. Sam) 👨‍⚕️

**Mission**: Validate educational content and emotional safety for the target age group

**Responsibilities**:
- Review episodes for age-appropriateness
- Validate educational goal alignment
- Check emotional intensity levels
- Assess developmental appropriateness
- Verify representation and inclusivity
- Flag potential triggers or sensitive content

**Input**:
- Complete episode (story + characters + dialogue)
- Target age range (11-14)
- Educational goals
- Trait development targets

**Output**:
- Approval status (APPROVED / NEEDS_REVISION / REJECTED)
- Age-appropriateness score (1-10)
- Educational effectiveness score (1-10)
- Specific concerns with severity levels
- Revision suggestions
- Alternative approaches

**Integration Points**:
- Reviews after Creative Director approval
- Can request revisions from Story Architect
- Works with Ethics Reviewer on sensitive topics

**Complexity**: High (requires domain knowledge encoding)

---

### 2. Game Designer Agent (Zara) 🎮

**Mission**: Optimize engagement, replayability, and player experience

**Responsibilities**:
- Evaluate choice meaningfulness
- Assess replay value
- Check pacing and flow
- Validate trait change mechanics
- Identify engagement drops
- Suggest UX improvements

**Input**:
- Episode outline with branches
- Choice architecture
- Trait mapping
- Estimated play time
- Previous player data (if available)

**Output**:
- Engagement score (1-10)
- Replayability score (1-10)
- Pacing analysis
- Choice quality assessment
- Specific improvement suggestions
- A/B test recommendations

**Integration Points**:
- Reviews after Creative Director
- Can suggest revisions to Story Architect
- Provides feedback to Dialogue Writer on pacing

**Complexity**: Medium-High (game design heuristics)

---

### 3. Ethics Reviewer Agent (Dr. Chen) ⚖️

**Mission**: Ensure content safety, representation, and ethical standards

**Responsibilities**:
- Review for harmful stereotypes
- Check representation diversity
- Assess power dynamics in relationships
- Validate consent in scenarios
- Flag problematic messaging
- Ensure cultural sensitivity

**Input**:
- Complete episode
- Character profiles
- Dialogue
- World context
- Relationship dynamics

**Output**:
- Safety status (SAFE / CONCERNS / UNSAFE)
- Representation assessment
- Flagged content with explanations
- Required changes (mandatory vs. recommended)
- Alternative approaches
- Cultural consultation needs

**Integration Points**:
- Reviews in parallel with Child Psychologist
- Can veto episodes (safety blocker)
- Works with Character Designer on representation

**Complexity**: High (nuanced ethical reasoning)

---

### 4. QA Reviewer Agent 🔍

**Mission**: Technical quality assurance and consistency checking

**Responsibilities**:
- Validate JSON structure
- Check data completeness
- Verify ID consistency
- Test branching logic
- Check for plot holes
- Validate trait mappings
- Ensure character consistency

**Input**:
- Complete episode JSON
- Schema definitions
- Previous episodes (for consistency)
- Character database

**Output**:
- Technical status (PASS / FAIL)
- Validation errors (with line numbers)
- Consistency issues
- Missing data
- Logic errors in branching
- Fixable issues vs. blockers

**Integration Points**:
- Reviews after all other agents
- Automatic checks (can run as pre-commit)
- Provides feedback to all content agents

**Complexity**: Medium (mostly structural validation)

---

## Track B: Developer Tools

### 1. Web UI for Episode Management 🌐

**Purpose**: Make it easy to generate, review, and manage episodes

**Features**:

#### Episode Generator Interface
- Form to input episode brief
  - World selection (dropdown)
  - Season/episode number
  - Themes (multi-select)
  - Target traits (multi-select)
  - Synopsis (textarea)
- "Generate Episode" button
- Progress indicator showing agent status
  - Story Architect: [In Progress] [Complete]
  - Character Designer: [Waiting] [In Progress]
  - etc.
- Real-time console output
- Estimated time remaining

#### Episode Review Dashboard
- List of all generated episodes
- Status badges (Draft, Approved, Needs Revision, Rejected)
- Filter by status, world, date
- Search functionality
- Quick actions (View, Edit, Regenerate, Delete)

#### Episode Viewer
- Formatted display of episode content
- Tabbed interface:
  - Story Outline
  - Characters
  - Dialogue
  - Reviews (from all 4 validation agents)
- Diff view for revisions
- Export as JSON/PDF

#### Agent Configuration
- Model selection per agent
- Temperature/effort sliders
- Max tokens configuration
- Save presets (e.g., "Fast Draft", "High Quality")

**Tech Stack**:
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Next.js API routes
- **Real-time**: Server-Sent Events (SSE) for progress updates
- **Storage**: SQLite (local) or PostgreSQL (production)

**Complexity**: Medium-High (full-stack app)

---

### 2. Content Editor/Reviewer 📝

**Purpose**: Manually review and edit generated content

**Features**:

#### Episode Editor
- Rich text editor for each section
- Inline edit mode
- Version history
- Change tracking
- Comment/annotation system

#### Character Editor
- Form-based editing of all character fields
- Voice guidelines editor
- Relationship graph visualization
- Character consistency checker

#### Dialogue Editor
- Scene-by-scene dialogue editing
- Character voice preview
- Inline emotion/action editing
- Audio preview (TTS integration)
- Alternative line suggestions

#### Review Workflow
- Assign episodes for review
- Add reviewer notes
- Request specific agent re-runs
- Approve/reject with comments
- Track revision history

**Tech Stack**:
- **Editor**: Lexical (Meta's rich text framework)
- **State**: Zustand or Jotai
- **Validation**: Zod (reuse existing schemas)

**Complexity**: High (rich editing features)

---

### 3. Analytics Dashboard 📊

**Purpose**: Monitor system performance and content quality

**Features**:

#### Episode Analytics
- Episodes generated over time
- Success rate (approved vs. rejected)
- Average generation time per agent
- Agent performance trends
- Error rates and types

#### Content Quality Metrics
- Average quality scores by agent
- Common rejection reasons
- Trait coverage across episodes
- Theme distribution
- Character diversity metrics

#### Cost Tracking
- API costs per episode
- Cost per agent
- Token usage trends
- Budget alerts
- Cost optimization suggestions

#### System Health
- Agent status (operational/degraded)
- API response times
- Error logs
- Uptime monitoring
- Queue depth (if async)

**Tech Stack**:
- **Visualization**: Recharts or Chart.js
- **Data**: Aggregate from episode database
- **Real-time**: WebSocket for live updates

**Complexity**: Medium

---

### 4. CI/CD Pipeline 🚀

**Purpose**: Automated testing, building, and deployment

**Features**:

#### Automated Testing
- Run all tests on PR
- Integration tests with real Claude calls (staging)
- Schema validation tests
- Agent output quality tests
- Performance benchmarks

#### Build Pipeline
- TypeScript compilation
- Bundle optimization
- Docker image building
- Multi-stage builds (dev/staging/prod)

#### Deployment
- Auto-deploy to staging on merge to `develop`
- Manual promotion to production
- Blue-green deployment
- Rollback capability
- Environment config management

#### Monitoring
- Sentry for error tracking
- DataDog/NewRelic for APM
- Claude API usage monitoring
- Alert on failures

**Tech Stack**:
- **CI**: GitHub Actions
- **CD**: Docker + Docker Compose
- **Hosting**: Railway / Render / Vercel
- **Monitoring**: Sentry + Grafana

**Complexity**: Medium-High (DevOps)

---

## Implementation Sequence

### Phase 2A: Foundation (Week 1-2)
**Goal**: Get basic infrastructure in place

1. **Set up web UI skeleton** (Track B.1)
   - Next.js app with basic routing
   - Connect to existing agents
   - Simple episode generation form

2. **Build QA Reviewer agent** (Track A.4)
   - Easiest validation agent
   - Provides immediate value
   - Can run automatically

3. **Add basic analytics** (Track B.3)
   - Episode list with metadata
   - Simple charts (episodes over time, success rate)

**Deliverable**: Working web UI that can generate episodes and shows basic analytics

---

### Phase 2B: Quality Layer (Week 3-4)
**Goal**: Add human-like quality review

4. **Build Game Designer agent** (Track A.2)
   - Engagement-focused review
   - Actionable feedback
   - Integration with UI

5. **Build Child Psychologist agent** (Track A.1)
   - Age-appropriateness checking
   - Educational validation
   - Integration with UI

6. **Add episode viewer/editor** (Track B.2)
   - View generated content nicely formatted
   - Basic editing capabilities
   - Review workflow

**Deliverable**: Full quality review pipeline with 2 validation agents

---

### Phase 2C: Ethics & Polish (Week 5-6)
**Goal**: Safety and production readiness

7. **Build Ethics Reviewer agent** (Track A.3)
   - Safety and representation checking
   - Veto power for unsafe content
   - Integration with UI

8. **Complete content editor** (Track B.2)
   - Rich editing features
   - Version control
   - Collaboration tools

9. **Complete analytics dashboard** (Track B.3)
   - All metrics implemented
   - Cost tracking
   - Quality trends

**Deliverable**: Production-ready system with full quality assurance

---

### Phase 2D: DevOps & Scale (Week 7-8)
**Goal**: Production deployment and automation

10. **Set up CI/CD pipeline** (Track B.4)
    - Automated testing
    - Deployment automation
    - Monitoring and alerting

11. **Performance optimization**
    - Caching strategies
    - Parallel agent execution
    - Cost optimization

12. **Documentation and onboarding**
    - User guides
    - API documentation
    - Video tutorials

**Deliverable**: Deployed system with full automation

---

## Success Metrics

### Track A (Agents)
- ✅ All 4 validation agents implemented
- ✅ Agent review time < 30s each
- ✅ Review quality matches human judgment (80%+ agreement)
- ✅ False positive rate < 10%
- ✅ Integrated into content pipeline

### Track B (Tools)
- ✅ Web UI deployed and accessible
- ✅ Episode generation < 5 clicks
- ✅ Review workflow < 10 minutes per episode
- ✅ Analytics dashboard with key metrics
- ✅ CI/CD pipeline with < 10 min build time

### Overall
- ✅ End-to-end episode generation + review < 10 minutes
- ✅ Content quality approval rate > 70%
- ✅ System can generate 10 episodes/day
- ✅ Developer onboarding time < 1 hour
- ✅ Zero production incidents in first month

---

## Technical Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Web UI (Next.js)                     │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Generator  │  │   Reviewer   │  │   Analytics    │  │
│  │   Form     │  │  Dashboard   │  │   Dashboard    │  │
│  └────────────┘  └──────────────┘  └────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/SSE
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Backend API (Next.js API Routes)            │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Agent Orchestration Service            │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│  Content Agents  │          │ Validation Agents│
│                  │          │                  │
│ • Story Architect│          │ • Child Psych    │
│ • Char Designer  │────────▶ │ • Game Designer  │
│ • Dialogue Writer│          │ • Ethics Review  │
│ • Creative Dir.  │          │ • QA Reviewer    │
└────────┬─────────┘          └────────┬─────────┘
         │                             │
         └──────────────┬──────────────┘
                        ▼
         ┌──────────────────────────────┐
         │      PostgreSQL Database      │
         │  • Episodes                   │
         │  • Characters                 │
         │  • Reviews                    │
         │  • Analytics                  │
         └──────────────────────────────┘
```

### Data Flow

```
1. User submits episode brief via Web UI
   ↓
2. API creates job and returns job ID
   ↓
3. Orchestrator runs content agents sequentially:
   Story Architect → Character Designer → Dialogue Writer → Creative Director
   ↓
4. If Creative Director approves, run validation agents in parallel:
   Child Psychologist || Game Designer || Ethics Reviewer || QA Reviewer
   ↓
5. Aggregate reviews and determine final status:
   - All approve → READY_TO_PUBLISH
   - Some concerns → NEEDS_REVISION
   - Any reject → REJECTED
   ↓
6. Store in database and notify user via SSE
   ↓
7. User reviews in Web UI and can:
   - Approve for publishing
   - Request specific revisions
   - Edit manually
   - Regenerate
```

---

## Resource Requirements

### Development Team
- **1 Full-stack developer** (Web UI + Backend)
- **1 AI/ML engineer** (Agent development)
- **1 DevOps engineer** (part-time, CI/CD setup)

Or with AI agents:
- **You + AI assistants** can build everything! 🚀

### Infrastructure
- **Development**: Local or GitHub Codespaces
- **Staging**: Railway or Render (free tier OK)
- **Production**: 
  - Compute: 2-4 CPU cores, 8GB RAM
  - Storage: 20GB (episodes + database)
  - CDN: Vercel or Cloudflare
- **Claude API**: Budget $100-500/month depending on volume

### Timeline
- **Phase 2A**: 2 weeks
- **Phase 2B**: 2 weeks  
- **Phase 2C**: 2 weeks
- **Phase 2D**: 2 weeks
- **Total**: 8 weeks (2 months)

With focused effort and AI assistance, could compress to 4-6 weeks.

---

## Risks & Mitigations

### Risk 1: Agent Quality Inconsistent
**Mitigation**: Start with QA Reviewer (structural validation), iterate on others with real episodes

### Risk 2: Web UI Complexity
**Mitigation**: Use proven tech stack (Next.js + Tailwind), start with MVP

### Risk 3: Claude API Costs
**Mitigation**: Implement caching, batch processing, cost monitoring, set budget alerts

### Risk 4: Review Agent Domain Knowledge
**Mitigation**: Research best practices, consult experts, iterate based on feedback

### Risk 5: Integration Complexity
**Mitigation**: Build one agent at a time, test thoroughly before adding next

---

## Next Steps

### Immediate (This Week)
1. **Decide on starting point**: 
   - Option A: Start with Web UI (Track B.1) - enables faster iteration
   - Option B: Start with QA Reviewer (Track A.4) - quickest validation win
   - Option C: Both in parallel - faster but more complex

2. **Set up development environment**:
   - Create `phase-2-agents` branch
   - Set up Next.js project structure
   - Plan database schema

3. **Write specifications**:
   - Detailed specs for first 2 agents (QA Reviewer + Game Designer)
   - Web UI wireframes/mockups
   - API endpoint definitions

### This Month
- Complete Phase 2A (foundation)
- Have working web UI generating episodes
- QA Reviewer agent operational
- Basic analytics showing

**Ready to start? Which option do you prefer for starting point (A, B, or C)?**
