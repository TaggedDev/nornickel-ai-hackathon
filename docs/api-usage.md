# GraphRAG API — руководство по использованию

Гибридный GraphRAG-сервис поиска по R&D-корпусу (горно-металлургия). Headless HTTP
API: загрузка документов → построение графа знаний → поиск на естественном языке с
граундед-ответами и ссылками на источники.

- **Live base URL:** `https://science-search.shevkunov.space`
- **Локально:** `http://localhost:8000`
- **Формат:** `application/json` (кроме загрузки файла — `multipart/form-data`)
- **Аутентификация:** нет (сервис за reverse-proxy; доступ на уровне сети)
- **Интерактивная документация:** `GET /docs` (Swagger UI), схема — `GET /openapi.json`

Все примеры ниже — рабочие `curl` к live-URL. Замени URL на `localhost:8000` для локали.

---

## Быстрый старт

```bash
API=https://science-search.shevkunov.space

# 1. Загрузить документ
curl -s -X POST "$API/documents" -F "file=@обзор.docx" -F "category=Обзоры"

# 2. Посмотреть статус загрузки
curl -s "$API/documents" | python3 -m json.tool

# 3. Спросить
curl -s -X POST "$API/search" -H 'Content-Type: application/json' \
  -d '{"query":"Какие методы обессоливания воды применяются?"}' | python3 -m json.tool
```

---

## Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/documents` | Загрузить документ (запускает ingestion асинхронно) |
| `GET` | `/documents` | Список документов + статусы ingestion |
| `DELETE` | `/documents/{doc_id}` | Удалить документ и его факты из графа |
| `POST` | `/search` | Семантический запрос (гибридный GraphRAG) |

---

### 1. `POST /documents` — загрузить документ

`multipart/form-data`. Запускает ingestion (parse → chunk → LLM-extraction →
entity-resolution → загрузка в граф) **асинхронно** и сразу возвращает `202`.

**Поля формы:**

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `file` | binary | да | документ (см. поддерживаемые форматы) |
| `title` | string | нет | иначе берётся из имени файла |
| `category` | string | нет | напр. `Обзоры`, `Статьи`, `Доклады` |

**Поддерживаемые форматы:** `.docx`, `.pdf`, `.pptx`. Другое → `415`.
> ⚠️ Отсканированные PDF без текстового слоя завершатся статусом `failed`
> (`error: "no extractable text (scanned document?)"`) — OCR не выполняется.

**Пример:**
```bash
curl -s -X POST "$API/documents" \
  -F "file=@ОИП-05-2019 Параметры Cu EW.docx" \
  -F "category=Обзоры"
```

**Ответ `202 Accepted`** (`IngestResponse`):
```json
{
  "doc_id": "doc_a1b2c3d4e5f6",
  "status": "processing",
  "title": "ОИП-05-2019 Параметры Cu EW",
  "received_at": "2026-07-04T21:00:00Z"
}
```

**Жизненный цикл ingestion.** `202` означает лишь «принято». Дальше документ
проходит `processing` → `ready` | `failed`. Статус и число извлечённых фактов —
через `GET /documents`. Обработка крупного документа занимает от секунд до минут
(много LLM-вызовов на чанки).

**Коды:** `202` принято · `415` неподдерживаемый формат · `400` нет файла.

---

### 2. `GET /documents` — список документов

**Query-параметры (все опциональны):**

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `status` | string | — | фильтр: `processing` \| `ready` \| `failed` |
| `q` | string | — | подстрока в `title` |
| `limit` | int | 50 | пагинация |
| `offset` | int | 0 | пагинация |

**Пример:**
```bash
curl -s "$API/documents?status=ready&limit=100" | python3 -m json.tool
```

**Ответ `200`** (`DocumentList`):
```json
{
  "total": 11,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "doc_id": "doc_a1b2c3d4e5f6",
      "title": "ОИП-05-2019 Параметры Cu EW",
      "filename": "ОИП-05-2019 Параметры Cu EW.docx",
      "category": "Обзоры",
      "lang": "ru",
      "status": "ready",
      "n_chunks": 15,
      "n_entities": 42,
      "n_facts": 88,
      "ingested_at": "2026-07-04T21:03:11Z",
      "error": null
    }
  ]
}
```

Поле `error` заполняется только у `status: "failed"` (напр. скан-PDF или ошибка LLM).

---

