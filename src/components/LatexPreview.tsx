import React from 'react';
import { renderLatex, validateLatex } from '../utils/latex';
import { sanitizeHtml } from '../lib/safeHtml';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface LatexPreviewProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export const LatexPreview: React.FC<LatexPreviewProps> = ({ 
  latex, 
  displayMode = false, 
  className = '' 
}) => {
  const validation = validateLatex(latex);
  
  if (!latex.trim()) {
    return (
      <div className={`p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-center ${className}`}>
        Введите LaTeX формулу для предварительного просмотра
      </div>
    );
  }
  
  if (!validation.isValid) {
    return (
      <div className={`p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">Ошибка в LaTeX синтаксисе:</span>
        </div>
        <div className="text-red-600 text-sm font-mono bg-red-100 p-2 rounded">
          {latex}
        </div>
        <div className="text-red-600 text-sm mt-2">
          {validation.error}
        </div>
      </div>
    );
  }
  
  return (
    <div className={`p-4 border border-green-200 rounded-lg bg-green-50 ${className}`}>
      <div className="flex items-center gap-2 text-green-700 mb-2">
        <CheckCircle className="w-4 h-4" />
        <span className="font-medium">Предварительный просмотр:</span>
      </div>
      <div 
        className="flex justify-center"
        dangerouslySetInnerHTML={{ 
          __html: sanitizeHtml(renderLatex(latex, displayMode)) 
        }} 
      />
    </div>
  );
};

export default LatexPreview;
