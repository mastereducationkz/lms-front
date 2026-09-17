import { describe, expect, it } from 'vitest'
import { materialAt, questionAttachment, questionReferences, quizMaterial, stepMaterial } from './reviewMedia'
import { reviewQuestions } from './reviewStats'

const q = (id: string, type = 'single_choice', extra: Record<string, unknown> = {}) => ({ id, question_type: type, ...extra })
const block = (id: string, media_url?: string, question_text?: string) =>
  ({ id, question_type: 'image_content', media_url, question_text })

describe('quizMaterial', () => {
  it('reads an audio quiz', () => {
    expect(quizMaterial({ quiz_media_type: 'audio', quiz_media_url: '/uploads/questions/part1.mp3' }))
      .toEqual({ kind: 'audio', path: '/uploads/questions/part1.mp3' })
  })

  it('reads a document quiz as a PDF, or as an image when the file is one (QuizRenderer does the same)', () => {
    expect(quizMaterial({ quiz_media_type: 'pdf', quiz_media_url: '/uploads/questions/reading.pdf' }))
      .toEqual({ kind: 'pdf', path: '/uploads/questions/reading.pdf' })
    expect(quizMaterial({ quiz_media_type: 'pdf', quiz_media_url: '/uploads/questions/Passage.JPEG' }))
      .toEqual({ kind: 'image', path: '/uploads/questions/Passage.JPEG' })
  })

  it('reads a text quiz: the "url" is the passage itself, kept as written', () => {
    const html = '<p>The <b>Nile</b> is long.</p>'
    expect(quizMaterial({ quiz_type: 'text_based', quiz_media_type: 'text', quiz_media_url: html }))
      .toEqual({ kind: 'text', html })
  })

  it('shows nothing the student would not see: no url, or no type QuizRenderer draws', () => {
    expect(quizMaterial({ quiz_media_type: 'audio', quiz_media_url: '' })).toBeNull()
    expect(quizMaterial({ quiz_media_type: 'pdf', quiz_media_url: '   ' })).toBeNull()
    expect(quizMaterial({ quiz_media_type: '', quiz_media_url: '/uploads/x.pdf' })).toBeNull()
    expect(quizMaterial({ quiz_type: 'regular' })).toBeNull()
    expect(quizMaterial(null)).toBeNull()
    expect(quizMaterial({})).toBeNull()
  })
})

describe('questionReferences', () => {
  it('stays aligned with the deck: one entry per reviewed question, blocks skipped', () => {
    const content = {
      questions: [block('b1', '/uploads/map.png'), q('1'), q('2'), block('b2', '/uploads/chart.png'), q('3'), null, 'junk', q('4')],
    }
    const refs = questionReferences(content)
    expect(refs).toHaveLength(reviewQuestions(content).length)
    expect(refs.map((r) => r?.images.map((i) => i.path) ?? null)).toEqual([
      ['/uploads/map.png'],
      ['/uploads/map.png'],
      ['/uploads/chart.png'],
      ['/uploads/chart.png'],
    ])
  })

  it('gives questions before any block nothing', () => {
    const refs = questionReferences({ questions: [q('1'), block('b', '/uploads/map.png'), q('2')] })
    expect(refs[0]).toBeNull()
    expect(refs[1]?.images).toEqual([{ path: '/uploads/map.png', caption: null }])
  })

  it('groups blocks in a row into one set, with their captions', () => {
    const refs = questionReferences({
      questions: [block('a', '/uploads/a.png', ' Map A '), block('b', '/uploads/b.png'), q('1')],
    })
    expect(refs[0]).toEqual({
      key: 0,
      images: [{ path: '/uploads/a.png', caption: 'Map A' }, { path: '/uploads/b.png', caption: null }],
    })
  })

  it('tells one run from the next by key, so a new map is a new set', () => {
    const refs = questionReferences({ questions: [block('a', '/uploads/a.png'), q('1'), block('b', '/uploads/b.png'), q('2')] })
    expect(refs[0]?.key).not.toBe(refs[1]?.key)
  })

  it('ignores a block without an image, and blocks after the last question', () => {
    const refs = questionReferences({ questions: [block('empty', '  '), q('1'), block('tail', '/uploads/tail.png')] })
    expect(refs).toEqual([null])
  })

  it('copes with content that has no questions', () => {
    expect(questionReferences({})).toEqual([])
    expect(questionReferences({ questions: 'nope' })).toEqual([])
  })
})

describe('questionAttachment', () => {
  it('reads media questions the way the student sees them: PDF when typed so, image otherwise', () => {
    expect(questionAttachment(q('1', 'media_question', { media_url: '/uploads/a.pdf', media_type: 'pdf' })))
      .toEqual({ kind: 'pdf', path: '/uploads/a.pdf' })
    expect(questionAttachment(q('2', 'media_open_question', { media_url: '/uploads/a.png', media_type: 'image' })))
      .toEqual({ kind: 'image', path: '/uploads/a.png' })
    expect(questionAttachment(q('3', 'media_question', { media_url: '/uploads/b.png' })))
      .toEqual({ kind: 'image', path: '/uploads/b.png' })
  })

  it('shows nothing for other types (the student never sees a leftover media_url there) or without a file', () => {
    expect(questionAttachment(q('1', 'single_choice', { media_url: '/uploads/a.png' }))).toBeNull()
    expect(questionAttachment(q('2', 'media_question', { media_url: '' }))).toBeNull()
    expect(questionAttachment(null)).toBeNull()
  })
})

describe('materialAt', () => {
  // A whole-unit deck: step 10 has two questions, step 20 one — the material follows the step.
  const materials = {
    10: stepMaterial({ quiz_media_type: 'audio', quiz_media_url: '/uploads/l1.mp3', questions: [q('1'), block('m', '/uploads/map.png'), q('2')] }),
    20: stepMaterial({ quiz_media_type: 'text', quiz_media_url: '<p>Passage</p>', questions: [q('1')] }),
  }
  const steps = [{ stepId: 10, startIndex: 0 }, { stepId: 20, startIndex: 2 }]
  const questionSteps = [{ stepId: 10 }, { stepId: 10 }, { stepId: 20 }]

  it('reads the current question\'s own step and its place inside that step', () => {
    expect(materialAt(materials, steps, questionSteps, 0)).toEqual({ stepId: 10, quiz: { kind: 'audio', path: '/uploads/l1.mp3' }, references: null })
    expect(materialAt(materials, steps, questionSteps, 1)?.references?.images[0].path).toBe('/uploads/map.png')
    expect(materialAt(materials, steps, questionSteps, 2)).toEqual({ stepId: 20, quiz: { kind: 'text', html: '<p>Passage</p>' }, references: null })
  })

  it('is null off the end of the deck or for a step it knows nothing about', () => {
    expect(materialAt(materials, steps, questionSteps, 3)).toBeNull()
    expect(materialAt({}, steps, questionSteps, 0)).toBeNull()
  })
})
