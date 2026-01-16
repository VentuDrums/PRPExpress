
export interface PRPReport {
  studentName: string;
  subject: string;
  isTakingSubject: string;
  responsibleTeacher: string;
  previousActions: string;
  difficultiesStrengths: string;
  unmetEvaluationCriteria: string;
  methodologicalProposal: string;
  detailedEvaluationPlan: string;
  rawPSP?: string;
  status?: 'idle' | 'extracting' | 'completed' | 'notFound';
}

export interface GenerationState {
  loading: boolean;
  error: string | null;
}
