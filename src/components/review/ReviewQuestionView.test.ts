// gapStepHtml decides exactly what the class sees for a stepped-through cloze passage — the
// boundary C1 and C2 both broke. It had no direct tests before the prior pass added this file
// (all 15 prior tests in this package are aggregation tests over reviewStats.ts); every
// assertion here is written against the *rendered* span sequence, in source order, so a
// future regression at this boundary fails a test instead of shipping to a projector.
import { describe, expect, it, vi } from 'vitest'

// ReviewMaterial's ZoomableImage and quiz audio player read the UI language from AuthContext;
// stand the context in without the API client behind it (which needs a browser's localStorage).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react')
  return { default: createContext(undefined), useAuth: () => ({ user: null }) }
})

import { gapStepHtml } from './ReviewQuestionView'
import { getExpectedAnswers } from '../lesson/quiz/scoring'

// Three real, single-line gaps: no newline caveat here — this fixture is for the plain
// stepping behaviour. See `newlineQuestion` below for the C2 misalignment case.
//
// `expected` is derived from getExpectedAnswers, the actual production tokenizer (scoring.ts)
// — not hand-typed — so that if scoring.ts's tokenizer is ever widened (or narrowed) this test
// breaks instead of silently drifting out of sync with gapStepHtml's own NARROW_GAP_TOKEN
// check (#F4). C2 was exactly two regexes in two files silently disagreeing; a hard-coded
// `expected` array is the one thing that could never catch a repeat of that.
const question = {
  id: 'q1',
  question_type: 'fill_blank',
  content_text: 'The [[cat*,dog]] sat on the [[mat*,rug]] near the [[door*,window]]',
}
const passage = question.content_text
const expected = getExpectedAnswers(question)

