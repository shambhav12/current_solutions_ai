import React, { useState, useRef, useEffect } from 'react';
import { useFilters, DateFilter, FilterType } from '../../FilterContext';

const filterOptions: { type: FilterType, label: string }[] = [
    { type: 'today', label: 'Today' },
    { type: '7days', label: 'Last 7 Days' },
    { type: '30days', label: 'Last 30 Days' },
    { type: 'all', label: 'All Time' },
];

interface DateFilterComponentProps {
    className?: string;
}

const DateFilterComponent: React.FC<DateFilterComponentProps> = ({ className }) => {
    const { dateFilter, setDateFilter } = useFilters();
    const [isOpen, setIsOpen] = useState(false);
    const [customStart, setCustomStart] = useState(dateFilter.startDate || '');
    const [customEnd, setCustomEnd] = useState(dateFilter.endDate || '');
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePresetSelect = (option: { type: FilterType, label: string }) => {
        setDateFilter(option);
        setCustomStart('');
        setCustomEnd('');
        setIsOpen(false);
    };

    const handleApplyCustom = () => {
        if (customStart && customEnd) {
            const startDate = new Date(customStart);
            const endDate = new Date(customEnd);

            const formattedStart = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const formattedEnd = endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

            setDateFilter({
                type: 'custom',
                label: `${formattedStart} - ${formattedEnd}`,
                startDate: customStart,
                endDate: customEnd,
            });
            setIsOpen(false);
        }
    };

    return (
        <div className={`relative text-left ${className}`} ref={menuRef}>
            <div>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="inline-flex justify-center w-full rounded-md border border-border shadow-sm px-4 py-2 bg-surface text-sm font-medium text-text-main hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary"
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                >
                    {dateFilter.label}
                    <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="origin-top-right absolute mt-2 w-72 rounded-md shadow-lg bg-surface ring-1 ring-black ring-opacity-5 focus:outline-none z-10 border border-border sm:left-auto sm:right-0">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        {filterOptions.map(option => (
                            <button
                                key={option.type}
                                onClick={() => handlePresetSelect(option)}
                                className={`block w-full text-left px-4 py-2 text-sm transition-colors ${dateFilter.type === option.type ? 'bg-primary text-white' : 'text-text-main hover:bg-surface-hover'}`}
                                role="menuitem"
                            >
                                {option.label}
                            </button>
                        ))}
                        <div className="border-t border-border my-1"></div>
                        <div className="px-4 py-3 space-y-3">
                            <p className="text-sm font-medium text-text-main">Custom Range</p>
                            <div>
                                <label htmlFor="start-date" className="text-xs font-medium text-text-muted">Start Date</label>
                                <input
                                    type="date"
                                    id="start-date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="mt-1 w-full bg-background border border-border rounded-md shadow-sm py-1.5 px-3 text-sm focus:outline-none focus:ring-primary focus:border-primary"
                                />
                            </div>
                             <div>
                                <label htmlFor="end-date" className="text-xs font-medium text-text-muted">End Date</label>
                                <input
                                    type="date"
                                    id="end-date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="mt-1 w-full bg-background border border-border rounded-md shadow-sm py-1.5 px-3 text-sm focus:outline-none focus:ring-primary focus:border-primary"
                                />
                            </div>
                            <button
                                onClick={handleApplyCustom}
                                disabled={!customStart || !customEnd}
                                className="w-full text-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-focus disabled:bg-surface-hover disabled:cursor-not-allowed transition-colors"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateFilterComponent;