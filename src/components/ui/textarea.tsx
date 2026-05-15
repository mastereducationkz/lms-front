import * as React from "react"

import { cn } from "../../lib/utils"

function resizeTextareaHeight(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onInput, value, defaultValue, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const isControlled = value !== undefined

  React.useEffect(() => {
    resizeTextareaHeight(innerRef.current);
    // Run after next paint to ensure styles applied
    const id = requestAnimationFrame(() => resizeTextareaHeight(innerRef.current));
    return () => cancelAnimationFrame(id)
  }, [value])

  React.useEffect(() => {
    // Initialize height for uncontrolled defaultValue on mount
    resizeTextareaHeight(innerRef.current)
  }, [])

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    resizeTextareaHeight(e.currentTarget);
    if (onInput) onInput(e);
  };

  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={innerRef}
      onInput={handleInput}
      {...props}
      {...(isControlled
        ? { value: value ?? '' }
        : { defaultValue })}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
