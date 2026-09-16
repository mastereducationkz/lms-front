// What a question was answered from, on the projector: the quiz's audio, document or reading
// passage, the maps between questions, a media question's own attachment. Drawn the way the
// student's quiz draws them (QuizRenderer.tsx) — PDFs in a frame, images zoomable — and sized so
// the question under them stays in view. Every stored path goes through lib/mediaUrl: these
// files live on the API host, and a bare "/uploads/…" path loads nothing from the app's host.
import React, { useEffect, useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, FileText, Headphones, Image as ImageIcon } from 'lucide-react'
import { mediaUrl } from '../../lib/mediaUrl'
import { renderTextWithLatex } from '../../utils/latex'
import { ZoomableImage } from '../lesson/ZoomableImage'
import { AudioPlayer } from '../lesson/quiz/AudioPlayer'
import { EN } from './strings'
import type { QuizMaterial, ReferenceSet } from './reviewMedia'

const MUTED = 'text-gray-500 dark:text-gray-400'

function Unavailable({ url }: { url: string | null }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-gray-300 dark:border-border px-4 py-6 text-sm ${MUTED}`}>
      <FileText className="h-5 w-5 shrink-0" aria-hidden />
      <span>{EN.mediaUnavailable}</span>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          {EN.openFile} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
    </div>
  )
}

/** An uploaded image, zoomable and full-screenable; says so when it cannot load instead of leaving a blank. */
export function MediaImage({ path, alt, caption, className = 'max-h-[60vh] object-contain' }: {
  path: string
  alt: string
  caption?: string | null
  className?: string
}) {
  const url = mediaUrl(path)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  if (!url || failed) return <Unavailable url={url} />
  return <ZoomableImage src={url} alt={alt} caption={caption ?? undefined} className={className} onError={() => setFailed(true)} />
}

/** An uploaded PDF in a frame (QuizRenderer's viewer settings), with a way out to a full tab. */
export function MediaPdf({ path, title, heightClass = 'h-[60vh]' }: { path: string; title: string; heightClass?: string }) {
  const url = mediaUrl(path)
  if (!url) return <Unavailable url={null} />
  return (
    <div className="space-y-1.5">
      <iframe
        src={`${url}#toolbar=0&navpanes=0&scrollbar=1`}
        title={title}
        className={`w-full rounded-lg border border-gray-200 dark:border-border bg-white ${heightClass}`}
      />
      <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${MUTED}`}>
        {EN.openFile} <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </div>
  )
}

/** A titled block the teacher can fold away, so long material never pushes the question off screen. */
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-gray-900 dark:text-foreground"
      >
        <span className={MUTED}>{icon}</span>
        <span className="flex-1">{title}</span>
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${MUTED}`}>
          {open ? EN.materialHide : EN.materialShow}
          {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </span>
      </button>
      {open && <div className="border-t border-gray-200 dark:border-border p-4">{children}</div>}
    </section>
  )
}

function QuizMaterialBody({ material }: { material: QuizMaterial }) {
  switch (material.kind) {
    case 'audio': {
      const url = mediaUrl(material.path)
      // Flexible, never the students' strict mode: the teacher replays a part as often as the discussion needs.
      return url ? <AudioPlayer key={url} src={url} mode="flexible" /> : <Unavailable url={null} />
    }
    case 'image':
      return <MediaImage path={material.path} alt={EN.materialDocument} />
    case 'pdf':
      return <MediaPdf path={material.path} title={EN.materialDocument} />
    case 'text':
      return (
        <div
          className="prose prose-lg dark:prose-invert max-h-[45vh] max-w-none overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: renderTextWithLatex(material.html) }}
        />
      )
  }
}

const QUIZ_MATERIAL_TITLE: Record<QuizMaterial['kind'], { title: string; icon: React.ReactNode }> = {
  audio: { title: EN.materialAudio, icon: <Headphones className="h-4 w-4" /> },
  image: { title: EN.materialDocument, icon: <FileText className="h-4 w-4" /> },
  pdf: { title: EN.materialDocument, icon: <FileText className="h-4 w-4" /> },
  text: { title: EN.materialPassage, icon: <BookOpen className="h-4 w-4" /> },
}

interface MaterialProps {
  stepId: number
  quiz: QuizMaterial | null
  references: ReferenceSet | null
}

/**
 * The current question's material: its quiz's own (one per step — in a whole-unit deck it changes
 * as the teacher crosses into the next quiz) and the image_content blocks introducing it. Each
 * block keeps its folded state while the teacher moves through the questions it belongs to, and
 * opens again for new material.
 */
export function ReviewMaterial({ stepId, quiz, references }: MaterialProps) {
  if (!quiz && !references) return null
  return (
    <div className="space-y-3">
      {quiz && (
        <Section key={`quiz-${stepId}`} icon={QUIZ_MATERIAL_TITLE[quiz.kind].icon} title={QUIZ_MATERIAL_TITLE[quiz.kind].title}>
          <QuizMaterialBody material={quiz} />
        </Section>
      )}
      {references && (
        <Section
          key={`refs-${stepId}-${references.key}`}
          icon={<ImageIcon className="h-4 w-4" />}
          title={references.images.length > 1 ? EN.materialImages : EN.materialImage}
        >
          <div className="space-y-4">
            {references.images.map((image, i) => (
              <MediaImage key={`${i}-${image.path}`} path={image.path} alt={image.caption || EN.materialImage} caption={image.caption} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
