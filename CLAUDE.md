# CLAUDE.md

**Название продукта: County** (раньше «Finance Copilot»). Использовать «County» в UI, документах и питче.

AI-копилот личных финансов для хакатона FinTechathon (Topic A, рынок Китая). Пользователь грузит выписку или пишет в чат, бот запоминает привычки, тихо записывает знакомое, спрашивает только неясное, показывает «сколько можно тратить в день до зарплаты», помогает с целью и советами по экономии.

## Правила (всегда)
1. **Код только по явной команде пользователя.** Сначала план ≤10 строк, потом код.
2. Один вертикальный срез за раз, сразу рабочий. Не добавлять ничего вне списка MVP в `docs/SPEC.md`.
3. Экономия лимитов: не перечитывать файлы целиком (Grep/offset), не пересказывать код, отвечать кратко, тяжёлый поиск отдавать субагенту Explore.
4. **Деньги считает только код. LLM не складывает суммы и не даёт «купи X».** Инвестиционный контент = образование + дисклеймер «не инвестиционный совет».
5. Реальных финансовых данных и паролей не используем. Только синтетика из `/data`.
6. Не скрапить Alipay/WeChat. Автосбор через банки — только «Beta/roadmap».
7. Тесты — только для денежной логики (`forecast`, `rules`, парсер). Остальное проверяем руками на демо-данных.

## Где что лежит (читать по необходимости, не всё сразу)
| Файл | Когда читать |
|---|---|
| `docs/SPEC.md` | перед любой реализацией: схема данных, режимы, формулы, порядок срезов, критерии готовности |
| `docs/DESIGN.md` | перед любым UI: токены, раскладка, принципы |
| `docs/PRODUCT.md` | вопросы «зачем/для кого», питч, ограничения, риски |

## Стек (факт, без зависимостей — Node на машине нет)
- Frontend: чистый HTML/CSS/JS без сборки, мобильный-first (PWA: manifest + иконка), тёмная/светлая темы, i18n zh/en в `frontend/app.js`.
- Backend: Python 3.12, только stdlib (`http.server` + `sqlite3`), один демо-пользователь, без авторизации.
- AI: пока правила (`backend/chatparse.py`, `rules.py`). Claude API подключить позже через `ai.py` (нужен `ANTHROPIC_API_KEY`), правила остаются fallback. Модели: извлечение `claude-haiku-5-5`, советы `claude-sonnet-5-5`.

## Структура
```
backend/   server.py service.py db.py rules.py forecast.py parse_csv.py chatparse.py demo.py
frontend/  index.html app.js styles.css manifest.json icon.svg
data/      app.db (создаётся сам; демо-выписка генерируется в demo.py относительно «сегодня»)
docs/      SPEC.md DESIGN.md PRODUCT.md
```

## Команды
- запуск: `python backend/server.py` → http://localhost:8000 (превью-конфиг: `.claude/launch.json`, имя `app`)
- с телефона в той же Wi-Fi: `python backend/server.py --lan` и открыть напечатанный адрес
- скрипты ui-ux-pro-max и backend запускать БЕЗ флага `python -I`
- сброс данных: кнопка «Загрузить демо» на главной/импорте или удалить `data/app.db`

## UI-структура (frontend/app.js)
- Нижняя навигация: Home · History · Import · Goals · Profile. Чат = плавающая кнопка (FAB) → панель-шторка с голосом (Web Speech API; на телефоне по LAN-адресу микрофон нужен HTTPS).
- Шапка Home: «Подтвердить», рейтинг (Top), инвестиции (Invest). Подэкраны (review, top, invest, goal/…) имеют кнопку «назад» (`parentHash()`).
- Роуты: `#/home /history /import /goals /profile /review /top /invest[/topic] /goal/{id|new}[/edit]`.
- Контент обучения — `frontend/content.js` (zh/en, нейтрально, без рекомендаций «купи X»).
- Цели множественные; резерв = сумма месячных взносов всех целей (`forecast.goals_info`).
- История: `GET /api/transactions?year&month&day&category&direction&q`.

- Тема по умолчанию светлая; тёмная = глубокий синий (токены в `styles.css`). Выбор в Settings (Light/Dark). Одна гамма: mint `--accent` + blue `--accent2`; `--warn`/`--bad` только для статусов.
- Import: фото чека (`/api/scan`, `backend/scan.py`: Claude vision при `ANTHROPIC_API_KEY`, иначе помеченный DEMO-ответ), CSV-файл, банки/сервисы = Beta-заглушки.
- Фильтры истории — чипы (без нативных select). Аватар пользователя хранится в localStorage (`avatar`), у друзей нейтральные инициалы.

- Подтверждение: только галочка в шапке Home (бейдж + подсветка) → `#/review`; у каждой записи `reason` (new/unsure/unusual/large/person/unclear) из `rules.decide_ex`, варианты выбора + «не расход».
- История: iOS-колесо (год/месяц/день/категория) + сегмент со скользящим ползунком (`segCtl`). Профиль: ник/email/телефон в Settings (localStorage, только на устройстве).

- Камера: центральная плавающая кнопка над вкладкой Import (`#fab-scan`) на всех экранах; результат — всплывающая карточка `#scan-toast`. Чат — правая плавающая кнопка. Настройки открываются только шестерёнкой в шапке Profile.

