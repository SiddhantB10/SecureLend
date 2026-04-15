import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

const LenderSelect = ({ name, value, options, onChange, placeholder = 'Select an option', className = '' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value]);

  const handleSelect = (nextValue) => {
    onChange({ target: { name, value: nextValue } });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="secure-select flex w-full items-center justify-between text-left"
      >
        <span className={selectedOption ? 'text-white' : 'text-white/35'}>{selectedOption?.label || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neon-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 mt-3 w-full overflow-hidden rounded-3xl border border-white/10 bg-[#171717] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="listbox"
        >
          <div className="max-h-64 overflow-auto p-2">
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => handleSelect(option.value)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${active ? 'bg-neon-500/15 text-neon-500' : 'text-white/80 hover:bg-white/5 hover:text-white'}`}
                >
                  <span>{option.label}</span>
                  {active ? <span className="text-xs uppercase tracking-[0.25em] text-neon-500">Selected</span> : null}
                </button>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </div>
  );
};

export default LenderSelect;