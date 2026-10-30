import { createContext, useContext, useSyncExternalStore } from 'react';

// The signed-in user and counts the sidebar shows, shared with every page.
export const AppContext = createContext(null);

export function useApp() {
    const value = useContext(AppContext);
    if (!value) throw new Error('useApp must be used inside <AppLayout>');
    return value;
}

export function useMediaQuery(query) {
    return useSyncExternalStore(
        (onChange) => {
            const list = window.matchMedia(query);
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        () => window.matchMedia(query).matches,
        () => false,
    );
}
