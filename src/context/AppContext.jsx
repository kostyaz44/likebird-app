import React, { createContext, useContext } from 'react';

const AppContext = createContext(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};

export const AppProvider = ({ children, value }) => (
  <AppContext.Provider value={value}>
    {children}
  </AppContext.Provider>
);
