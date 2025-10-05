import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';

export type FilterType = 'today' | '7days' | '30days' | 'all' | 'custom';

export interface DateFilter {
    type: FilterType;
    label: string;
    startDate?: string;
    endDate?: string;
}

interface FilterContextType {
    dateFilter: DateFilter;
    setDateFilter: (filter: DateFilter) => void;
}

const initialFilter: DateFilter = { type: 'today', label: 'Today' };

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [dateFilter, setDateFilter] = useState<DateFilter>(initialFilter);

    const value = useMemo(() => ({
        dateFilter,
        setDateFilter,
    }), [dateFilter]);

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    );
};

export const useFilters = (): FilterContextType => {
    const context = useContext(FilterContext);
    if (context === undefined) {
        throw new Error('useFilters must be used within a FilterProvider');
    }
    return context;
};