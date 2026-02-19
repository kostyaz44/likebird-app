# 🐦 LikeBird — Деплой в онлайн

## Способ 1: Vercel (рекомендуемый, 2 минуты)

Самый быстрый способ — бесплатный хостинг с HTTPS и PWA.

### Шаги:

1. **Зарегистрируйтесь** на [vercel.com](https://vercel.com) (через GitHub)

2. **Загрузите проект на GitHub:**
   ```bash
   cd likebird-app
   git init
   git add .
   git commit -m "LikeBird v2.5"
   git remote add origin https://github.com/ВАШ_ЛОГИН/likebird-app.git
   git push -u origin main
   ```

3. **На Vercel:**
   - Нажмите **"Add New Project"**
   - Выберите репозиторий `likebird-app`
   - Framework: **Vite**
   - Нажмите **Deploy**

4. **Готово!** Через ~1 минуту получите ссылку вида:
   `https://likebird-app.vercel.app`

### Обновление:
Просто `git push` — Vercel автоматически пересоберёт.

---

## Способ 2: Netlify (2 минуты)

1. Зарегистрируйтесь на [netlify.com](https://netlify.com)
2. Перетащите папку `dist` (после `npm run build`) на страницу Netlify
3. Или подключите GitHub репозиторий

Build command: `npm run build`
Publish directory: `dist`

---

## Способ 3: Локальный запуск (для разработки)

```bash
cd likebird-app

# Установите зависимости
npm install

# Запустите dev-сервер
npm run dev

# Откройте http://localhost:3000
```

### Сборка для продакшена:
```bash
npm run build
npm run preview  # проверить сборку
```

Готовые файлы будут в папке `dist/`.

---

## Способ 4: VPS / свой сервер

```bash
# На сервере:
cd likebird-app
npm install
npm run build

# Настройте Nginx:
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/likebird-app/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /sw.js {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }
}
```

Не забудьте настроить SSL (Let's Encrypt) — PWA требует HTTPS!

---

## Способ 5: GitHub Pages (бесплатно)

1. В `vite.config.js` добавьте `base`:
   ```js
   export default defineConfig({
     base: '/likebird-app/',
     plugins: [react()],
   });
   ```

2. Установите gh-pages:
   ```bash
   npm install -D gh-pages
   ```

3. В `package.json` добавьте скрипт:
   ```json
   "scripts": {
     "deploy": "npm run build && gh-pages -d dist"
   }
   ```

4. ```bash
   npm run deploy
   ```

5. В настройках GitHub репозитория → Pages → Source: `gh-pages` branch

---

## 📲 Установка на телефон

После деплоя на любой из платформ:

### Android:
- Откройте сайт в Chrome → ⋮ → **"Установить приложение"**

### iPhone:
- Откройте в Safari → **"Поделиться"** → **"На экран Домой"**

### Desktop:
- Откройте в Chrome/Edge → иконка установки в адресной строке

---

## Структура проекта

```
likebird-app/
├── index.html              ← Точка входа с PWA мета-тегами
├── package.json            ← Зависимости и скрипты
├── vite.config.js          ← Конфиг сборщика
├── tailwind.config.js      ← Tailwind CSS конфиг
├── postcss.config.js       ← PostCSS конфиг
├── vercel.json             ← Конфиг для Vercel
├── .gitignore
├── public/
│   ├── manifest.json       ← PWA манифест
│   └── sw.js               ← Service Worker (оффлайн)
└── src/
    ├── main.jsx            ← React точка входа
    ├── index.css           ← Стили (Tailwind + кастом)
    └── LikeBirdApp.jsx     ← Основной компонент (5700+ строк)
```
