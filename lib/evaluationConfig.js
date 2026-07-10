// Kirkpatrick level metadata, the fixed Level 1 instrument, and scoring rules.

export const LEVELS = {
  1: { name: 'Reaction', blurb: 'Standard instrument — training experience and delivery quality' },
  2: { name: 'Learning', blurb: 'What knowledge or skill was gained' },
  3: { name: 'Behaviour', blurb: 'Whether behaviour changed on the job' },
  4: { name: 'Results', blurb: 'What business impact resulted' },
};

export const SCOPES = ['employee', 'programme', 'department', 'organization'];
export const SCALE = [1, 2, 3, 4, 5];
export const DELIVERY_MODES = ['physical', 'virtual', 'blended'];

// ---- Level 1: the four-point choice used across the whole instrument ----
export const CHOICE4 = [
  { label: 'Yes', score: 5 },
  { label: 'To some extent', score: 3 },
  { label: 'No', score: 1 },
  { label: "Don't know", score: null }, // excluded from averages
];

// Reverse-scored questions invert: Yes becomes the WORST answer.
export function scoreChoice(label, reverse) {
  const found = CHOICE4.find((c) => c.label === label);
  if (!found || found.score === null) return null; // "Don't know"
  return reverse ? 6 - found.score : found.score;
}

// ---- The fixed Level 1 instrument ----
// applies_to: 'all' | 'virtual'  (virtual questions also show for 'blended')
// reverse: true  => "Yes" is a bad outcome
export const LEVEL1_TEMPLATE = [
  { section: 'Ease of Understanding', question_text: 'Were the goals/objectives of the training clearly defined at the start of the course?' },
  { section: 'Ease of Understanding', question_text: 'Do you feel confident that this course has helped you to gain new skills?' },

  { section: 'Overall Satisfaction', question_text: 'Was the course effective in communicating information on the training topic?' },
  { section: 'Overall Satisfaction', question_text: 'Did you feel supported throughout this training?' },
  { section: 'Overall Satisfaction', question_text: 'Did you feel comfortable asking questions in relation to the course content or materials?' },
  { section: 'Overall Satisfaction', question_text: 'Did you get the answers you needed to these questions?' },
  { section: 'Overall Satisfaction', question_text: 'Do you know where to get additional resources in relation to this course topic?' },

  { section: 'Trainer Performance', question_text: 'Was the trainer well prepared?' },
  { section: 'Trainer Performance', question_text: 'Was the trainer knowledgeable on the topic?' },
  { section: 'Trainer Performance', question_text: 'Was the trainer open to feedback?' },

  { section: 'Platform Experience', applies_to: 'virtual', question_text: 'Was the LMS platform engaging and easy to use?' },
  { section: 'Platform Experience', applies_to: 'virtual', reverse: true, question_text: 'Were there any technical issues, like an answer not being saved, that contributed to feelings of frustration with the experience?' },
  { section: 'Platform Experience', applies_to: 'virtual', reverse: true, question_text: 'Were there any incompatibility issues between the platform and your operating system/web browser?' },

  { section: 'Time Requirements', reverse: true, question_text: 'Did you feel like the training was longer than it needed to be?' },
  { section: 'Time Requirements', reverse: true, question_text: 'Were there sections of the training that seemed unnecessarily repetitive?' },
  { section: 'Time Requirements', reverse: true, question_text: 'Were there any elements of the training that you felt weren’t relevant?' },

  { section: 'Perception of Value', question_text: 'Was the course content relevant to your role and/or professional development?' },
  { section: 'Perception of Value', question_text: 'Would you recommend this course to others?' },
];

// Build the Level 1 question set for a given delivery mode.
export function buildLevel1(deliveryMode) {
  const includeVirtual = deliveryMode === 'virtual' || deliveryMode === 'blended';
  return LEVEL1_TEMPLATE
    .filter((q) => (q.applies_to === 'virtual' ? includeVirtual : true))
    .map((q) => ({
      question_text: q.question_text,
      question_type: 'choice4',
      section: q.section,
      reverse_scored: !!q.reverse,
      ai_generated: false,
    }));
}

// ---- Fallback question sets for Levels 2-4 (the "Use standard set" button) ----
export const DEFAULT_QUESTIONS = {
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

export function isNumericType(type) {
  return type === 'rating' || type === 'confidence';
}
export function isChoiceType(type) {
  return type === 'choice4';
}
