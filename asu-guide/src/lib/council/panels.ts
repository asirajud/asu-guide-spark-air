export type PanelRole = {
  role_name: string
  model: string
  system_prompt: string
}

export type PanelDefinition = {
  panelists: [PanelRole, PanelRole, PanelRole, PanelRole]
  moderator: PanelRole
}

export const PANEL_DEFINITIONS: Record<'study' | 'rubric', PanelDefinition> = {
  study: {
    panelists: [
      {
        role_name: 'pedagogy_1',
        model: 'qwen35-27b',
        system_prompt: 'Explain from historical perspective.',
      },
      {
        role_name: 'pedagogy_2',
        model: 'qwen35-27b',
        system_prompt: 'Explain from real-world application perspective.',
      },
      {
        role_name: 'pedagogy_3',
        model: 'qwen35-27b',
        system_prompt: 'Explain from mathematical formalism perspective.',
      },
      {
        role_name: 'pedagogy_4',
        model: 'qwen35-27b',
        system_prompt: 'Explain from misconception perspective.',
      },
    ],
    moderator: {
      role_name: 'moderator',
      model: 'qwen35-27b',
      system_prompt: 'Synthesize four perspectives into cohesive summary and verdict.',
    },
  },
  rubric: {
    panelists: [
      {
        role_name: 'rubric_1',
        model: 'qwen35-27b',
        system_prompt: 'Assess for clarity of explanation.',
      },
      {
        role_name: 'rubric_2',
        model: 'qwen35-27b',
        system_prompt: 'Assess for relevance to course outcomes.',
      },
      {
        role_name: 'rubric_3',
        model: 'qwen35-27b',
        system_prompt: 'Assess for depth of analysis.',
      },
      {
        role_name: 'rubric_4',
        model: 'qwen35-27b',
        system_prompt: 'Assess for real-world examples alignment.',
      },
    ],
    moderator: {
      role_name: 'moderator',
      model: 'qwen35-27b',
      system_prompt: 'Consolidate rubric assessments into verdict and summary.',
    },
  },
}