// One `<span ...>text</span>` per matched token, in document order — lets a test assert on
// exactly what prints for each gap position without caring about the surrounding markup or
// which CSS class was used for which state (that's ReviewQuestionView's concern, not this
// function's contract).
function spanTexts(html: string): string[] {
  return [...html.matchAll(/<span class="[^"]*">([^<]*)<\/span>/g)].map((m) => m[1])
}

describe('gapStepHtml', () => {
  it('the fixture itself is not hand-typed: expected really does come from the production tokenizer', () => {
    // Guards the guard: if this ever fails, the fixture text and getExpectedAnswers have
    // drifted apart and every other assertion below is checking against a stale array.
    expect(expected).toEqual(['cat', 'mat', 'door'])
  })

  it('blanks every later gap regardless of what has already been revealed', () => {
    // gapIndex=1, revealed=false: gap 2 (index 1) is current-but-unrevealed, gap 3 (index 2)
    // hasn't been reached yet. Neither may print 'mat' or 'door'.
    const { html } = gapStepHtml(passage, 1, expected, false)
    expect(spanTexts(html)).toEqual(['cat', '____', '____'])
    expect(html).not.toContain('mat')
    expect(html).not.toContain('door')
  })

  it('shows nothing for the current gap until revealed, then shows only that gap', () => {
    const unrevealed = gapStepHtml(passage, 1, expected, false)
    expect(spanTexts(unrevealed.html)[1]).toBe('____')

    const revealedResult = gapStepHtml(passage, 1, expected, true)
    expect(spanTexts(revealedResult.html)).toEqual(['cat', 'mat', '____'])
    // Revealing gap 2 must not also reveal gap 3 (C1's failure mode, one gap over).
    expect(revealedResult.html).not.toContain('door')
  })

  it('a passed gap prints its own answer, never a neighbour\'s', () => {
    // gapIndex=2: gaps 0 and 1 are both "passed". Each of their FILLED spans must carry its
    // own expected[] value, in the same order as the source tokens — not shifted by one.
    const { html } = gapStepHtml(passage, 2, expected, false)
    expect(spanTexts(html)).toEqual(['cat', 'mat', '____'])
  })

  it('reveals only the current gap even as the teacher steps through every position', () => {
    for (let i = 0; i < expected.length; i += 1) {
      const { html } = gapStepHtml(passage, i, expected, true)
      const spans = spanTexts(html)
      // Every position up to and including the current one is visible...
      expect(spans.slice(0, i + 1)).toEqual(expected.slice(0, i + 1))
      // ...and every position after it is still blank, even though this call passed
      // revealed=true — "revealed" only ever applies to the one gap under gapIndex.
      expect(spans.slice(i + 1).every((s) => s === '____')).toBe(true)
    }
  })

  it('slotCount matches the number of real gaps for a clean, single-line source (#F3)', () => {
    for (let i = 0; i < expected.length; i += 1) {
      expect(gapStepHtml(passage, i, expected, false).slotCount).toBe(expected.length)
      expect(gapStepHtml(passage, i, expected, true).slotCount).toBe(expected.length)
    }
  })

  // C2 repro: a gap token whose contents span a newline. GAP_TOKEN_SOURCE (broad, used to
  // locate every token so none is left un-blanked) matches it; scoring.ts's getExpectedAnswers
  // (narrow, `.*?` with no `[\s\S]`) does not, so it never gets a slot in `expected`. Before
  // the fix, gapStepHtml counted it as a numbered gap anyway, shifting every later index out
  // of alignment with `expected[]` — the class could read a still-unrevealed gap's answer off
  // an already-"passed" slot. See reviewStats.ts's GAP_TOKEN_SOURCE doc comment for the fuller
  // story of why the two patterns are allowed to disagree at all.
  //
  // Broad tokens found here: 3 ('cat*,\ndog', 'mat*,carpet', 'door*,gate'). Narrow tokens: 2
  // ('mat*,carpet', 'door*,gate') — the first, newline-containing token is invisible to the
  // narrow pattern, exactly like scoring.ts resolves it, so `newlineExpected` below is what
  // getExpectedAnswers actually produces for this source text (derived, not hand-typed —
  // same #F4 guard as the fixture above).
  const newlineQuestion = {
    id: 'q2',
    question_type: 'fill_blank',
    content_text: '[[cat*,\ndog]] on the [[mat*,carpet]] and [[door*,gate]].',
  }
  const newlinePassage = newlineQuestion.content_text
  const newlineExpected = getExpectedAnswers(newlineQuestion)

  it('the newline fixture really does drop the broken token from the production tokenizer', () => {
    expect(newlineExpected).toEqual(['mat', 'door'])
  })

  it('C2: a newline-spanning token is blanked but never assigned a gap slot', () => {
    const { html } = gapStepHtml(newlinePassage, 1, newlineExpected, false)
    // Position 0 is the broken token: blanked, but NOT counted as a gap, so it must never
    // print an expected[] value at all -- filled or otherwise.
    // Position 1 is the real gap 0 ('mat*,carpet'); gapIndex=1 means it has been passed.
    // Position 2 is the real gap 1 ('door*,gate'); gapIndex=1 means it is CURRENT, unrevealed.
    expect(spanTexts(html)).toEqual(['____', 'mat', '____'])
  })

  it('C2: no expected string leaks for any unrevealed index, at any gapIndex', () => {
    // Full expected span sequence at each gapIndex, unrevealed. Position 0 is always the
    // broken broad-only token (never a numbered gap, so never filled); positions 1 and 2 are
    // the two real (narrow-matched) gaps, indexed 0 and 1 respectively -- NOT 1 and 2, which
    // is exactly the off-by-one C2 exploited.
    const table: Record<number, string[]> = {
      0: ['____', '____', '____'],
      1: ['____', 'mat', '____'],
    }
    for (let i = 0; i < newlineExpected.length; i += 1) {
      const { html } = gapStepHtml(newlinePassage, i, newlineExpected, false)
      expect(spanTexts(html)).toEqual(table[i])
      // Belt and suspenders: the current gap's answer, and every later gap's, must never
      // appear in the HTML at all while unrevealed -- only an already-passed gap's own
      // answer (index < i) is allowed to print.
      for (let g = i; g < newlineExpected.length; g += 1) {
        expect(html).not.toContain(newlineExpected[g])
      }
    }
  })

  it('never leaves a raw [[...]] token unblanked, revealed or not', () => {
    for (const [text, exp] of [[passage, expected] as const, [newlinePassage, newlineExpected] as const]) {
      for (const revealed of [true, false]) {
        for (let i = 0; i < exp.length; i += 1) {
          expect(gapStepHtml(text, i, exp, revealed).html).not.toMatch(/\[\[|\]\]/)
        }
      }
    }
  })

  // #F3: slotCount is the one number ReviewQuestionView now drives both the correct_answer
  // fallback predicate and the "Gap N of M" display off, instead of two independently
  // computed regex checks. For this fixture the one broken token is entirely swallowed by
  // the (still-passing) broad match and never reaches the narrow re-check as its own match,
  // so only 2 of the source's tokens ever get a slot -- same count as newlineExpected, i.e.
  // slotCount stays aligned with what getExpectedAnswers itself considers a real gap here.
  it('slotCount excludes the newline-spanning token (#F3)', () => {
    expect(gapStepHtml(newlinePassage, 0, newlineExpected, false).slotCount).toBe(2)
    expect(gapStepHtml(newlinePassage, 1, newlineExpected, false).slotCount).toBe(2)
  })

  it('slotCount is 0 when the only token in the source cannot be located at all', () => {
    // A source whose ONLY token spans a newline: getExpectedAnswers can't see it either, so
    // it falls back to correct_answer and `expected` here plays that role directly. Before
    // #F3, the fallback predicate this fed (`gapHasLocatableToken`) tested for "any broad
    // match exists" -- true here -- so the correct_answer fallback line never showed AND
    // gapStepHtml marked nothing: Reveal was a total no-op. slotCount === 0 is what makes
    // that predicate accurate again.
    const onlyBrokenToken = '[[cat*,\ndog]] is the answer.'
    const { html, slotCount } = gapStepHtml(onlyBrokenToken, 0, ['cat'], true)
    expect(slotCount).toBe(0)
    expect(html).not.toContain('cat')
  })
})
