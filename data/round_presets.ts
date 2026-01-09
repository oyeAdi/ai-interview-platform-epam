export type RoundType = 'QUIZ' | 'CHAT' | 'CODING' | 'SYSTEM_DESIGN';

export interface RoundDefinition {
    id: string;
    title: string;
    type: RoundType;
    systemPromptContext: string;
    timeLimit?: number; // seconds
    questionCount?: number;
}

export const DEFAULT_FLOW: RoundDefinition[] = [
    {
        id: 'ROUND_1_MCQ',
        title: 'Round 1: Technical Knowledge',
        type: 'QUIZ',
        systemPromptContext: 'Conduct a rapid-fire technical quiz to assess breadth of knowledge.'
    },
    {
        id: 'ROUND_2_CONCEPTUAL',
        title: 'Round 2: Conceptual Deep Dive',
        type: 'CHAT',
        systemPromptContext: 'Ask deep conceptual questions to verify understanding behind the terms.'
    },
    {
        id: 'ROUND_3_CODING',
        title: 'Round 3: Practical Coding',
        type: 'CODING',
        systemPromptContext: 'Provide a coding challenge appropriately scoped for 15 minutes.'
    },
    {
        id: 'ROUND_4_DESIGN',
        title: 'Round 4: System Design',
        type: 'SYSTEM_DESIGN',
        systemPromptContext: 'Present a system design scenario requiring scalability and architectural thinking.'
    }
];

export const JUST_CODING_FLOW: RoundDefinition[] = [
    {
        id: 'ONLY_CODING',
        title: 'Coding Assessment',
        type: 'CODING',
        systemPromptContext: 'Conduct a rigorous coding interview starting with Data Structures.'
    }
];

export const DATA_ENGINEERING_FLOW: RoundDefinition[] = [
    {
        id: 'DATA_MCQ',
        title: 'Data Fundamentals',
        type: 'QUIZ',
        systemPromptContext: 'Focus on SQL, Distributed Systems, and ETL limits.'
    },
    {
        id: 'DATA_MODELING',
        title: 'Data Modeling & ERD',
        type: 'SYSTEM_DESIGN', // Reusing System Design workspace for ERD
        systemPromptContext: 'Ask the candidate to design a Schema/ERD for a specific data problem (e.g. Uber Analytics).'
    },
    {
        id: 'PYTHON_SCRIPTING',
        title: 'Python Data Scripting',
        type: 'CODING',
        systemPromptContext: 'Provide a data manipulation task using Pandas or raw Python.'
    }
];
