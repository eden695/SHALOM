import React, { useState, useRef } from 'react';
import { RotateCcw } from 'lucide-react';

interface PatternGridProps {
  onPatternComplete: (patternString: string) => void;
  error?: boolean;
  label?: string;
}

// Interactive 3x3 pattern grid supporting touch & mouse drag or tap-sequence
export const PatternGrid: React.FC<PatternGridProps> = ({
  onPatternComplete,
  error = false,
  label = 'Reliez au moins 4 points pour tracer votre schéma',
}) => {
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const getNodeCenter = (index: number) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    // Grid coordinates in SVG 0..300 space (centers at 50, 150, 250)
    return {
      x: col * 100 + 50,
      y: row * 100 + 50,
    };
  };

  const detectNodeFromPoint = (clientX: number, clientY: number): number | null => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null;

    const cellW = rect.width / 3;
    const cellH = rect.height / 3;
    const col = Math.floor(relX / cellW);
    const row = Math.floor(relY / cellH);
    const index = row * 3 + col;

    // Check proximity to node center to avoid accidental diagonal skips
    const centerX = col * cellW + cellW / 2;
    const centerY = row * cellH + cellH / 2;
    const dist = Math.hypot(relX - centerX, relY - centerY);
    if (dist <= Math.min(cellW, cellH) * 0.36) {
      return index;
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const node = detectNodeFromPoint(e.clientX, e.clientY);
    if (node !== null) {
      setSelectedNodes([node]);
    } else {
      setSelectedNodes([]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const node = detectNodeFromPoint(e.clientX, e.clientY);
    if (node !== null) {
      setSelectedNodes((prev) => (prev.includes(node) ? prev : [...prev, node]));
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (selectedNodes.length >= 4) {
      const patternStr = selectedNodes.join('-');
      onPatternComplete(patternStr);
      setTimeout(() => setSelectedNodes([]), 450);
    } else if (selectedNodes.length > 0) {
      setTimeout(() => setSelectedNodes([]), 350);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-3 select-none">
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{label}</p>

      <div
        ref={gridRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-56 h-56 touch-none bg-slate-50 dark:bg-slate-900/70 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 cursor-crosshair"
      >
        {/* SVG Lines */}
        <svg viewBox="0 0 300 300" className="absolute inset-0 w-full h-full pointer-events-none">
          {selectedNodes.length > 1 &&
            selectedNodes.slice(0, -1).map((nodeIdx, i) => {
              const p1 = getNodeCenter(nodeIdx);
              const p2 = getNodeCenter(selectedNodes[i + 1]);
              return (
                <line
                  key={`${nodeIdx}-${selectedNodes[i + 1]}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={error ? '#ef4444' : '#2563eb'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeOpacity="0.7"
                />
              );
            })}
        </svg>

        {/* 9 Dots */}
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full relative z-10">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => {
            const isActive = selectedNodes.includes(index);
            const order = selectedNodes.indexOf(index) + 1;
            return (
              <div key={index} className="flex items-center justify-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                    isActive
                      ? error
                        ? 'bg-red-500 scale-125 text-white ring-4 ring-red-500/20'
                        : 'bg-blue-600 scale-125 text-white ring-4 ring-blue-600/20'
                      : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                  }`}
                >
                  {isActive && <span className="text-[10px] font-bold">{order}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedNodes.length > 0 && selectedNodes.length < 4 && (
        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          Reliez au moins 4 points ({selectedNodes.length}/4)
        </span>
      )}

      <button
        type="button"
        onClick={() => setSelectedNodes([])}
        className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Effacer le tracé</span>
      </button>
    </div>
  );
};
