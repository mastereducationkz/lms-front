// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, settle, unmount } from '@/pages/publicWebinarsTestKit';
import { resetStaffTrainingProbe, useStaffTrainingEnabled } from './useStaffTrainingEnabled';

const api = vi.hoisted(() => ({ getTrainingMe: vi.fn() }));
vi.mock('../services/api/staffTraining', () => api);

function Probe({ id, role }: { id: number; role: string }) {
  return <span data-enabled={String(useStaffTrainingEnabled(id, role))} />;
}
const shown = () => document.querySelector('[data-enabled]')?.getAttribute('data-enabled');

const off = Object.assign(new Error('Staff training is not available.'), {
  cause: { response: { status: 404, data: { reason_code: 'staff_training_off', detail: 'Staff training is not available.' } } },
});

beforeEach(() => { api.getTrainingMe.mockReset(); resetStaffTrainingProbe(); });
afterEach(unmount);

describe('useStaffTrainingEnabled (the sidebar entry)', () => {
  it('is false while the backend answers 404 staff_training_off', async () => {
    api.getTrainingMe.mockRejectedValue(off);
    await mount(<Probe id={12} role="curator" />);
    expect(api.getTrainingMe).toHaveBeenCalledTimes(1);
    expect(shown()).toBe('false');
  });

  it('is true once it answers', async () => {
    api.getTrainingMe.mockResolvedValue({});
    await mount(<Probe id={12} role="curator" />);
    expect(shown()).toBe('true');
  });

  it('stays false when the answer is a failure of any other kind (not sure: show nothing)', async () => {
    api.getTrainingMe.mockRejectedValue(new Error('network'));
    await mount(<Probe id={12} role="admin" />);
    expect(shown()).toBe('false');
  });

  it('is false before the answer arrives', async () => {
    api.getTrainingMe.mockReturnValue(new Promise(() => undefined));
    await mount(<Probe id={12} role="teacher" />);
    expect(shown()).toBe('false');
  });

  it('never asks for a student or a parent', async () => {
    await mount(<Probe id={5} role="student" />);
    await settle();
    expect(api.getTrainingMe).not.toHaveBeenCalled();
    expect(shown()).toBe('false');
  });

  it('asks the server once for the many sidebars a visit mounts', async () => {
    api.getTrainingMe.mockResolvedValue({});
    await mount(<Probe id={12} role="curator" />);
    await unmount();
    await mount(<Probe id={12} role="curator" />);
    expect(api.getTrainingMe).toHaveBeenCalledTimes(1);
    expect(shown()).toBe('true');
  });

  it('asks again for another person', async () => {
    api.getTrainingMe.mockResolvedValue({});
    await mount(<Probe id={12} role="curator" />);
    await unmount();
    await mount(<Probe id={13} role="curator" />);
    expect(api.getTrainingMe).toHaveBeenCalledTimes(2);
  });
});
