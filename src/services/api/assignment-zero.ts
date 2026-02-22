import { api } from './client';

export async function getAssignmentZeroStatus(): Promise<{
  needs_completion: boolean;
  completed: boolean;
  completed_at?: string;
  message?: string;
  has_draft?: boolean;
  last_saved_step?: number;
  user_groups?: { id: number; name: string }[];
}> {
  try {
    const response = await api.get('/assignment-zero/status');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to get Assignment Zero status');
  }
}

export async function getMyAssignmentZeroSubmission(): Promise<any> {
  try {
    const response = await api.get('/assignment-zero/my-submission');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to get Assignment Zero submission');
  }
}

export async function saveAssignmentZeroProgress(data: Partial<{
  full_name: string;
  phone_number: string;
  parent_phone_number: string;
  telegram_id: string;
  email: string;
  college_board_email: string;
  college_board_password: string;
  birthday_date: string;
  city: string;
  school_type: string;
  group_name: string;
  sat_target_date: string;
  has_passed_sat_before: boolean;
  previous_sat_score: string;
  recent_practice_test_score: string;
  bluebook_practice_test_5_score: string;
  screenshot_url: string;
  grammar_punctuation: number;
  grammar_noun_clauses: number;
  grammar_relative_clauses: number;
  grammar_verb_forms: number;
  grammar_comparisons: number;
  grammar_transitions: number;
  grammar_synthesis: number;
  reading_word_in_context: number;
  reading_text_structure: number;
  reading_cross_text: number;
  reading_central_ideas: number;
  reading_inferences: number;
  passages_literary: number;
  passages_social_science: number;
  passages_humanities: number;
  passages_science: number;
  passages_poetry: number;
  math_topics: string[];
  ielts_target_date: string;
  has_passed_ielts_before: boolean;
  previous_ielts_score: string;
  ielts_target_score: string;
  ielts_listening_main_idea: number;
  ielts_listening_details: number;
  ielts_listening_opinion: number;
  ielts_listening_accents: number;
  ielts_reading_skimming: number;
  ielts_reading_scanning: number;
  ielts_reading_vocabulary: number;
  ielts_reading_inference: number;
  ielts_reading_matching: number;
  ielts_writing_task1_graphs: number;
  ielts_writing_task1_process: number;
  ielts_writing_task2_structure: number;
  ielts_writing_task2_arguments: number;
  ielts_writing_grammar: number;
  ielts_writing_vocabulary: number;
  ielts_speaking_fluency: number;
  ielts_speaking_vocabulary: number;
  ielts_speaking_grammar: number;
  ielts_speaking_pronunciation: number;
  ielts_speaking_part2: number;
  ielts_speaking_part3: number;
  ielts_weak_topics: string[];
  additional_comments: string;
  last_saved_step: number;
}>): Promise<any> {
  try {
    const response = await api.post('/assignment-zero/save-progress', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to save progress');
  }
}

export async function submitAssignmentZero(data: {
  full_name: string;
  phone_number: string;
  parent_phone_number: string;
  telegram_id: string;
  email: string;
  college_board_email: string;
  college_board_password: string;
  birthday_date: string;
  city: string;
  school_type: string;
  group_name: string;
  sat_target_date: string;
  has_passed_sat_before: boolean;
  previous_sat_score?: string;
  recent_practice_test_score: string;
  bluebook_practice_test_5_score: string;
  screenshot_url?: string;
  grammar_punctuation?: number;
  grammar_noun_clauses?: number;
  grammar_relative_clauses?: number;
  grammar_verb_forms?: number;
  grammar_comparisons?: number;
  grammar_transitions?: number;
  grammar_synthesis?: number;
  reading_word_in_context?: number;
  reading_text_structure?: number;
  reading_cross_text?: number;
  reading_central_ideas?: number;
  reading_inferences?: number;
  passages_literary?: number;
  passages_social_science?: number;
  passages_humanities?: number;
  passages_science?: number;
  passages_poetry?: number;
  math_topics?: string[];
  ielts_target_date?: string;
  has_passed_ielts_before?: boolean;
  previous_ielts_score?: string;
  ielts_target_score?: string;
  ielts_listening_main_idea?: number;
  ielts_listening_details?: number;
  ielts_listening_opinion?: number;
  ielts_listening_accents?: number;
  ielts_reading_skimming?: number;
  ielts_reading_scanning?: number;
  ielts_reading_vocabulary?: number;
  ielts_reading_inference?: number;
  ielts_reading_matching?: number;
  ielts_writing_task1_graphs?: number;
  ielts_writing_task1_process?: number;
  ielts_writing_task2_structure?: number;
  ielts_writing_task2_arguments?: number;
  ielts_writing_grammar?: number;
  ielts_writing_vocabulary?: number;
  ielts_speaking_fluency?: number;
  ielts_speaking_vocabulary?: number;
  ielts_speaking_grammar?: number;
  ielts_speaking_pronunciation?: number;
  ielts_speaking_part2?: number;
  ielts_speaking_part3?: number;
  ielts_weak_topics?: string[];
  additional_comments?: string;
}): Promise<any> {
  try {
    const response = await api.post('/assignment-zero/submit', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to submit Assignment Zero');
  }
}

export async function uploadAssignmentZeroScreenshot(file: File): Promise<{ url: string; filename: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/assignment-zero/upload-screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to upload screenshot');
  }
}

export async function getAllAssignmentZeroSubmissions(groupName?: string): Promise<any[]> {
  try {
    const params = groupName ? { group_name: groupName } : {};
    const response = await api.get('/assignment-zero/submissions', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to get submissions');
  }
}

export async function getAssignmentZeroSubmissionByUser(userId: number): Promise<any> {
  try {
    const response = await api.get(`/assignment-zero/submissions/${userId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to get submission');
  }
}
