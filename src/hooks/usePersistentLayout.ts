import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * A hook to automatically persist the height of elements (like textareas) to localStorage.
 * It uses ResizeObserver to detect changes and debounces the save operation.
 * 
 * @param storageKey The key to use in localStorage
 * @returns An object containing a `track` function to be used as a ref callback.
 */
export function usePersistentHeights(storageKey: string) {
    const [heights, setHeights] = useState<Record<string, string>>({});
    const heightsRef = useRef<Record<string, string>>({});
    const observer = useRef<ResizeObserver | null>(null);
    const saveTimeout = useRef<number | undefined>(undefined);

    // Load initial state from storage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                setHeights(parsed);
                heightsRef.current = parsed;
            }
        } catch (error) {
            console.error('Failed to load layout:', error);
        }
    }, [storageKey]);

    // Initialize ResizeObserver
    useEffect(() => {
        if (!observer.current) {
            observer.current = new ResizeObserver((entries) => {
                const updates: Record<string, string> = {};
                let hasUpdate = false;

                entries.forEach((entry) => {
                    const target = entry.target as HTMLElement;
                    const id = target.dataset.pid;

                    // We check target.style.height because that's what the resize handle modifies.
                    // contentRect.height is the computed size, but we want to save the explicit style
                    // to restore it exactly as the user set it (preserving explicit px values).
                    if (id && target.style.height) {
                        if (heightsRef.current[id] !== target.style.height) {
                            updates[id] = target.style.height;
                            hasUpdate = true;
                        }
                    }
                });

                if (hasUpdate) {
                    setHeights((prev) => {
                        const next = { ...prev, ...updates };
                        heightsRef.current = next;

                        // Debounce save to localStorage
                        if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
                        saveTimeout.current = window.setTimeout(() => {
                            localStorage.setItem(storageKey, JSON.stringify(next));
                        }, 500);

                        return next;
                    });
                }
            });
        }

        return () => {
            if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
            observer.current?.disconnect();
            observer.current = null;
        };
    }, [storageKey]);

    // Ref callback to attached to elements
    const track = useCallback((id: string) => (node: HTMLElement | null) => {
        if (node) {
            node.dataset.pid = id;

            // Restore height if valid
            if (heightsRef.current[id]) {
                node.style.height = heightsRef.current[id];
            }

            observer.current?.observe(node);
        } else {
            // When node is unmounted, we don't necessarily need to unobserve 
            // because ResizeObserver handles GC, but specifically unobserving isn't 
            // easy without a reference map since node is null here.
            // Since we use a single global observer for the hook instance, it's generally fine.
        }
    }, []);

    return { track, heights };
}
