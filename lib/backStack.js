'use client';

import { createContext, useContext, useEffect, useRef } from 'react';

// A registry of "things that should close when back is pressed"
// Child components register handlers here; Home's back-button hook drains them.
const BackStackContext = createContext(null);

export function BackStackProvider({ children, registry }) {
  return (
    <BackStackContext.Provider value={registry}>
      {children}
    </BackStackContext.Provider>
  );
}

// Hook used by child components (JournalView, ChatView, etc.) to register
// a close handler. While the component is mounted AND the handler is active
// (i.e. returns true when asked "do you have something to close?"),
// it will be invoked before any of the parent-level fallback actions.
//
// Example:
//   useBackHandler(
//     !!selectedEntry,                    // active when an entry is open
//     () => setSelectedEntry(null),       // what to do when back is pressed
//     'journal-selected-entry'            // unique id for this handler
//   );
export function useBackHandler(isActive, handler, id) {
  const registry = useContext(BackStackContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!registry) return;
    if (isActive) {
      registry.set(id, () => handlerRef.current());
      return () => registry.delete(id);
    }
  }, [registry, isActive, id]);
}
