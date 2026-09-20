import React, { useState, useEffect, useCallback, useRef } from 'react';
import { lookupWord, quickCreateFlashcard } from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Loader2, X, Plus, Check, Search } from 'lucide-react';
import ThinkingLoader from '../ThinkingLoader';

interface LookupResult {
  word: string;
  phonetic: string | null;
  part_of_speech: string | null;
  definition_en: string;
  translation_ru: string;
  synonyms: string[];
  usage_example: string | null;
  etymology: string | null;
}

interface TextLookupPopoverProps {
  containerRef: React.RefObject<HTMLElement>;
}

export const TextLookupPopover: React.FC<TextLookupPopoverProps> = ({ containerRef }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [contextSentence, setContextSentence] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { isLookUpEnabled } = useSettings();

  const handleLookup = useCallback(async (text: string, context?: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setSaveSuccess(false);
    
    try {
      const lookupResult = await lookupWord(text, context);
      setResult(lookupResult);
    } catch (err: any) {
      setError(err.message || 'Failed to lookup word');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSaveToFlashcards = async () => {
    if (!result) return;
    
    setIsSaving(true);
    try {
      await quickCreateFlashcard({
        word: result.word,
        translation: result.translation_ru,
        definition: result.definition_en,
        context: contextSentence,
        phonetic: result.phonetic || undefined
      });
      setSaveSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save flashcard');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setResult(null);
    setError(null);
    setSelectedText('');
    setSaveSuccess(false);
    window.getSelection()?.removeAllRanges();
  }, []);

  const getContextSentence = (selection: Selection): string | undefined => {
    const anchorNode = selection.anchorNode;
    if (!anchorNode?.parentElement) return undefined;
    
    const text = anchorNode.textContent || '';
    const selectedStr = selection.toString();
    const idx = text.indexOf(selectedStr);
    
    if (idx === -1) return undefined;
    
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + selectedStr.length + 30);
    
    return text.substring(start, end).trim();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        
        if (text && text.length > 0 && text.length <= 100) {
          const anchorNode = selection?.anchorNode;
          if (!anchorNode || !container.contains(anchorNode)) return;
          
          // Don't trigger lookup if selection is inside the popover itself
          if (popoverRef.current && popoverRef.current.contains(anchorNode)) return;
          
          const context = selection ? getContextSentence(selection) : undefined;
          setContextSentence(context);
          setSelectedText(text);
          
          const rect = selection!.getRangeAt(0).getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          setPosition({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.bottom - containerRect.top + 8
          });
          
          setIsVisible(true);
          setResult(null);
          setError(null);
          setSaveSuccess(false);
        }
      }, 10);
    };

    container.addEventListener('mouseup', handleMouseUp);
    
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [containerRef, handleClose]);

  if (!isVisible || !isLookUpEnabled) return null;

  return (
    <div 
      ref={popoverRef}
      className="absolute z-50 -translate-x-1/2"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      <Card className="bg-white/60 backdrop-blur-xl border border-gray-200/40 shadow-lg shadow-black/10 overflow-hidden max-w-[380px]">
        {/* Initial toolbar - before lookup */}
        {!result && !error && (
          <div className="group flex items-center gap-1 px-1 py-1 min-w-max">
            <div className="grid grid-cols-1 grid-rows-1 items-center flex-grow">
              <div 
                className={`col-start-1 row-start-1 flex items-center justify-center transition-opacity duration-200 ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
                <ThinkingLoader state="searching" size={20} label={`Looking up "${selectedText}"…`} />
              </div>
              
              {/* Button Container */}
              <button 
                className={`col-start-1 row-start-1 flex items-center text-[13px] text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 px-1.5 py-1 rounded-md transition-all duration-300 font-medium text-left ${isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                onClick={() => handleLookup(selectedText, contextSentence)}
              >
                {/* Icon - always visible but subtle */}
                <Search className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                
                {/* Text - hidden initially, visible when group (toolbar) is hovered */}
                <span className="max-w-0 overflow-hidden group-hover:max-w-[240px] transition-all duration-300 ease-in-out whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:ml-2">
                  Look Up "{selectedText}"
                </span>
              </button>
            </div>
            
            {!isLoading && (
              <button 
                onClick={handleClose}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-md transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 text-center">
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <Button size="sm" variant="ghost" onClick={handleClose} className="text-xs">
              Close
            </Button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div>
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xl font-semibold text-gray-900 tracking-tight">
                    {result.word}
                  </span>
                  {result.phonetic && (
                    <span className="text-sm text-gray-400">
                      {result.phonetic}
                    </span>
                  )}
                  {result.part_of_speech && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {result.part_of_speech}
                    </span>
                  )}
                </div>
                <button 
                  onClick={handleClose}
                  className="p-1 -mr-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="px-4 py-3 space-y-3 max-h-[280px] overflow-y-auto">
              {/* Definition */}
              <div>
                <p className="text-[13px] leading-relaxed text-gray-700">
                  {result.definition_en}
                </p>
              </div>
              
              {/* Translation */}
              <div className="pt-2 border-t border-gray-100">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Перевод
                </span>
                <p className="mt-1 text-[13px] text-gray-600">
                  {result.translation_ru}
                </p>
              </div>
              
              {/* Synonyms */}
              {result.synonyms.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Synonyms
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.synonyms.slice(0, 5).map((syn, i) => (
                      <span 
                        key={i} 
                        className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-md"
                      >
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Example */}
              {result.usage_example && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Example
                  </span>
                  <p className="mt-1 text-[13px] text-gray-500 italic">
                    "{result.usage_example}"
                  </p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
              {saveSuccess ? (
                <div className="flex items-center justify-center gap-1.5 text-green-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Added to vocabulary</span>
                </div>
              ) : (
                <Button 
                  size="sm"
                  onClick={handleSaveToFlashcards}
                  disabled={isSaving}
                  className="w-full h-8 text-xs font-medium bg-gray-900 hover:bg-gray-800"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1.5" />
                      Add to Flashcards
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TextLookupPopover;
