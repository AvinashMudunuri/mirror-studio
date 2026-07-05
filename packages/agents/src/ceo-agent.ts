import { BaseAgent, AgentConfig } from './base-agent';
import { CEOInput, CEOOutput, CEOInputSchema, CEOOutputSchema } from '@mirror/schemas';

/**
 * CEO Agent (Morgan)
 * 
 * Strategic overseer and final decision-maker
 * 
 * Mission: Ensure every published episode serves the platform's mission -
 * help young people practice life through stories.
 * 
 * Responsibilities:
 * - Approve or reject all episodes before publishing
 * - Resolve agent debates that reach deadlock
 * - Set strategic priorities
 * - Review analytics and adjust creative direction
 * - Manage agent performance
 */

const CEO_SYSTEM_PROMPT = `You are Morgan, the CEO of Project MIRROR Studio.

Your mission: Ensure every published episode helps teenagers develop emotional intelligence through immersive story experiences.

CURRENT CONTEXT:
{context}

CORE PRINCIPLES:
1. Story first - never feel like a test
2. Growth over scores
3. Reflection over judgment
4. Replayability matters
5. Inspire conversation

DECISION FRAMEWORK:
- Does it serve our mission?
- Will teenagers engage with it?
- Is it educational without feeling like school?
- Are the trait mappings subtle and accurate?
- Does it create conversation opportunities?
- Are there any risks?

Be decisive. Be clear. Prioritize player experience above all.`;

export class CEOAgent extends BaseAgent {
  constructor() {
    super({
      id: 'CEO',
      name: 'Morgan',
      role: 'CEO and Strategic Overseer',
      model: 'claude-3-5-sonnet-20240620',
      temperature: 0.3, // Lower temperature for consistent decision-making
      maxTokens: 4096
    });
  }
  
  protected async execute(input: CEOInput): Promise<CEOOutput> {
    // Validate input
    const validated = CEOInputSchema.parse(input);
    
    switch (validated.type) {
      case 'APPROVAL_REQUEST':
        return await this.reviewEpisode(validated.episode!);
        
      case 'DEBATE_ESCALATION':
        return await this.resolveDebate(validated.debate!);
        
      case 'SPRINT_PLANNING':
        return await this.planSprint(validated.sprintPlan!);
        
      case 'ANALYTICS_REVIEW':
        return await this.reviewAnalytics(validated.analytics!);
        
      default:
        throw new Error(`Unknown CEO input type: ${validated.type}`);
    }
  }
  
  private async reviewEpisode(episode: any): Promise<CEOOutput> {
    // Retrieve relevant context from memory
    const recentEpisodes = await this.recall('recent_episodes') || [];
    const strategicPriorities = await this.recall('strategic_priorities') || [];
    const performanceMetrics = await this.recall('performance_metrics') || {};
    
    const context = {
      recentEpisodes,
      strategicPriorities,
      performanceMetrics
    };
    
    // Build the prompt
    const userPrompt = this.buildEpisodeReviewPrompt(episode, context);
    
    // Call LLM for decision
    const response = await this.callLLM(
      CEO_SYSTEM_PROMPT.replace('{context}', JSON.stringify(context, null, 2)),
      userPrompt
    );
    
    // Parse LLM response into structured output
    const output = this.parseEpisodeReviewResponse(response);
    
    // Store decision in memory
    await this.remember(`decision:${episode.content.id}`, output);
    
    // If approved, notify publisher
    if (output.decision === 'APPROVED') {
      await this.sendMessage('PUBLISHER', 'REQUEST', {
        action: 'PUBLISH',
        episodeId: episode.content.id
      }, { priority: 'HIGH' });
    }
    
    // If revision needed, notify relevant agents
    if (output.decision === 'NEEDS_REVISION') {
      for (const feedback of output.feedback) {
        await this.sendMessage(feedback.agentId, 'REQUEST', {
          action: 'REVISE',
          episodeId: episode.content.id,
          feedback: feedback.message
        }, { priority: 'HIGH' });
      }
    }
    
    return output;
  }
  
  private buildEpisodeReviewPrompt(episode: any, context: any): string {
    return `
EPISODE UNDER REVIEW:
Title: ${episode.content.title}
World: ${episode.content.worldId}
Episode: ${episode.content.episodeNumber}
Synopsis: ${episode.content.synopsis}

AGENT REVIEWS:
${episode.reviews.map((r: any) => `
${r.agentId}: ${r.decision}
${r.notes || ''}
`).join('\n')}

${episode.debates && episode.debates.length > 0 ? `
DEBATES:
${episode.debates.map((d: any) => `
Topic: ${d.topic}
${d.positions.map((p: any) => `${p.agent}: ${p.position}`).join('\n')}
`).join('\n')}
` : ''}

YOUR TASK:
Review this episode for final approval.

Provide your decision in this format:

DECISION: [APPROVED | REJECTED | NEEDS_REVISION | ESCALATE_TO_HUMAN]

REASONING:
[Your clear reasoning for this decision]

FEEDBACK:
${episode.reviews.map((r: any) => `
${r.agentId}: [Specific feedback if needed]
`).join('\n')}

ACTION ITEMS:
[If revision needed, list specific actions with deadlines]

STRATEGIC NOTES:
[Any strategic observations for future episodes]
`.trim();
  }
  
  private parseEpisodeReviewResponse(response: string): CEOOutput {
    // Simple parsing - in production, use more robust parsing or structured output
    const decisionMatch = response.match(/DECISION:\s*(APPROVED|REJECTED|NEEDS_REVISION|ESCALATE_TO_HUMAN)/i);
    const decision = (decisionMatch?.[1] || 'NEEDS_REVISION') as CEOOutput['decision'];
    
    const reasoningMatch = response.match(/REASONING:\s*\n([\s\S]*?)(?=\n\n|FEEDBACK:|$)/i);
    const reasoning = reasoningMatch?.[1]?.trim() || 'No reasoning provided';
    
    // Extract feedback (simplified)
    const feedback: CEOOutput['feedback'] = [];
    
    // Extract action items (simplified)
    const actionItems: CEOOutput['actionItems'] = [];
    
    const strategicNotesMatch = response.match(/STRATEGIC NOTES:\s*\n([\s\S]*?)$/i);
    const strategicNotes = strategicNotesMatch?.[1]?.trim();
    
    return {
      decision,
      reasoning,
      feedback,
      actionItems,
      strategicNotes
    };
  }
  
  private async resolveDebate(debate: any): Promise<CEOOutput> {
    // Implement debate resolution logic
    // This would involve reviewing all positions and making a final call
    
    return {
      decision: 'NEEDS_REVISION',
      reasoning: 'Debate resolution not yet implemented',
      feedback: []
    };
  }
  
  private async planSprint(sprintPlan: any): Promise<CEOOutput> {
    // Implement sprint planning logic
    
    return {
      decision: 'APPROVED',
      reasoning: 'Sprint planning not yet implemented',
      feedback: []
    };
  }
  
  private async reviewAnalytics(analytics: any): Promise<CEOOutput> {
    // Implement analytics review logic
    
    return {
      decision: 'APPROVED',
      reasoning: 'Analytics review not yet implemented',
      feedback: []
    };
  }
}
