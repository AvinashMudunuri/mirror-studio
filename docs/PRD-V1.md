# Project MIRROR Studio

## Product Requirements Document (PRD)

**Version 1.0**

---

## Vision

Create an AI-powered storytelling platform that helps teenagers develop emotional intelligence, decision-making, empathy, resilience, and self-awareness through immersive interactive stories.

Unlike traditional quizzes, users should never feel they are taking a psychological assessment.

Instead, they should feel like they are playing a Netflix-style interactive series where every decision shapes the world.

Behind the scenes, an AI studio of specialized agents collaborates to create, review, improve, and publish these stories.

---

## Mission

Help young people practice life through stories before life tests them in reality.

---

## Core Philosophy

### The platform does NOT:

* Judge children
* Diagnose personalities
* Label users
* Compare users

### The platform DOES:

* Encourage reflection
* Promote discussion
* Create immersive experiences
* Help users understand themselves
* Show growth over time

---

## Target Audience

### Primary

**Age**: 11–17

**Interested in**:
* Sports
* Anime
* Adventure
* Gaming
* Fantasy
* Mystery

### Secondary

* Parents
* Teachers
* School Counselors

---

## Product Pillars

### Pillar 1: Story First

Users never feel like they are answering questions.

### Pillar 2: Growth Over Scores

No IQ-like numbers. Only personal growth.

### Pillar 3: Reflection

Every episode ends with thoughtful observations instead of judgments.

### Pillar 4: Replayability

Choices genuinely change future events.

### Pillar 5: Conversation

Parents and children should naturally discuss scenarios.

---

## High Level Architecture

```
Player
  ↓
Story Engine
  ↓
Choice Engine
  ↓
Relationship Engine
  ↓
Trait Engine
  ↓
Reflection Engine
  ↓
Analytics
```

---

## Major Components

### Story Engine

**Responsible for**:
* Worlds
* Seasons
* Episodes
* Scenes
* Branches

**Structure**:
```
World
  ↓
Season
  ↓
Episode
  ↓
Scene
  ↓
Decision
  ↓
Consequence
  ↓
Next Scene
```

### Character Engine

**Each character has**:
* Name
* Age
* Personality
* Goals
* Secrets
* Relationships
  * Trust
  * Friendship
  * Respect
  * Fear
* Memory
* Story Role

Characters remember previous interactions.

### Relationship Engine

**Every interaction updates**:
* Friendship
* Trust
* Respect
* Rivalry
* Influence

**Example**:
* Player helps friend → Trust +5
* Player lies → Trust -8

### Trait Engine

**Tracks**:
* Empathy
* Leadership
* Resilience
* Curiosity
* Integrity
* Communication
* Adaptability
* Confidence
* Judgment
* Emotional Awareness

**Important**: One choice NEVER changes a trait dramatically. Patterns matter.

### Reflection Engine

**Instead of**: "You are emotional."  
**Generate**: "You often pause before reacting when someone is hurt."

**Instead of**: "Low confidence"  
**Generate**: "You sometimes wait for others to take the first step."

Always encourage growth.

---

## Worlds

1. **Season 1**: New School
2. **Season 2**: Sports Academy
3. **Season 3**: Anime Hero Journey
4. **Season 4**: Fantasy Kingdom
5. **Season 5**: Space Colony
6. **Season 6**: Detective Academy
7. **Season 7**: Zombie Survival
8. **Season 8**: Cricket World Cup

---

## Episode Structure

```
Opening Scene
  ↓
Dialogue
  ↓
Conflict
  ↓
Choice
  ↓
Immediate Result
  ↓
Relationship Update
  ↓
Next Scene
  ↓
Episode Reflection
```

**Average duration**: 10–15 minutes

---

## Decision Types

* Multiple Choice
* Priority Ranking
* Conversation
* Quick Reaction
* Resource Allocation
* Ethical Dilemma
* Negotiation
* Leadership Decision

---

## Reward System

**Not coins. Not gems.**

**Rewards**:
* New Stories
* New Characters
* Behind-the-scenes content
* Character Memories
* Alternate Endings
* Journal Entries
* Achievements

---

## Parent Mode

### Parent never sees:
* Every answer
* Private thoughts
* Exact scores

### Parent sees:
* Growth trends
* Conversation starters
* Weekly summaries
* Suggestions

**Example**: "This week your child often chose teamwork over personal success."

---

## Teacher Mode

