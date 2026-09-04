export type PanelRole = {
  role_name: string
  model: string
  system_prompt: string
}

export type CouncilDebateDefinition = {
  reviewers: [PanelRole, PanelRole, PanelRole]
  moderator: PanelRole
}

/**
 * The chat Council starts from a tool-informed lead answer, then gives the same
 * draft to three independent reviewers before the chair writes the final reply.
 */
export const COUNCIL_DEBATE: CouncilDebateDefinition = {
  reviewers: [
    {
      role_name: 'Evidence reviewer',
      model: 'qwen35-27b',
      system_prompt:
        'Check the proposed answer against the conversation and any tool evidence. Identify unsupported claims, missing facts, or places where uncertainty must be stated.',
    },
    {
      role_name: 'Skeptic',
      model: 'gpt-oss-120b',
      system_prompt:
        'Challenge the proposed answer. Look for weak assumptions, counterexamples, safety issues, and conclusions that do not follow from the evidence.',
    },
    {
      role_name: 'Student advocate',
      model: 'qwen35-27b',
      system_prompt:
        'Judge whether the proposed answer directly helps the student. Recommend a clearer, more practical answer and call out important tradeoffs it missed.',
    },
  ],
  moderator: {
    role_name: 'Council chair',
    model: 'qwen35-27b',
    system_prompt:
      'Resolve disagreements between the lead answer and the reviewers. Produce the most accurate, useful final answer supported by the available evidence.',
  },
}