- Ask AI (мок): `backend/advisor.py` + `POST /api/ask {kind: goal|save|budget|text, id?, text?}` возвращает структурный план (шаги, эффект в днях, ETA) на реальных цифрах `forecast.dashboard`; формулировки собирает фронт (`renderPlan`, zh/en). Кнопка «Ask AI» в Where to save и на экране цели открывает чат; свободный вопрос в чате (нет суммы) тоже идёт в ИИ. «Save together» — демо-друзья + ссылка-приглашение (Web Share / копирование). Подключить Claude: передать тот же план в модель для формулировки.

- Цели на Home: карусель со свайпом (`#gm-track`, scroll-snap, точки, перетаскивание мышью), активные цели первыми, завершённые затем, последний слайд «Add a goal».

## Расширения (спринт «демо-готовность»)
- Реестр `EXT` в `app.js`: новые фичи подключаются файлами `frontend/{insights,trust,bench,voicedemo,merchants_zh}.js` (маршруты `EXT.routes`, блоки `homeTop/profile/settings/goal/history/importTop`, `EXT.after`, `EXT.chatOpen`, `EXT.bankConsent`, `consentOk`, `mname`). Бэкенд: `backend/ext_routes.py` → `bench.py`, `trust.py`, `insights.py` (`register(GET, POST)`).
- Демо-персона 林小雨: `backend/demo.py` + `service.load_demo` (зарплата ¥15 000 на 10-е, 371 запись, 3 цели, калибровка «tight → ok» после +¥1 000 на Japan trip, рейтинг #3).
- Точность: `GET /api/benchmark` (60 синтетических строк; честные слабые места), экран `#/benchmark`. Приватность: согласие PIPL перед импортом (`consent_v1`), `#/privacy`, `GET /api/export`, имитация подключения банков. Инсайты: недельная сводка, серии/значки, what-if, `#/report` (`/api/insights`, `/api/report`).
- Invest v2 (`frontend/invest2.js` перекрывает маршрут `#/invest`): вкладки Learn / News / Research. Новости: `backend/news.py` (`GET /api/news?cat=`, `POST /api/news/refresh`) тянет публичные RSS из фиксированного списка (BBC, CNBC, MarketWatch, WSJ, Nasdaq, SCMP, Guardian; Forbes/Yahoo отдают 404), кэш 15 мин, при отсутствии сети — помеченные «Sample feed» заголовки без чужих брендов. Уроки: `backend/lessons.py` + `data/lessons/pack_{1,2,3}.json`, состояние `data/lessons_state.json`; `POST /api/lessons/update` — ИМИТАЦИЯ обновления (v1→v2→v3), `POST /api/lessons/reset` — сброс на v1 (кнопка «Reset demo pack»). Исследования: `GET /api/research` (проверенные ссылки, растут с версией пакета).
- Демо-инструменты (Settings): Reset demo data, Try sample receipt, голосовое демо-чипсы в чате. Китайские названия магазинов: `mname`.
- Ещё не сделано: настоящий Claude API (`ai.py`), порядок слайдов цели на Home (Japan trip первым — поменять срок в `load_demo`).

## Статус срезов (docs/SPEC.md §8)
Сделано: 1 импорт+БД, 2 правила и память, 3 прогноз, 4 чат-извлечение (правилами) + голос, 5 UI, 6 цели+советы, 7 Invest/Leaderboard (Beta, мок).
Не сделано: Claude API (`ai.py`), тесты денежной логики, PNG-иконка для iOS, формат выписки Alipay, реальные новости рынка.

## Скиллы (`.claude/skills`)
- Скиллы (добавлено): `impeccable` (только справочники `reference/*.md`: distill/clarify/quieter/critique/polish...; лаунчер-бинарник НЕ ставили: он качает и запускает exe) и `ux-writing` (краткий UI-текст). Правило: UI-текст короткий (заголовок + макс. 1 строка пояснения, кнопки 1–3 слова), длинное прячем в `<details class="more">Why?</details>`.

- `frontend-design`: перед новым экраном составить мини-план (цвет/шрифт/раскладка), сверить с `docs/DESIGN.md`, потом код.
- `ui-ux-pro-max`: справочник. Запускать `python scripts/search.py "<запрос>" --domain <ux|style|color|typography|chart>` из папки скилла (без флага `-I`). Не читать `data/` целиком.
- `web-design-guidelines`: только финальный аудит готового UI (тянет правила из сети).

## Определение «готово» для среза
Работает на демо-данных end-to-end, есть loading/empty/error, тёмная и светлая тема, 390px без горизонтального скролла, тесты денежной логики зелёные.

## Безопасность и навигация (факт)
- Сервер: POST только `application/json` (415), Host только localhost/127.0.0.1/[::1] (в `--lan` ещё LAN-IP), заголовки nosniff/DENY/CSP; в `--lan` печатается `?t=TOKEN`, фронт кладёт его в sessionStorage и шлёт `X-Token` на каждый `/api/*`.
- Внешних шрифтов/CDN нет (CSP `default-src 'self'`, Google Fonts заблокирован в КНР): шрифт системный, CJK-шрифты первыми.
- Назад: собственный стек посещённых hash (`navStack`, `goBack`/`syncStack` в app.js), `parentHash()` только запасной путь; новые маршруты не должны ломать стек.
