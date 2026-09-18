// What a calendar entry should say when somebody covered the lesson.
//
// `is_substitution` is a fact about the lesson — its teacher is not the group's owner — and says
// nothing about who is reading. The calendar treated everyone who was not the owner as the
// stand-in and told them «You are substituting», which is wrong for the admins, head teachers and
// curators who read the calendar all day (reported 2026-09-18). The badge now answers for the
// reader, and names the people instead of addressing them.

export type SubstitutionBadge = {
  /** `covering` = the reader is standing in; `covered` = somebody stood in on this lesson. */
  tone: 'covering' | 'covered';
  text: string;
};

type LessonLike = {
  teacher_id?: number | string | null;
  teacher_name?: string | null;
  group_teacher_name?: string | null;
  is_substitution?: boolean;
};

type Reader = { id?: number | string; role?: string } | null | undefined;

export function substitutionBadge(lesson: LessonLike, reader: Reader): SubstitutionBadge | null {
  if (!lesson?.is_substitution || !reader) return null;

  const taughtBy = lesson.teacher_name || 'another teacher';
  const owner = lesson.group_teacher_name || null;

  const readerIsTheStandIn =
    lesson.teacher_id != null && String(lesson.teacher_id) === String(reader.id);
  if (readerIsTheStandIn) {
    return { tone: 'covering', text: owner ? `You are substituting for ${owner}` : 'You are substituting' };
  }

  // The group's own teacher reads it as «somebody covered for me»; everybody else needs both names.
  if (reader.role === 'teacher') {
    return { tone: 'covered', text: `Substituted by: ${taughtBy}` };
  }
  return { tone: 'covered', text: owner ? `Substitute: ${taughtBy} instead of ${owner}` : `Substitute: ${taughtBy}` };
}