* Class analytics
* Anonymous insights
* Discussion topics
* Reflection questions

**No student ranking.**

---

## AI Studio

The AI Studio creates every episode.

### Organization

1. **CEO Agent**
2. **Creative Director**
3. **Story Architect**
4. **World Builder**
5. **Character Designer**
6. **Dialogue Writer**
7. **Game Designer**
8. **Child Psychologist**
9. **Learning Scientist**
10. **Ethics Reviewer**
11. **Sports Consultant**
12. **Anime Consultant**
13. **Teen Reviewer**
14. **Parent Reviewer**
15. **QA Reviewer**
16. **Publisher**
17. **Analytics Agent**
18. **Illustration Agent**
19. **Voice Script Agent**
20. **JSON Export Agent**

### Agent Template

Every agent contains:
* Name
* Role
* Mission
* Expertise
* Responsibilities
* Input
* Output
* Constraints
* Memory
* KPIs
* Prompt
* Examples
* Review Checklist

---

## Agent Workflow

```
CEO
  ↓
Sprint Planning
  ↓
Story Architect
  ↓
Character Designer
  ↓
Dialogue Writer
  ↓
Psychologist
  ↓
Learning Scientist
  ↓
Game Designer
  ↓
QA
  ↓
Publisher
  ↓
Release
```

---

## Agent Debate

Every important decision can be challenged.

**Example**:

**Story Architect**: "I want the character to lose."

**Psychologist**: "Failure alone doesn't teach resilience."

**Game Designer**: "Let's allow recovery."

**CEO**: "Approved."

---

## Internal Memory

Each agent remembers:
* Past reviews
* Rejected ideas
* Successful episodes
* Player feedback
* Favorite story structures

---

## Story JSON Schema

* World
* Season
* Episode
* Scene
* Characters
* Dialogue
* Choices
* Consequences
* Relationship Updates
* Trait Updates
* Reflection
* Achievements
* Next Episode

---

## Analytics

### Track:
* Episode Completion
* Drop-off Rate
* Average Reading Time
* Replay Count
* Favorite Character
* Favorite World
* Reflection Read Rate
* Choice Distribution
* Conversation Trigger Rate

---

## AI Memory

### Long-term:
* Player profile
* Character memories
* Story continuity
* Relationships
* Recent emotions
* Unlocked endings

---

## Technical Stack

### Frontend
* React
* TypeScript
* MUI
* Framer Motion
* React Query

### Backend
* Node.js
* Express

### Database
* PostgreSQL
* Redis

### Vector Database
* (TBD)

### AI
* OpenAI
* Anthropic
* Gemini (optional)

### Orchestrator
* LangGraph or custom workflow engine

### Storage
* Object Storage
* PostgreSQL

### Monitoring
* OpenTelemetry
* Grafana
* Sentry

---

## Folder Structure

```
mirror-studio/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── agents/
│   ├── prompts/
│   ├── engine/
│   ├── memory/
│   ├── analytics/
│   ├── ui/
│   ├── schemas/
│   ├── stories/
│   └── evaluation/
├── docs/
├── tests/
└── tools/
```

---

## Milestones

### Milestone 1: Foundation
* Story Engine
* Character Engine
* Episode Viewer
* Choice Engine

### Milestone 2: Relationships
* Character Memory
* Player Memory
* Journal

### Milestone 3: AI Studio
* Story generation
* Review
* Debate
* Approval
* Publishing

### Milestone 4: Netflix Experience
* Animations
* Music
* Voice
* Episode Selection
* Achievements

### Milestone 5: Parent Portal
* Growth
* Conversation Topics
* Weekly Reports

---

## Success Metrics

* Player finishes first season
* Player returns next week
* Parent starts conversations
* Teacher uses stories in class
* Average episode completion >80%
* Replay rate >30%
* Average session >12 minutes

---

## Future Vision

Project MIRROR Studio evolves beyond a single application into an **AI Company Operating System**.

The same agent architecture can power:
* Educational content studios
* Game development studios
* Software engineering teams
* Product management teams
* Research organizations
* Writing and publishing teams

The emotional-intelligence game is the first product built by the studio, but the long-term vision is a reusable framework where autonomous AI specialists collaborate, debate, learn from feedback, and continuously improve the products they create.

---

## Guiding Principle

People won't remember the score they received. They'll remember the story they lived—and the conversations it inspired.

---

**END OF PRD v1.0**
