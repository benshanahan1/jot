import { ReactNode, useState, useRef, useEffect } from 'react';
import '../tooltip.css';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [alignment, setAlignment] = useState<'center' | 'right'>('center');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && wrapperRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Check if tooltip would go off the right edge
      if (tooltipRect.right > viewportWidth - 10) {
        setAlignment('right');
      } else {
        setAlignment('center');
      }
    }
  }, [isVisible]);

  return (
    <div
      ref={wrapperRef}
      className="tooltip-wrapper"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div ref={tooltipRef} className={`tooltip tooltip-${alignment}`}>
          {content}
        </div>
      )}
    </div>
  );
}
