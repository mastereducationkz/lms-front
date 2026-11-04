import { useEffect, useState } from 'react';
import { getEventDetails } from '../../services/api';
import { getOpenAccess } from '../../services/api/openWebinars';
import { duplicateDraftOf, type DuplicateDraft } from './duplicate';

export type DuplicateState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; draft: DuplicateDraft }
  | { status: 'failed'; message: string };

/** Loads the source webinar and its public access for the create form; `none` when there is no source (`id` null). */
export function useDuplicateDraft(id: number | null): DuplicateState {
  const [state, setState] = useState<DuplicateState>(id ? { status: 'loading' } : { status: 'none' });

  useEffect(() => {
    if (!id) { setState({ status: 'none' }); return; }
    let live = true;
    setState({ status: 'loading' });
    Promise.all([getEventDetails(id), getOpenAccess(id)])
      .then(([event, access]) => live && setState({ status: 'ready', draft: duplicateDraftOf(event, access) }))
      .catch((failure) => live && setState({ status: 'failed', message: failure instanceof Error ? failure.message : '' }));
    return () => { live = false; };
  }, [id]);

  return state;
}
