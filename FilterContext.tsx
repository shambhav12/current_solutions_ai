import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';

export type FilterType = 'today' | '7days' | '30days' | 'all' | 'custom';

export interface DateFilter {
    type: FilterType;
    label: string;
    startDate?: string;
    endDate?: string;
}

export type GstFilter = 'all' | 'gst' | 'non-gst';
export type PaymentFilter = 'all' | 'online' | 'offline' | 'credit';
export type BundleFilter = 'all' | 'bundle' | 'non-bundle';
export type ReturnFilter = 'all' | 'withReturns';

interface FilterContextType {
    dateFilter: DateFilter;
    setDateFilter: (filter: DateFilter) => void;
    gstFilter: GstFilter;
    setGstFilter: (filter: GstFilter) => void;
    paymentFilter: PaymentFilter;
    setPaymentFilter: (filter: PaymentFilter) => void;
    bundleFilter: BundleFilter;
    setBundleFilter: (filter: BundleFilter) => void;
    returnFilter: ReturnFilter;
    setReturnFilter: (filter: ReturnFilter) => void;
    resetFilters: () => void;
    activeFilterCount: number;
}

const initialDateFilter: DateFilter = { type: 'today', label: 'Today' };

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [dateFilter, setDateFilter] = useState<DateFilter>(initialDateFilter);
    const [gstFilter, setGstFilter] = useState<GstFilter>('all');
    const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
    const [bundleFilter, setBundleFilter] = useState<BundleFilter>('all');
    const [returnFilter, setReturnFilter] = useState<ReturnFilter>('all');

    const resetFilters = () => {
        setDateFilter(initialDateFilter);
        setGstFilter('all');
        setPaymentFilter('all');
        setBundleFilter('all');
        setReturnFilter('all');
    };

    const activeFilterCount = useMemo(() => {
        let count = 0;
        // We consider 'today' the default, so any other date filter is "active"
        if (dateFilter.type !== 'today') count++;
        if (gstFilter !== 'all') count++;
        if (paymentFilter !== 'all') count++;
        if (bundleFilter !== 'all') count++;
        if (returnFilter !== 'all') count++;
        return count;
    }, [dateFilter.type, gstFilter, paymentFilter, bundleFilter, returnFilter]);

    const value = useMemo(() => ({
        dateFilter,
        setDateFilter,
        gstFilter,
        setGstFilter,
        paymentFilter,
        setPaymentFilter,
        bundleFilter,
        setBundleFilter,
        returnFilter,
        setReturnFilter,
        resetFilters,
        activeFilterCount,
    }), [dateFilter, gstFilter, paymentFilter, bundleFilter, returnFilter]);

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