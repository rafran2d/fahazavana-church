/** Contrat des jobs de la file `ai`, partagé avec apps/ai-worker (worker/jobs.py). */
export const AI_QUEUE = 'ai';

export const AiJob = {
  /** Le worker rejoint la room et publie les sous-titres en direct. */
  LiveAttach: 'live.attach',
  /** Passe finale : transcription + traduction de l'enregistrement complet. */
  SermonTranscribe: 'sermon.transcribe',
} as const;

export interface LiveAttachJob {
  liveId: string;
  /** Prédication créée au démarrage du live, à laquelle se rattachent les segments live */
  sermonId: string;
  churchId: string;
  roomName: string;
  wsUrl: string;
  agentToken: string;
  sourceLanguage: string;
  targetLanguages: string[];
}

export interface SermonTranscribeJob {
  sermonId: string;
  churchId: string;
  audioKey: string;
  sourceLanguage: string;
  targetLanguages: string[];
}
