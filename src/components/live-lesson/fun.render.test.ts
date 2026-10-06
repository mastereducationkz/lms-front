import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LiveApi } from '../../lib/liveLesson/api';
import type { LiveState } from '../../lib/liveLesson/types';
import ReactionOrca, { REACTION_KINDS } from '../mascot/ReactionOrca';
import StaffFun from './StaffFun';
import { HandAndLost, ReactionBar } from './StudentFun';
import { Recap } from './funScreens';

const person = (user_id: number, name: string) => ({ user_id, name, mascot: null, avatar_url: null });
const now = new Date().toISOString();
const state = {
  lesson: { id: 1, title: 'Unit 7', start: now, end: now, status: 'live' }, mode: 'everyone', version: 1, server_now: now,
  link: '', is_staff: true, is_student: false, can_drive: true, timer: null, pick: null, activity: null,
  reactions: { on: false, paused: 'focus' }, reactions_paused: false, crowned: person(5, 'Мадина К.'), recap: null,
  room: [person(4, 'Алихан Т.'), person(5, 'Мадина К.')], group_ids: [77],
  hands: [{ ...person(4, 'Алихан Т.'), raised_at: now }, { ...person(8, 'Диас Б.'), raised_at: now }],
  lost: { count: 5 }, energy: { counts: { fire: 3 }, total: 3, top: 'fire', lost: null },
  my_hand: { position: 2, raised_at: now },
} as unknown as LiveState;
const api = {} as LiveApi;

describe('the fun layer renders', () => {
  it('gives the teacher the counter, the auto-pause reason, «lost», the hand queue and the crown', () => {
    const html = renderToStaticMarkup(createElement(StaffFun, { state, api, act: vi.fn() }));
    expect(html).toContain('Reactions');
    expect(html).toContain('paused while a pop-check / mistake is open');
    expect(html).toContain('lost right now');
    expect(html.indexOf('Алихан Т.')).toBeLessThan(html.indexOf('Диас Б.'));
    expect(html).toContain('Kasatik of the lesson');
    expect(html).toContain('Мадина К.');
    expect(html).toContain('give it from the lesson page or the leaderboard'); // no Star dialog in the panel
  });
  it('gives a student six reactions on their own orca, the paused note, the hand place and «lost»', () => {
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(ReactionBar, { state: { ...state, is_staff: false } as LiveState, api, me: person(5, 'Мадина К.') }),
      createElement(HandAndLost, { state, api })));
    expect(html.match(/reaction"/g) ?? []).toHaveLength(6);
    expect(html).toContain('Reactions are paused while you answer.');
    expect(html).toContain('#2 in line');
    expect(html).toContain('only your teacher sees how many, never who');
  });
  it('draws the recap with the crown and the energy', () => {
    const html = renderToStaticMarkup(createElement(Recap, {
      recap: { activities: 4, answers: 30, energy: { counts: { fire: 9 }, total: 9, top: 'fire', lost: null },
        top: [person(4, 'Алихан Т.')], crowned: person(5, 'Мадина К.') },
    }));
    expect(html).toContain('Kasatik of the lesson');
    expect(html).toContain('lucide-crown'); // a drawn crown, not the 👑 glyph
    expect(html).toContain('9 🔥');
  });
  it('draws every reaction for a student and for an anonymous plain orca', () => {
    for (const kind of REACTION_KINDS) {
      expect(renderToStaticMarkup(createElement(ReactionOrca, { kind, code: null, userId: 42 }))).toContain('<svg');
      expect(renderToStaticMarkup(createElement(ReactionOrca, { kind, code: null, userId: null }))).toContain(`${kind === 'mindblown' ? 'Mind blown' : ''}`);
    }
  });
});

describe('reactions never cover the lesson', () => {
  it('uses side lanes only where the margins beside the content column fit them', async () => {
    const { reactionLanes } = await import('./funScreens');
    expect(reactionLanes(1440, 64, 'presenter')).toEqual({ mode: 'side', lanes: ['right', 'left'], laneWidth: 184 });
    expect(reactionLanes(1280, 64, 'presenter')).toMatchObject({ mode: 'side', lanes: ['right'] });
    expect(reactionLanes(1100, 64, 'presenter')).toMatchObject({ mode: 'inline' });
    expect(reactionLanes(390, 36, 'inline')).toMatchObject({ mode: 'inline' });
    expect(reactionLanes(null, 64, 'presenter')).toMatchObject({ mode: 'inline' });
  });
  it('renders the student lane in the page flow, never as a full-screen overlay', async () => {
    const { ReactionLayer } = await import('./funScreens');
    const html = renderToStaticMarkup(createElement(ReactionLayer, { eventId: 1, size: 36, placement: 'inline' }));
    expect(html).toContain('overflow-hidden');
    expect(html).not.toContain('fixed');
    expect(html).not.toContain('inset-0');
  });
});
