# SPEC.md — техническая спецификация MVP

Значения порогов — дефолты, настраиваются в `rules.py` (константы наверху).

## 1. Данные
```
transactions(
  id INTEGER PK, date TEXT ISO, amount_cents INTEGER, currency TEXT DEFAULT 'CNY',
  merchant TEXT, merchant_key TEXT,        -- нормализованный (lower, без пробелов/номеров)
  category TEXT, direction TEXT CHECK IN ('out','in','transfer'),
  counterparty_type TEXT CHECK IN ('merchant','person','self'),
  source TEXT CHECK IN ('chat','csv','screenshot'),
  confidence REAL, status TEXT CHECK IN ('auto','pending','confirmed'),
  raw TEXT
)
merchant_memory(merchant_key PK, category, n_confirmed INTEGER, median_cents INTEGER, mad_cents INTEGER, updated_at)
profile(id=1, payday_day INTEGER, income_cents INTEGER, fixed_json TEXT, currency)
goals(id PK, name, target_cents, deadline TEXT, saved_cents INTEGER)
```
Суммы только целые (фены/центы), без float.

Дедупликация: ключ `(date, amount_cents, merchant_key)`; при совпадении `source` csv и chat — не дублировать, оставить запись с более высокой confidence.

## 2. Импорт CSV (один формат в MVP: WeChat Pay)
Нормализовать колонки → `transactions`. Переводы физлицам: `counterparty_type='person'`, `direction='transfer'`. Свои счета: `self`. Битые строки пропускать и считать в отчёте импорта («прочитано N, пропущено M»).

## 3. Три режима (`rules.decide(tx) -> silent|digest|ask`)
- **silent**: `merchant_memory.n_confirmed >= 2` И `confidence >= 0.85` И `|amount - median| <= 3*MAD` → status `auto`.
- **ask**: `counterparty_type='person'` без известного назначения, ИЛИ `amount > max(3*median_категории, 0.2*income)`, ИЛИ `confidence < 0.5` → status `pending`, вопрос сразу, в расчёты не входит до ответа.
- **digest**: всё остальное (новый продавец, `0.5 <= confidence < 0.85`) → status `pending`, попадает в сводку «Проверить»; в расчёты входит с пометкой.
- Исправление пользователя: перезаписать `merchant_memory.category`, `n_confirmed += 1`, пересчитать median/MAD.

## 4. AI-контракт (`ai.extract(input) -> JSON`)
Вход: текст чата или изображение. Выход строго:
```json
{"amount":"12.50","currency":"CNY","date":"2026-10-19","merchant":"Luckin Coffee",
 "category":"food_drink","direction":"out","counterparty_type":"merchant","confidence":0.92}
```
Невалидный JSON или `confidence` отсутствует → fallback на правила `rules`, status `pending`. Категории — фиксированный список (food_drink, groceries, transport, housing, subscriptions, shopping, health, entertainment, transfers, income, other).

## 5. Прогноз (`forecast.daily_allowance`)
```
free = balance_now − upcoming_fixed_until_payday − goal_monthly_contribution_remaining
allowance_per_day = floor(free / days_until_payday)   # min 0
pace = avg_flex_spend_per_day (последние 14 дней) vs allowance_per_day
```
`balance_now` в MVP = `income_this_cycle − spent_this_cycle` (без реального баланса). Входят `auto`+`confirmed`, `digest` с пометкой, `ask`-pending исключены. Граничные случаи: 0 дней до зарплаты, отрицательный free → allowance 0 и статус «перерасход».

## 6. Цель X и советы
- `monthly_needed = (target − saved) / months_left`; статус `on_track|behind|ahead` по сравнению с фактическими накоплениями цикла.
- Советы: код выбирает топ-3 категории по доле гибких расходов и считает «сокращение на ¥X ускорит цель на N дней». `ai.advise()` только формулирует текст по этим цифрам, нейтрально, без оценки поведения. Если цифр нет — советов нет.

## 7. Beta-экраны (мок на `/data`, без реальной логики)
- Learn/Insights: 3 карточки-образования, привязанные к `free` и наличию резерва; дисклеймер «не инвестиционный совет»; без названий конкретных инструментов.
- Leaderboard: метрика `savings_rate = saved / income`, друзья вымышленные из `demo_friends.json`, моя строка закреплена.

## 8. Порядок срезов и критерии готовности
1. **Импорт+БД**: загрузка `demo_statement.csv` → N записей в БД, дубли не создаются. *Тест: парсер, дедуп.*
2. **Правила и память**: `decide()` даёт silent/digest/ask на наборе из 20 кейсов; правка меняет память. *Тест: decide, MAD.*
3. **Прогноз**: `allowance_per_day` совпадает с ручным расчётом на 5 кейсах, включая границы. *Тест: forecast.*
4. **AI-извлечение**: сообщение «кофе 18 в luckin» → валидный JSON; fallback работает при ошибке.
5. **UI Dashboard + Chat + Import** по `docs/DESIGN.md`.
6. **Цель + советы**.
7. **Beta-экраны**.

## 9. Демо-сценарий (должен проходить целиком)
Загрузка выписки → бот «знает» привычки → кофе молча → новый продавец в «Проверить» → перевод другу = вопрос → правка запомнилась → «¥X в день» → цель + совет → (Beta) Learn / Leaderboard.

## 10. Метрики для питча (замерить на тест-наборе из ~50 строк)
Точность извлечения, точность категорий без правок, % записей без вопросов, шагов на запись vs ручной ввод.
