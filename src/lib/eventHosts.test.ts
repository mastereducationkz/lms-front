import { describe, expect, it, vi } from 'vitest';
import { EVENT_HOST_ROLES, loadEventHosts } from './eventHosts';

const user = (id: number, role: string) => ({ id, name: `User ${id}`, role });

describe('who can host an event', () => {
  it('asks for teachers, head teachers, curators and admins', () => {
    expect([...EVENT_HOST_ROLES].sort()).toEqual(['admin', 'curator', 'head_teacher', 'teacher']);
  });

  it('lists a head teacher, so an event they host shows their name in the form', async () => {
    const byRole: Record<string, unknown[]> = {
      teacher: [user(1, 'teacher')],
      head_teacher: [user(2, 'head_teacher')],
      curator: [user(3, 'curator')],
      admin: [user(4, 'admin')],
    };
    const getUsers = vi.fn(async ({ role }: { role: string }) => byRole[role]);
    const hosts = await loadEventHosts(getUsers as never);
    expect(hosts.map((h) => h.id).sort()).toEqual([1, 2, 3, 4]);
    expect(getUsers).toHaveBeenCalledTimes(4);
  });

  it('lists a person with two roles once', async () => {
    const getUsers = vi.fn(async ({ role }: { role: string }) => (role === 'teacher' || role === 'head_teacher' ? [user(7, role)] : []));
    expect(await loadEventHosts(getUsers as never)).toHaveLength(1);
  });

  it('ignores a role whose list did not come back as an array', async () => {
    const getUsers = vi.fn(async ({ role }: { role: string }) => (role === 'admin' ? [user(4, 'admin')] : (undefined as never)));
    expect((await loadEventHosts(getUsers as never)).map((h) => h.id)).toEqual([4]);
  });
});
