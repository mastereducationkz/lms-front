// What a quiz shows besides its questions, in the shapes the student's own screen shows them
// (QuizRenderer.tsx) — so the class looks at the same map, passage or recording it answered
// from. Pure: paths stay as stored ("/uploads/…"); components turn them into URLs with
// lib/mediaUrl at render time.
//
// Nothing here is an answer. Quiz material, a question's attachment and an image_content block
// are all on the student's screen before they answer; the answer-key rules in this folder
// (reviewStats.ts, ReviewQuestionView.tsx) are untouched by anything below.

/** QuizRenderer's own test for "this 'pdf' quiz document is really an image". */
const IMAGE_FILE = /\.(jpg|jpeg|png|gif|webp)$/i

/** The quiz-level material a step carries: one audio file, one document, or one reading passage. */
export type QuizMaterial =
  | { kind: 'audio'; path: string }
  | { kind: 'image'; path: string }
  | { kind: 'pdf'; path: string }
  | { kind: 'text'; html: string }

export interface ReferenceImage {
  path: string
  caption: string | null
}

/** The image_content blocks that introduce a run of questions; `key` tells one run from the next. */
export interface ReferenceSet {
  key: number
  images: ReferenceImage[]
}

export interface StepMaterial {
  quiz: QuizMaterial | null
  /** Aligned 1:1 with reviewQuestions(content) — never with the raw `questions` array. */
  references: (ReferenceSet | null)[]
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * The step's quiz-level material, exactly when the student's quiz shows one: `quiz_media_url`
 * read as `quiz_media_type` says — an audio file, a passage (the "url" holds the passage's
 * HTML), or a document that is an image when its file name says so and a PDF otherwise.
 */
export function quizMaterial(content: any): QuizMaterial | null {
  const value = text(content?.quiz_media_url)
  if (!value) return null
  switch (content?.quiz_media_type) {
    case 'audio':
      return { kind: 'audio', path: value }
    case 'text':
      return { kind: 'text', html: content.quiz_media_url }
    case 'pdf':
      return IMAGE_FILE.test(value) ? { kind: 'image', path: value } : { kind: 'pdf', path: value }
    default:
      return null
  }
}

/**
 * Which image_content blocks introduce each reviewed question. The editor describes the block as
 * "an image between questions (e.g. a map for listening exercises)": it belongs to the questions
 * after it, up to the next block. Blocks in a row form one set; a block with no image adds
 * nothing; blocks after the last question introduce nothing and are left out.
 *
 * Walks `questions` with the very filter reviewQuestions uses, so index i here is question i of
 * the deck — the stats and numbering, which skip these blocks, stay as they are.
 */
export function questionReferences(content: any): (ReferenceSet | null)[] {
  const questions = Array.isArray(content?.questions) ? content.questions : []
  const out: (ReferenceSet | null)[] = []
  let pending: ReferenceSet | null = null
  let current: ReferenceSet | null = null
  for (let position = 0; position < questions.length; position += 1) {
    const q = questions[position]
    if (!q || typeof q !== 'object') continue
    if (q.question_type === 'image_content') {
      const path = text(q.media_url)
      if (!path) continue
      if (!pending) pending = { key: position, images: [] }
      pending.images.push({ path, caption: text(q.question_text) || null })
      continue
    }
    if (pending) {
      current = pending
      pending = null
    }
    out.push(current)
  }
  return out
}

export function stepMaterial(content: any): StepMaterial {
  return { quiz: quizMaterial(content), references: questionReferences(content) }
}

/** A question's own attachment, where the student's screen shows one: media questions only. */
export function questionAttachment(question: any): { kind: 'image' | 'pdf'; path: string } | null {
  const type = question?.question_type
  if (type !== 'media_question' && type !== 'media_open_question') return null
  const path = text(question?.media_url)
  if (!path) return null
  return { kind: question.media_type === 'pdf' ? 'pdf' : 'image', path }
}

/** What to show beside deck question `index`: its step's material and the references introducing it. */
export function materialAt(
  materials: Record<number, StepMaterial>,
  steps: { stepId: number; startIndex: number }[],
  questionSteps: { stepId: number }[],
  index: number,
): { stepId: number; quiz: QuizMaterial | null; references: ReferenceSet | null } | null {
  const meta = questionSteps[index]
  if (!meta) return null
  const material = materials[meta.stepId]
  const step = steps.find((s) => s.stepId === meta.stepId)
  if (!material || !step) return null
  return {
    stepId: meta.stepId,
    quiz: material.quiz,
    references: material.references[index - step.startIndex] ?? null,
  }
}
