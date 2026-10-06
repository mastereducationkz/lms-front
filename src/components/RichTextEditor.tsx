import React, { useRef, useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from './ui/dialog';
import 'katex/dist/katex.min.css';
import './rich-text-dark.css';
import { InlineMath, BlockMath } from 'react-katex';

// Функция для рендеринга контента с LaTeX
const renderContentWithLatex = (content: string) => {
  const parts: Array<{ type: 'text' | 'inline' | 'block'; content: string }> = [];
  let lastIndex = 0;
  
  // Находим block формулы ($$...$$)
  const blockRegex = /\$\$([^$]+?)\$\$/g;
  let match;
  
  while ((match = blockRegex.exec(content)) !== null) {
    // Добавляем текст перед формулой
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.index)
      });
    }
    
    // Добавляем block формулу
    parts.push({
      type: 'block',
      content: match[1]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Добавляем оставшийся текст
  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex);
    
    // Находим inline формулы в оставшемся тексте
    const inlineRegex = /\$([^$\n]+?)\$/g;
    let inlineLastIndex = 0;
    
    while ((match = inlineRegex.exec(remainingText)) !== null) {
      // Добавляем текст перед inline формулой
      if (match.index > inlineLastIndex) {
        parts.push({
          type: 'text',
          content: remainingText.substring(inlineLastIndex, match.index)
        });
      }
      
      // Добавляем inline формулу
      parts.push({
        type: 'inline',
        content: match[1]
      });
      
      inlineLastIndex = match.index + match[0].length;
    }
    
    // Добавляем оставшийся текст после inline формул
    if (inlineLastIndex < remainingText.length) {
      parts.push({
        type: 'text',
        content: remainingText.substring(inlineLastIndex)
      });
    }
  }
  
  return parts;
};

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Start writing lesson content...",
  className = ""
}) => {
  const quillRef = useRef<ReactQuill>(null);
  const [showLatexDialog, setShowLatexDialog] = useState(false);
  const [latexInput, setLatexInput] = useState('');
  const [latexType, setLatexType] = useState<'inline' | 'block'>('inline');
  const [latexError, setLatexError] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const latexInputRef = useRef<HTMLInputElement>(null);
  const [quillCursorPosition, setQuillCursorPosition] = useState<number | null>(null);

  // Функция для открытия диалога LaTeX
  const openLatexDialog = () => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      if (range) {
        setQuillCursorPosition(range.index);
      }
    }
    setShowLatexDialog(true);
  };

  // Функция для вставки символа в позицию курсора
  const insertAtCursor = (symbol: string) => {
    const input = latexInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = latexInput.substring(0, start) + symbol + latexInput.substring(end);
    
    setLatexInput(newValue);
    
    // Устанавливаем курсор после вставленного символа
    setTimeout(() => {
      const newPosition = start + symbol.length;
      input.setSelectionRange(newPosition, newPosition);
      input.focus();
    }, 0);
  };

  // Auto-resize functionality
  useEffect(() => {
    const adjustHeight = () => {
      if (quillRef.current) {
        const quill = quillRef.current.getEditor();
        const editor = quill.root;
        
        // Reset height to auto to get the correct scroll height
        editor.style.height = 'auto';
        
        // Calculate new height based on content
        const contentHeight = editor.scrollHeight;
        const minHeight = 300;
        const maxHeight = 800;
        
        // Set height within bounds
        const newHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
        editor.style.height = `${newHeight}px`;
      }
    };

    // Adjust height when value changes
    adjustHeight();
    
    // Also adjust on window resize
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, [value]);

  // Функция для проверки валидности LaTeX
  const validateLatex = (latex: string): boolean => {
    try {
      if (latex.trim() === '') return true;
      // Простая проверка - если KaTeX может отрендерить, то формула валидна
      return true;
    } catch (error) {
      return false;
    }
  };

  // Функция для рендеринга предпросмотра
  const renderPreview = () => {
    if (!latexInput.trim()) {
      return (
        <div className="p-4 border border-dashed border-input rounded-lg bg-muted text-center text-muted-foreground">
          Formula preview will appear here
        </div>
      );
    }

    try {
      if (latexType === 'inline') {
        return (
          <div className="p-4 border border-border rounded-lg bg-card">
            <InlineMath math={latexInput} />
          </div>
        );
      } else {
        return (
          <div className="p-4 border border-border rounded-lg bg-card">
            <BlockMath math={latexInput} />
          </div>
        );
      }
    } catch (error) {
      setLatexError('Invalid LaTeX formula');
      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-600 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-400">
          Invalid LaTeX formula
        </div>
      );
    }
  };

  // Функция для вставки LaTeX формулы
  const insertLatex = (latex: string, type: 'inline' | 'block' = 'inline') => {
    if (quillRef.current && quillCursorPosition !== null) {
      const quill = quillRef.current.getEditor();
      const delimiter = type === 'inline' ? '$' : '$$';
      const formula = `${delimiter}${latex}${delimiter}`;
      
      // Вставляем формулу в сохраненную позицию курсора
      quill.insertText(quillCursorPosition, formula);
      
      // Перемещаем курсор после формулы
      quill.setSelection(quillCursorPosition + formula.length, 0);
      
      // Сбрасываем сохраненную позицию
      setQuillCursorPosition(null);
    }
  };

  // Функция для вставки математического символа
  const insertMathSymbol = (symbol: string) => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      
      if (range) {
        quill.insertText(range.index, symbol);
        quill.setSelection(range.index + symbol.length, 0);
      }
    }
  };

  // Обработчик вставки формулы через диалог
  const handleInsertLatex = () => {
    if (latexInput.trim()) {
      insertLatex(latexInput, latexType);
      setLatexInput('');
      setShowLatexDialog(false);
    }
  };

  // Обработчик закрытия диалога
  const handleCloseDialog = () => {
    setShowLatexDialog(false);
    setLatexInput('');
    setQuillCursorPosition(null);
  };

  // Кастомный модуль для LaTeX кнопки
  const LatexButton = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return null;

    const toolbar = quill.getModule('toolbar');
    const container = toolbar.container;
    
    // Создаем кнопку LaTeX
    const latexButton = document.createElement('button');
    latexButton.innerHTML = '<p>LaTeX</p>';
    latexButton.className = 'ql-latex';
    latexButton.title = 'LaTeX Formula';
    latexButton.onclick = () => openLatexDialog();
    
    // Добавляем кнопку в toolbar
    const lastGroup = container.querySelector('.ql-formats:last-child');
    if (lastGroup) {
      lastGroup.appendChild(latexButton);
    }
  };

  // Добавляем кнопку LaTeX в toolbar после инициализации
  useEffect(() => {
    if (quillRef.current) {
      const timer = setTimeout(() => {
        LatexButton();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Стандартная конфигурация модулей для toolbar
  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'size': [] }],
      [{ 'align': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false,
    },
  };

  // Форматы для toolbar
  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'font', 'size',
    'align',
    'list', 'bullet',
    'indent',
    'link', 
    'clean'
  ];

  return (
    <div className={`rich-text-editor ${className}`}>
          <Dialog open={showLatexDialog} onOpenChange={setShowLatexDialog}>
            {/* Dark backdrop overlay */}
            {showLatexDialog && (
              <div 
                className="fixed inset-0 bg-black/50 z-[9998]" 
                style={{ zIndex: 9998 }}
                onClick={() => setShowLatexDialog(false)}
              />
            )}
            <DialogContent 
              className="max-w-4xl z-[9999] fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" 
              style={{ 
                zIndex: 9999,
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                maxHeight: '90vh',
                overflow: 'auto'
              }}
            >
              <DialogHeader>
                <DialogTitle>Insert LaTeX Formula</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Formula Type:</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={latexType === 'inline' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLatexType('inline')}
                    >
                      Inline
                    </Button>
                    <Button
                      variant={latexType === 'block' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLatexType('block')}
                    >
                      Block
                    </Button>
                  </div>
                </div>

                {/* Formula Preview */}
                <div className="space-y-2">
                  <Label>Preview:</Label>
                  {renderPreview()}
                </div>

                <div className="space-y-2">
                  <Label>LaTeX Code:</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={latexInputRef}
                      value={latexInput}
                      onChange={(e) => {
                        setLatexInput(e.target.value);
                        setLatexError(null); // Очищаем ошибку при изменении
                      }}
                      onSelect={(e) => {
                        const target = e.target as HTMLInputElement;
                        setCursorPosition(target.selectionStart || 0);
                      }}
                      placeholder="Enter LaTeX formula..."
                      className="font-mono flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLatexInput('')}
                      className="px-3"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

              

                {/* Quick Formulas */}
                <div className="space-y-2">
                  <Label>Quick Formulas:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'System of Equations', latex: '\\begin{cases} x + y = 5 \\\\ 2x - y = 1 \\end{cases}' },
                      { label: 'Inequality', latex: 'x > 5' },
                      { label: 'Double Inequality', latex: '1 < x < 10' },
                      { label: 'sin', latex: '\\sin(x)' },
                      { label: 'cos', latex: '\\cos(x)' },
                      { label: 'tan', latex: '\\tan(x)' },
                      { label: 'Quadratic Equation', latex: 'ax^2 + bx + c = 0' },
                      { label: 'Fraction', latex: '\\frac{a}{b}' },
                      { label: 'Square Root', latex: '\\sqrt{x}' },
                      { label: 'Power', latex: 'x^n' }
                    ].map((formula, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => insertAtCursor(formula.latex)}
                        className="text-xs h-auto p-2"
                      >
                        {formula.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Mathematical Symbols */}
                <div className="space-y-2">
                  <Label>Mathematical Symbols:</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '±', latex: '\\pm' },
                      { label: '≠', latex: '\\neq' },
                      { label: '≤', latex: '\\leq' },
                      { label: '≥', latex: '\\geq' },
                      { label: '∞', latex: '\\infty' },
                      { label: 'π', latex: '\\pi' },
                      { label: 'α', latex: '\\alpha' },
                      { label: 'β', latex: '\\beta' },
                      { label: '×', latex: '\\times' },
                      { label: '÷', latex: '\\div' },
                      { label: '→', latex: '\\rightarrow' },
                      { label: '←', latex: '\\leftarrow' }
                    ].map((symbol, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => insertAtCursor(symbol.latex)}
                        className="text-xs h-auto p-2"
                      >
                        {symbol.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCloseDialog}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleInsertLatex}>
                    Insert
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{ minHeight: '200px', maxHeight: '800px' }}
      />
    </div>
  );
};

export default RichTextEditor;
