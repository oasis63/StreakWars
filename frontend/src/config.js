// frontend/src/config.js
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.MODE === 'development' ? '' : 'https://streakwars.onrender.com');
