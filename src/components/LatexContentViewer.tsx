import React from 'react';
import { sanitizeHtml } from '../lib/safeHtml';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface LatexContentViewerProps {
  content: string;
  className?: string;
}

const LatexContentViewer: React.FC<LatexContentViewerProps> = ({ content, className = "" }) => {
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

  const parts = renderContentWithLatex(content);

  return (
    <div className={`latex-content-viewer ${className}`}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index} dangerouslySetInnerHTML={{ __html: sanitizeHtml(part.content) }} />;
        } else if (part.type === 'inline') {
          try {
            return <InlineMath key={index} math={part.content} />;
          } catch (error) {
            return <span key={index} className="text-red-500">${part.content}$</span>;
          }
        } else if (part.type === 'block') {
          try {
            return (
              <div key={index} className="my-4 text-center">
                <BlockMath math={part.content} />
              </div>
            );
          } catch (error) {
            return <div key={index} className="text-red-500 my-4">$${part.content}$$</div>;
          }
        }
        return null;
      })}
    </div>
  );
};

export default LatexContentViewer;
