import { useState, useEffect } from 'react';

/**
 * A custom hook that debounces a value.
 * It's useful for delaying the execution of a function or effect until the user has stopped typing for a certain amount of time.
 * @param value The value to debounce.
 * @param delay The delay in milliseconds.
 * @returns The debounced value.
 */
export const useDebounce = <T>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Set up a timer to update the debounced value after the specified delay.
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Clean up the timer if the value changes or the component unmounts.
        // This prevents the debounced value from being updated unnecessarily.
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};
