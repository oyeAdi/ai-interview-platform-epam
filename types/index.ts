export interface JobDescription {
    id: string;
    level: string;
    title: string;
    must_have: string[];
    nice_to_have: string[];
    description: string;
    category?: string;
}

export interface Question {
    category: string;
    text: string;
}

export interface QuestionCategory {
    level: string;
    focus: string;
    questions: Question[];
}

export interface InterviewData {
    uber_roles: JobDescription[];
    question_bank: QuestionCategory[];
}

export interface Message {
    role: 'user' | 'model';
    text: string;
}

export interface InterviewState {
    currentTopicIndex: number;
    followUpCount: number;
    isFinished: boolean;
    selectedJobId: string;
}