### 3. `DELETE /documents/{doc_id}` — удалить документ

Удаляет факты/рёбра документа, чистит осиротевшие узлы-сущности (на которые больше
никто не ссылается) и пересчитывает противоречия. **Идемпотентно**; общие узлы
(напр. «никель», «шлак»), на которые ссылаются другие документы, сохраняются.

```bash
curl -s -X DELETE "$API/documents/doc_a1b2c3d4e5f6"
```

**Ответ `200`:**
```json
{
  "doc_id": "doc_a1b2c3d4e5f6",
  "deleted": true,
  "removed_facts": 88,
  "removed_edges": 88,
  "orphan_nodes_cleaned": 12,
  "contradicts_recomputed": 3
}
```
**Коды:** `200` удалено (`deleted: true`) · `404` не найдено.

---

### 4. `POST /search` — семантический запрос

Гибридный GraphRAG: LLM превращает запрос в структурированный интент → векторный
поиск (recall) + параметризованный Cypher (точность, числовые фильтры) → взвешенное
ранжирование фактов → LLM-синтез граундед-ответа с инлайн-цитатами.

**Тело запроса** (`SearchRequest`):

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `query` | string | да | вопрос на естественном языке (RU/EN) |
| `filters` | `QueryFilters` | нет | доп. фильтры (см. ниже) |

**`QueryFilters`:**

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `numeric` | `NumericCondition[]` | `[]` | числовые ограничения |
| `geo` | string \| null | `null` | `RU` \| `world` \| код страны |
| `year_from` | int \| null | `null` | нижняя граница года |
| `year_to` | int \| null | `null` | верхняя граница года |
| `confidence_min` | number | `0.0` | мин. достоверность факта (0..1) |

**`NumericCondition`:** `{ "param": "сульфаты", "op": "<=", "value": 300, "value_max": null, "unit": "мг/л" }`
Операторы `op`: `<`, `<=`, `=`, `>=`, `>`, `~` (около), `range` (тогда заполняются и `value`, и `value_max`).

**Пример (простой):**
```bash
curl -s -X POST "$API/search" -H 'Content-Type: application/json' \
  -d '{"query":"Как создаются блочные геомеханические модели и для чего применяются?"}'
```

**Пример (с фильтрами):**
```bash
curl -s -X POST "$API/search" -H 'Content-Type: application/json' -d '{
  "query": "методы обессоливания воды для обогатительной фабрики",
  "filters": {
    "numeric": [{"param":"сухой остаток","op":"<=","value":1000,"unit":"мг/дм3"}],
    "geo": "world",
    "year_from": 2015,
    "confidence_min": 0.4
  }
}'
```

**Ответ `200`** (`SearchResponseModel`):

| Поле | Тип | Описание |
|---|---|---|
| `query` | string | эхо запроса |
| `intent` | string | распознанный интент: `lookup` \| `comparison` \| `review` \| `gap` |
| `answer_md` | string | ответ в Markdown с инлайн-цитатами `[1][2]` |
| `citations` | `Citation[]` | источники (см. ниже) |
| `consensus` | array | согласованные утверждения с числом подтверждений |
| `contradictions` | array | противоречия между источниками |
| `gaps` | `Gap[]` | пробелы знаний (для интента `gap`) |
| `subgraph` | object | `{nodes[], edges[]}` для визуализации |
| `meta` | object | `{retrieved_facts, used_facts, model, no_data}` |

**`Citation`:** `{ id, doc_id, title, snippet, section, page, confidence, geo, year, lang }`
`id` — номер, на который ссылается `answer_md` (`[1]` → `citations` с `id:1`).

**`subgraph`:**
```json
{
  "nodes": [{"id":"n1","label":"электроэкстракция никеля"}],
  "edges": [{"id":"e1","type":"operates_at_condition","source":"n1","target":"n2",
             "props":{"snippet":"…","confidence":0.86,"doc_id":"doc_…","citation_id":1}}]
}
```

