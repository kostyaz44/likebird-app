// ===== УТИЛИТЫ: Хэширование пароля =====
export const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'likebird-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
