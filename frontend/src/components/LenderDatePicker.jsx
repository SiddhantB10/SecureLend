import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatDisplayDate = (value) => {
  if (!value) return 'dd-mm-yyyy';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'dd-mm-yyyy';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getIndiaDateParts = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce((parts, part) => {
      if (part.type !== 'literal') {
        parts[part.type] = Number(part.value);
      }
      return parts;
    }, {});

const toIndiaComparable = (date) => {
  const parts = getIndiaDateParts(date);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

const startOfMonthGrid = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return start;
};

const LenderDatePicker = ({ name, value, onChange, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const rootRef = useRef(null);
  const todayIndia = useMemo(() => {
    const parts = getIndiaDateParts();
    return new Date(parts.year, parts.month - 1, parts.day);
  }, []);
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate && toIndiaComparable(selectedDate) <= toIndiaComparable(todayIndia)) {
      return selectedDate;
    }
    return todayIndia;
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setYearOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setYearOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const start = startOfMonthGrid(year, month);
    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);
      return current;
    });
  }, [viewDate]);

  const selectedIso = selectedDate ? toIsoDate(selectedDate) : null;

  const handleSelect = (date) => {
    if (toIndiaComparable(date) > toIndiaComparable(todayIndia)) {
      return;
    }
    onChange({ target: { name, value: toIsoDate(date) } });
    setViewDate(date);
    setOpen(false);
    setYearOpen(false);
  };

  const shiftMonths = (amount) => {
    setViewDate((current) => {
      const nextDate = new Date(current.getFullYear(), current.getMonth() + amount, 1);
      const isFutureMonth = nextDate.getFullYear() > todayIndia.getFullYear()
        || (nextDate.getFullYear() === todayIndia.getFullYear() && nextDate.getMonth() > todayIndia.getMonth());
      return isFutureMonth ? new Date(todayIndia.getFullYear(), todayIndia.getMonth(), 1) : nextDate;
    });
  };

  const yearOptions = useMemo(() => {
    const currentYear = todayIndia.getFullYear();
    return Array.from({ length: 101 }, (_, index) => currentYear - 100 + index);
  }, [todayIndia]);

  const isNextMonthDisabled =
    viewDate.getFullYear() > todayIndia.getFullYear() ||
    (viewDate.getFullYear() === todayIndia.getFullYear() && viewDate.getMonth() >= todayIndia.getMonth());

  const isTodayMonthVisibleFuture =
    viewDate.getFullYear() === todayIndia.getFullYear() && viewDate.getMonth() > todayIndia.getMonth();

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="secure-date flex w-full items-center justify-between gap-4 text-left"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{formatDisplayDate(value)}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-neon-500" />
      </button>

      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 mt-3 w-[19rem] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
        >
            <div className="border-b border-gray-200 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-600">Date of birth</p>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span>{monthNames[viewDate.getMonth()]}</span>
                <button
                  type="button"
                  onClick={() => setYearOpen((current) => !current)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-900 transition hover:border-neon-500/40 hover:text-neon-500"
                >
                  {viewDate.getFullYear()}
                  <span className={`text-xs text-neon-500 transition-transform duration-200 ${yearOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
              </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => shiftMonths(-1)} className="rounded-full border border-gray-300 bg-gray-100 p-2 text-gray-700 transition hover:border-neon-500/40 hover:text-neon-500">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => !isNextMonthDisabled && shiftMonths(1)} disabled={isNextMonthDisabled} className="rounded-full border border-gray-300 bg-gray-100 p-2 text-gray-700 transition hover:border-neon-500/40 hover:text-neon-500 disabled:cursor-not-allowed disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            </div>

            {yearOpen ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-100 p-3">
                <div className="grid max-h-48 grid-cols-3 gap-2 overflow-auto pr-1">
                  {yearOptions.map((year) => {
                    const active = year === viewDate.getFullYear();
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => {
                          setViewDate((current) => {
                            const nextMonth = year === todayIndia.getFullYear() && current.getMonth() > todayIndia.getMonth()
                              ? todayIndia.getMonth()
                              : current.getMonth();
                            return new Date(year, nextMonth, 1);
                          });
                          setYearOpen(false);
                        }}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition ${active ? 'bg-neon-500 text-white' : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'}`}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-7 gap-1 px-4 pb-2 pt-4 text-center text-[0.65rem] uppercase tracking-[0.25em] text-gray-600">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 px-3 pb-3">
            {days.map((day) => {
              const isCurrentMonth = day.getMonth() === viewDate.getMonth();
              const isSelected = selectedIso === toIsoDate(day);
              const isFutureDate = toIndiaComparable(day) > toIndiaComparable(todayIndia);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelect(day)}
                  disabled={isFutureDate}
                  className={`h-10 rounded-xl text-sm transition ${isFutureDate ? 'cursor-not-allowed text-gray-300' : isSelected ? 'bg-neon-500 text-white shadow-lg shadow-neon-500/20' : isCurrentMonth ? 'text-gray-900 hover:bg-gray-200' : 'text-gray-400 hover:bg-gray-100'}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <button type="button" onClick={() => onChange({ target: { name, value: '' } })} className="text-sm font-medium text-gray-600 transition hover:text-neon-500">
              Clear
            </button>
            <button type="button" onClick={() => { const today = new Date(); setViewDate(today); handleSelect(today); }} className="text-sm font-medium text-neon-500 transition hover:text-neon-400">
              Today
            </button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
};

export default LenderDatePicker;