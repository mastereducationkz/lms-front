# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Kazakhstani teenagers preparing for the SAT, IELTS and NUET with Master Education, and the adults around them:
parents, curators and head curators, teachers and head teachers, and admins. Students open the LMS daily, often on
a phone, to watch lessons, do homework, take quizzes and check their exam countdown; staff use it to teach, take the
register, grade, and follow groups.

## Product Purpose

One place for a student's learning at Master Education: courses and lessons, homework and quizzes, live lessons over
Google Meet, attendance, exam results and leaderboards, and chat with teachers and curators. Success is a student who
keeps showing up and improving, and staff who can see who needs help.

## Operating Context

- Used every day, mostly on phones, installed as a PWA; also on laptops in class and at home.
- Russian-first school; the UI speaks English or Russian per person (curators default to Russian, everyone may choose).
- Almaty time (UTC+5) for every date and deadline.
- Teachers show some screens to a whole class (quiz review, the live-lesson presenter, the Meet side panel).

## Capabilities and Constraints

- React SPA (Vite, Tailwind, shadcn/ui) over a FastAPI backend; light, dark and system themes on brand tokens.
- Work screens — taking a quiz or test, doing homework, projector screens, printouts, the Meet add-on — put clarity
  first: nothing decorative competes with the task there.
- Seasonal decorations (src/seasonal) switch themselves on and off by date and can be turned off per device.

## Brand Commitments

- The Master Education mark and a blue brand colour.
- Kasatik, the orca mascot: every student's avatar is their own dressable orca.
- A warm tone, never dry or shouty; celebration never blocks a task.

## Evidence on Hand

Real product screens and the student's own orca are the only imagery. No testimonials, statistics or results may be
invented for any surface.

## Product Principles

1. The task comes first; delight lives around it, never in its way.
2. One language per person, one time zone (Almaty) for everyone.
3. Phone-first: every surface works with a thumb on a small screen.
4. Warm, specific copy in the product's own words.
