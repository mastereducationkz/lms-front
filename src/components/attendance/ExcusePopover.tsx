import { useId, useRef, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { isValidExcuseNote } from '../../lib/excusedAbsence';
import { cn } from '../../lib/utils';

/**
 * Причина уважительного пропуска — свободный текст, обязательный.
 *
 * Справочника причин нет намеренно: учителю быстрее написать словом, чем искать пункт в
 * списке, а разбирать эти причины всё равно будет человек. Пустую причину не принимаем —
 * уважительный пропуск без объяснения ничем не отличается от обычного, кроме того, что за
 * него могут не списать деньги.
 *
 * Позиционирование и закрытие по клику снаружи/Escape отданы примитиву `ui/popover`
 * (Radix): у него уже есть портал (не обрежется overflow-скроллом плотной сетки),
 * коллизии с краями экрана и стандартный дизайн клика-снаружи — переизобретать это в
 * ручном `absolute`-диве было бы шагом назад. Компонент не получает ref на кнопку-триггер
 * (родитель сам решает, когда монтировать поповер), поэтому точкой привязки служит
 * невидимый `PopoverAnchor`, растянутый на весь родительский блок: обычно это та же
 * относительно позиционированная ячейка, где стоит открывающий значок.
 */
export function ExcusePopover({
  excused,
  note,
  onSave,
  onClear,
  onClose,
  en = false,
}: {
  excused: boolean;
  note: string | null;
  onSave: (note: string) => void;
  onClear: () => void;
  onClose: () => void;
  en?: boolean;
}) {
  const [value, setValue] = useState(note ?? '');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formId = useId();

  const valid = isValidExcuseNote(value);

  const save = () => {
    setTouched(true);
    if (!valid) return;
    onSave(value.trim());
  };

  return (
    <Popover open onOpenChange={(next) => { if (!next) onClose(); }}>
      <PopoverAnchor asChild>
        <span className="absolute inset-0 pointer-events-none" />
      </PopoverAnchor>
      <PopoverContent
        className="w-64 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => {
          // Фокус по умолчанию уходит на сам контейнер поповера — переносим его на поле
          // ввода, чтобы можно было сразу печатать.
          e.preventDefault();
          inputRef.current?.focus();
        }}
        onKeyDown={(e) => {
          // Rendered in a portal, but React still bubbles its events to the cell that owns
          // the trigger — this grid is about to get a cell-level click handler.
          e.stopPropagation();
          // Ctrl/Cmd+Enter сохраняет: причину пишут между двумя отметками, и тянуться к
          // мыши на каждой строке — это и есть та задержка, из-за которой перестают
          // заполнять. Escape закрывает через сам примитив (onOpenChange выше).
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
        }}
      >
        <Label htmlFor={`${formId}-note`} className="mb-1 block text-xs font-medium">
          {en ? 'Reason for the absence' : 'Причина пропуска'}
        </Label>
        <Textarea
          id={`${formId}-note`}
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          className={cn(
            // `md:text-sm` on the base Textarea only loses to an unprefixed
            // `text-xs` when there's an explicit `md:` override too — twMerge
            // treats the two breakpoints as separate groups. And the base's
            // auto-resize effect sets an inline `height` on mount from
            // `scrollHeight`, which can come back shorter than three lines
            // once `rows={3}`'s own sizing is overridden — an explicit
            // min-height is a floor inline `height` can't shrink below.
            'min-h-[4.5rem] resize-none px-2 py-1 text-xs md:text-xs',
            touched && !valid ? 'border-rose-500' : 'border-input',
          )}
          // Namely NOT «предупредил заранее»: warning in advance is how the school hears
        // about the absence, not what makes it excusable. The reason has to be the reason.
        placeholder={en ? 'e.g. ill, family matter, competition' : 'например: болел, семейные обстоятельства, олимпиада'}
        />
        {touched && !valid && (
          <div className="mt-1 text-[11px] text-rose-600">
            {en ? 'A reason is required' : 'Причина обязательна'}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          {excused ? (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-gray-500 underline hover:text-rose-600"
            >
              {en ? 'Not excused' : 'Снять уважительную'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 dark:hover:bg-secondary"
            >
              {en ? 'Cancel' : 'Отмена'}
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded bg-amber-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-600"
            >
              {en ? 'Save' : 'Сохранить'}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
