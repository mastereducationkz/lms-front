/** Who the "Teacher" field of the event form offers: everyone who can host an event. A head teacher
 * is in the list so an event they host (or edit) shows their name instead of an empty field. */
export const EVENT_HOST_ROLES = ['teacher', 'head_teacher', 'curator', 'admin'] as const;

interface Host {
  id: number;
  [key: string]: any;
}

type GetUsers = (params: { role: string }) => Promise<Host[] | unknown>;

export async function loadEventHosts(getUsers: GetUsers): Promise<Host[]> {
  const lists = await Promise.all(EVENT_HOST_ROLES.map((role) => getUsers({ role })));
  const hosts = lists.flatMap((list) => (Array.isArray(list) ? (list as Host[]) : []));
  return Array.from(new Map(hosts.map((host) => [host.id, host])).values());
}
