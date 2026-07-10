// Kirkpatrick level metadata + default question sets.
// (Phase 6 replaces these defaults with AI-generated questions from the training objective.)

export const LEVELS = {
  1: { name: 'Reaction', blurb: 'How participants felt about the training' },
  2: { name: 'Learning', blurb: 'What knowledge or skill was gained' },
  3: { name: 'Behaviour', blurb: 'Whether behaviour changed on the job' },
  4: { name: 'Results', blurb: 'What business impact resulted' },
};

export const DEFAULT_QUESTIONS = {
  1: [
    { question_text: 'Overall, how would you rate this training?', question_type: 'rating' },
    { question_text: 'How likely are you to recommend it to a colleague?', question_type: 'rating' },
    { question_text: 'What was your single biggest takeaway?', question_type: 'text' },
  ],
  2: [
    { question_text: 'Describe how you would apply what you learned in a real situation.', question_type: 'scenario' },
    { question_text: 'How confident are you applying what you learned?', question_type: 'confidence' },
  ],
  3: [
    { question_text: 'Have you applied this on the job? Describe how.', question_type: 'text' },
    { question_text: 'What evidence supports the change (files, outcomes)?', question_type: 'text' },
  ],
  4: [
    { question_text: 'Rate the business impact you have observed.', question_type: 'rating' },
    { question_text: 'Which KPI has this training most influenced, and how?', question_type: 'text' },
  ],
};

export const SCOPES = ['employee', 'programme', 'department', 'organization'];

// Rating/confidence scales rendered as 1–5 buttons
export const SCALE = [1, 2, 3, 4, 5];

export function isNumericType(type) {
  return type === 'rating' || type === 'confidence';
}
