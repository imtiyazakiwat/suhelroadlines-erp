import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Chart.css';

/* =============================================================================
   BarChart — the one chart primitive.

   Every decision here traces to WWDC22 "Design an effective chart"
   (https://developer.apple.com/videos/play/wwdc2022/110340/):

   MARKS — bars, not lines or points. Trip data is sparse: plenty of days have
   no trips at all. Points make the pattern hard to read, and a line
   over-emphasises the segments bridging the gaps rather than the values. Bars
   keep zero days visible without turning them into a distraction, and because
   the measure is cumulative the combined visual weight of the bars corresponds
   to the period total.

   AXES — the upper bound is dynamic, like the step count chart in Health, since
   there is no natural maximum for trips or rupees. The lower bound is pinned to
   zero so a bar twice as tall really is twice the value. Grid lines are kept to
   about four and land on intuitive round numbers (1/2/2.5/5 × 10^n).

   INTERACTION — the hit target for each bar is a full-height column, not the
   bar itself, so short bars and the space above them are equally tappable.
   Keyboard and screen-reader users get the same thing: each column is a real
   button with its own label, and arrow keys move between them.

   ACCESSIBILITY — one accessibility element per data point, labelled with the
   contextualising value first ("14 August, ₹8,000"), words spelled out, no
   abbreviations, and no repetition of the axis names.

   COLOUR — carries no meaning on its own here. Selection is communicated by
   opacity and a value readout as well as by tint, so it survives Differentiate
   Without Color.

   Cost: O(n) to build and O(n) nodes. Bars are positioned in percentages, so
   nothing is measured and a resize costs no JavaScript.
   ========================================================================== */

/** Round up to a friendly axis maximum so grid labels read as round numbers. */
export const niceCeil = (value, ticks = 4) => {
  if (!Number.isFinite(value) || value <= 0) return { max: 0, step: 0 };

  const rough = value / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;

  // Steps that still read as round numbers, but close enough together that the
  // tallest bar uses most of the available height. With only 1/2/2.5/5/10 a max
  // of 11,000 rounded to 20,000 and the chart wasted half its vertical space.
  const factor =
    [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10].find((candidate) => normalised <= candidate) ?? 10;
  const step = factor * magnitude;

  return { max: step * ticks, step };
};

const BarChart = ({
  points = [],
  formatValue = (value) => String(value),
  formatAxis,
  height = 168,
  ticks = 4,
  selectedKey = null,
  onSelect,
  ariaLabel = 'Chart',
  className = ''
}) => {
  const [entered, setEntered] = useState(false);
  const columnsRef = useRef(null);

  // Bars start flat and grow on the next frame. Growth from the baseline is
  // what tells you the bars are anchored at zero; it is not decoration.
  // Durations come from the motion tokens, which collapse to ~0 under
  // prefers-reduced-motion, so this becomes a plain cross-fade there.
  useEffect(() => {
    setEntered(false);
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [points]);

  const { max, step } = useMemo(
    () => niceCeil(Math.max(0, ...points.map((point) => point.value || 0)), ticks),
    [points, ticks]
  );

  const gridValues = useMemo(() => {
    if (!step) return [0];
    return Array.from({ length: ticks + 1 }, (_, index) => step * index).reverse();
  }, [step, ticks]);

  // At most four x labels, evenly spaced, always including both ends. More than
  // that crowds a phone-width axis and stops being readable.
  const axisIndices = useMemo(() => {
    const count = points.length;
    if (count === 0) return [];
    if (count <= 4) return points.map((_, index) => index);

    const slots = 4;
    const picked = new Set();
    for (let slot = 0; slot < slots; slot += 1) {
      picked.add(Math.round((slot * (count - 1)) / (slots - 1)));
    }
    return [...picked].sort((a, b) => a - b);
  }, [points]);

  const selectedIndex = points.findIndex((point) => point.key === selectedKey);

  const onKeyDown = (event) => {
    if (!points.length) return;

    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta) {
      event.preventDefault();
      const from = selectedIndex === -1 ? (delta > 0 ? -1 : points.length) : selectedIndex;
      const next = Math.min(points.length - 1, Math.max(0, from + delta));
      onSelect?.(points[next]);
      // Keep focus travelling with the selection for Switch Control / keyboard.
      columnsRef.current?.querySelectorAll('.cht26__hit')[next]?.focus();
      return;
    }

    if (event.key === 'Escape' && selectedKey != null) {
      event.preventDefault();
      onSelect?.(null);
    }
  };

  const axisFormat = formatAxis || formatValue;
  const empty = max === 0;

  return (
    <div className={`cht26 ${className}`.trim()}>
      <div className="cht26__plot" style={{ height }}>
        {/* Grid lines give reference points for reading values in the middle of
            the chart, where the end labels alone are no help. */}
        <div className="cht26__grid" aria-hidden="true">
          {gridValues.map((value, index) => (
            <div className="cht26__gridline" key={value}>
              <span className="cht26__gridlabel">
                {index === gridValues.length - 1 ? '0' : axisFormat(value)}
              </span>
            </div>
          ))}
        </div>

        <div
          className="cht26__columns"
          ref={columnsRef}
          role="group"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
        >
          {points.map((point, index) => {
            const value = point.value || 0;
            const pct = empty ? 0 : Math.max(value > 0 ? 1.5 : 0, (value / max) * 100);
            const isSelected = point.key === selectedKey;
            const dimmed = selectedKey != null && !isSelected;

            return (
              <div
                className={`cht26__col ${isSelected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`.trim()}
                key={point.key}
              >
                <span
                  className="cht26__bar"
                  style={{
                    height: entered ? `${pct}%` : '0%',
                    transitionDelay: `${Math.min(index, 24) * 12}ms`
                  }}
                  aria-hidden="true"
                />

                {/* Full-height target: short bars and the empty space above them
                    are equally easy to hit. */}
                <button
                  type="button"
                  className="cht26__hit"
                  aria-label={point.a11yLabel || `${point.label}, ${formatValue(value)}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelect?.(isSelected ? null : point)}
                >
                  <span className="cht26__hit-sr">{formatValue(value)}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="cht26__axis" aria-hidden="true">
        {points.map((point, index) => (
          <span className="cht26__axis-slot" key={point.key}>
            {axisIndices.includes(index) ? point.shortLabel ?? point.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

export default BarChart;
