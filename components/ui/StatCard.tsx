import React from 'react';

export const StatCard: React.FC<{ title: string; value: string; subtext?: string; icon: React.ReactNode }> = ({ title, value, subtext, icon }) => (
    <div className="bg-surface p-6 rounded-lg shadow-lg border border-border flex items-center space-x-4 transition-transform duration-200 hover:scale-[1.02] hover:shadow-primary/20">
        <div className="p-3 rounded-full bg-primary/10 text-primary">
            {icon}
        </div>
        <div>
            <h3 className="text-sm font-medium text-text-muted">{title}</h3>
            <p className="text-2xl font-bold text-text-main mt-1">{value}</p>
            {subtext && <p className="text-xs text-text-muted mt-1">{subtext}</p>}
        </div>
    </div>
);
