import { api } from './client';
import type { ReportTriage, TriageLabel } from '../../lib/reportTriage';

/**
 * Jev labels (owner, 2026-09-30): corrections to the question-report triage, and what students ask the
 * group bot. Reads are never cached here: a correction must show at once.
 */

function detail(error: unknown, fallback: string): Error {
  const d = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return new Error(typeof d === 'string' ? d : fallback);
}

export async function correctReportTriage(reportId: number, label: TriageLabel | null): Promise<ReportTriage> {
  try {
    return (await api.put(`/questions/error-reports/${reportId}/triage`, { label })).data;
  } catch (e) { throw detail(e, 'Could not save the label'); }
}

export async function runReportTriage(): Promise<{ labelled: number; due: number }> {
  try {
    return (await api.post('/questions/error-reports/triage/run', {})).data;
  } catch (e) { throw detail(e, 'Could not label the reports'); }
}

export type BotOutcome = 'answered' | 'curator' | 'private' | 'silent';

export interface BotTopicRow {
  topic: string;
  label: string;
  total: number;
  answered: number;
  curator: number;
  private: number;
  silent: number;
}

export interface BotQuestionsSummary {
  days: number;
  total: number;
  unlabelled: number;
  topics: BotTopicRow[];
  labels: Record<string, string>;
  configured: boolean;
}

export interface BotQuestion {
  id: number;
  created_at: string;
  group: string | null;
  chat_title: string | null;
  question: string;
  intent: string | null;
  outcome: BotOutcome;
  topic: string | null;
  jev_topic: string | null;
  confidence: number | null;
  corrected: boolean;
}

export async function getBotQuestionsSummary(days: number): Promise<BotQuestionsSummary> {
  try {
    return (await api.get('/telegram-links/group-bot/questions', { params: { days }, cache: false } as never)).data;
  } catch (e) { throw detail(e, 'Could not load the bot questions'); }
}

export async function listBotQuestions(days: number, topic?: string, outcome?: BotOutcome): Promise<BotQuestion[]> {
  try {
    return (await api.get('/telegram-links/group-bot/questions/list', { params: { days, topic, outcome }, cache: false } as never)).data;
  } catch (e) { throw detail(e, 'Could not load the questions'); }
}

export async function correctBotQuestionTopic(questionId: number, topic: string | null) {
  try {
    return (await api.put(`/telegram-links/group-bot/questions/${questionId}/topic`, { topic })).data;
  } catch (e) { throw detail(e, 'Could not save the topic'); }
}
