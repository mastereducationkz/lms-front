import { describe, expect, it } from 'vitest'

import { masterLeagueUntilShort } from './masterLeagueLabel'

describe('masterLeagueUntilShort', () => {
  it('writes the day and month, without the year', () => {
    expect(masterLeagueUntilShort('2026-11-04')).toBe('04.11')
  })

  it('returns anything that is not an ISO date as it came', () => {
    expect(masterLeagueUntilShort('soon')).toBe('soon')
  })
})
