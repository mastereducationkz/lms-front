import { describe, expect, it } from 'vitest';
import { cellsToSave } from './attendance';

describe('cellsToSave', () => {
  it('sends a changed student’s cells except locked ones and untouched «Не отмечено» ones', () => {
    const lessons: Record<string, { attendance_status: string; marked?: boolean }> = {
      '1': { attendance_status: 'attended', marked: true },
      '2': { attendance_status: 'missed', marked: false }, // never touched: sending it would store «Не был»
      '3': { attendance_status: 'missed' },                // older payloads: treated as marked
      '4': { attendance_status: 'attended', marked: true }, // a future lesson
    };
    expect(cellsToSave(lessons, new Set(['4'])).map(([key]) => key)).toEqual(['1', '3']);
  });
});