**Пример ответа (сокращённо):**
```json
{
  "query": "Как создаются блочные геомеханические модели?",
  "intent": "review",
  "answer_md": "**Создание ГБМ:** используется ГГИС [1]; учитываются физико-механические свойства пород [10]; строятся численные модели НДС [8][9]…",
  "citations": [
    {"id":1,"doc_id":"doc_17d45ac5b3a0","title":"Трофимов А.В. Опыт создания блочных геомеханических моделей в ГГИС","snippet":"…","confidence":0.83,"page":4,"geo":"RU","year":2024,"lang":"ru"}
  ],
  "consensus": [],
  "contradictions": [],
  "gaps": [],
  "subgraph": {"nodes":[…],"edges":[…]},
  "meta": {"retrieved_facts":34,"used_facts":10,"model":"…","no_data":false}
}
```

**Guardrail против галлюцинаций.** Если в графе нет данных по теме, `meta.no_data`
= `true`, а `answer_md` честно сообщает об отсутствии информации — модель НЕ выдумывает.
HTTP всё равно `200`.
> ⚠️ Известная особенность: при `no_data: true` массив `citations` всё равно может
> содержать ближайшие по вектору факты (retrieval всегда возвращает top-k). Ориентируйся
> на `meta.no_data`, а не на непустоту `citations`.

---

## Рецепты

**Залить папку и дождаться готовности (Python):**
```python
import httpx, os, glob, time

API = "https://science-search.shevkunov.space"
folder = "/path/to/Обзоры"

with httpx.Client(timeout=300) as c:
    ids = []
    for f in sorted(glob.glob(f"{folder}/*.docx") + glob.glob(f"{folder}/*.pdf")):
        r = c.post(f"{API}/documents",
                   files={"file": (os.path.basename(f), open(f, "rb").read(), "application/octet-stream")},
                   data={"category": os.path.basename(folder)})
        if r.status_code == 202:
            ids.append(r.json()["doc_id"])
        print(r.status_code, os.path.basename(f))

    # поллинг до завершения
    while True:
        docs = c.get(f"{API}/documents?limit=1000").json()["items"]
        mine = [d for d in docs if d["doc_id"] in ids]
        pend = [d for d in mine if d["status"] == "processing"]
        print(f"ready={sum(d['status']=='ready' for d in mine)} "
              f"failed={sum(d['status']=='failed' for d in mine)} processing={len(pend)}")
        if not pend:
            break
        time.sleep(15)
```

**Задать вопрос и вывести ответ + источники:**
```python
r = c.post(f"{API}/search", json={"query": "методы удаления SO2 из газов"})
d = r.json()
print(d["answer_md"])
for cit in d["citations"]:
    print(f"[{cit['id']}] {cit['title']} (conf={cit['confidence']}, p.{cit['page']})")
```

**Проверить, что ответ граундед:**
```python
d = c.post(f"{API}/search", json={"query": "…"}).json()
if d["meta"]["no_data"]:
    print("Нет данных по теме")
else:
    print(f"Ответ на {d['meta']['used_facts']} фактах, интент={d['intent']}")
```

---

## Ошибки

Единый формат:
```json
{ "detail": "document not found" }
```
Ошибки валидации тела (FastAPI) — `422` со стандартной структурой `HTTPValidationError`.

| Код | Когда |
|---|---|
| `202` | документ принят в обработку |
| `200` | успех (`GET`/`DELETE`/`POST /search`) |
| `400` | нет файла в `POST /documents` |
| `404` | документ не найден (`DELETE`) |
| `415` | неподдерживаемый формат файла |
| `422` | некорректное тело запроса |

---

## Практические заметки

- **Асинхронность.** `POST /documents` не ждёт обработки. Всегда поллите `GET /documents`
  до `ready`/`failed`.
- **Холодный старт.** Первый запрос после простоя/рестарта может быть медленным (несколько
  секунд); повторите с таймаутом ≥30 c.
- **Первый `/search`** после старта контейнера догружает эмбеддинг-модель (~2 ГБ) —
  первый ответ может занять минуту, дальше быстро.
- **Фоновая нагрузка.** Во время массового ingestion `GET /documents` может подтормаживать
  (общий event loop) — используйте ретраи и таймаут ≥30 c.
- **Форматы.** `.docx` (самые чистые), `.pdf` (текстовый слой; сканы → `failed`), `.pptx`
  (по слайду на секцию, текст + таблицы).
- **Языки.** RU и EN; синонимы канонизируются (напр. `электроэкстракция` ↔ `electrowinning`
  ↔ `EW`), так что запрос и документы могут быть на разных языках.
- **Числовая точность.** Числовые фильтры применяются точно (в Cypher `WHERE` по
  структурированным полям), не «на глаз».
```
