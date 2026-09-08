import { useState, useEffect } from 'react';
import { getTheme, toggleTheme } from '../utils/storage';

export default function ThemeToggle({ className = '' }) {
  const [theme, setThemeState] = useState(() => getTheme());

  useEffect(() => {
    // Initial sync
    const current = getTheme();
    setThemeState(current);
    document.documentElement.setAttribute('data-theme', current);

    const handleThemeChange = (e) => {
      setThemeState(e.detail || getTheme());
    };
    window.addEventListener('dpp_theme_updated', handleThemeChange);
    return () => window.removeEventListener('dpp_theme_updated', handleThemeChange);
  }, []);

  const handleToggle = () => {
    const next = toggleTheme();
    setThemeState(next);
  };

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={handleToggle}
      title={theme === 'dark' ? 'Switch to Light Paper Mode' : 'Switch to Midnight Dark Mode'}
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
