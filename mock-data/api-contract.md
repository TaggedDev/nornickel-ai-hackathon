# API-контракт: GraphRAG-сервис (горно-металлургия)

**Версия:** v0 (хакатон) · **Дата:** 2026-07-04
**Base URL:** `http://<host>:8000`
**Content-Type:** `application/json` (кроме загрузки файла — `multipart/form-data`)

Сервис headless. Фронт/пользователи/роли — на стороне консьюмера. Ниже — всё, что
нужно, чтобы ходить к нашему API. Все примеры-ответы можно использовать как моки.

---

## Общие соглашения

- Все временные метки — ISO-8601 UTC (`2026-07-04T10:00:00Z`).
- `doc_id` — строка вида `doc_<12hex>`; узел графа — `n<int>`; ребро — `e<int>`.
- Ошибки — единый формат:
  ```json
  { "error": { "code": "not_found", "message": "document not found", "detail": null } }
  ```
  Коды: `bad_request`, `not_found`, `unsupported_media`, `processing`, `internal`.

### Общие enum'ы

| Enum | Значения |
|---|---|
| `node.type` | `Material`, `Process`, `Equipment`, `Property`, `Experiment`, `Publication`, `Expert`, `Facility` |
| `edge.type` | `uses_material`, `operates_at_condition`, `produces_output`, `described_in`, `validated_by`, `contradicts` |
| `intent` | `lookup`, `comparison`, `review`, `gap` |
| `doc.status` | `processing`, `ready`, `failed` |
| `geo` | `RU`, `world`, `<ISO-код страны>` (напр. `AU`, `ES`) |
| `numeric.op` | `<`, `<=`, `=`, `>=`, `>`, `~` (около), `range` |

**Числовое условие** (сквозной тип):
```json
{ "param": "сульфаты", "op": "<=", "value": 300, "unit": "мг/л", "value_max": null }
```
Для `op:"range"` заполняются `value` (нижняя) и `value_max` (верхняя).

---

## 1. `POST /documents` — добавить документ

Запускает ingestion асинхронно (parse → chunk → extract → resolve → load). Возврат
сразу, статус тянется через `GET /documents`.

**Вариант A — загрузка файла** (`multipart/form-data`):

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `file` | binary | да | .docx/.pdf |
| `title` | string | нет | иначе берётся из имени файла |
| `category` | string | нет | напр. `Обзоры`, `Статьи` |
| `geo_hint` | string | нет | подсказка гео, если известна |
| `lang_hint` | string | нет | `ru`/`en`, иначе автоопределение |

**Вариант B — по server-local пути** (`application/json`, для сид-скрипта):
```json
{ "path": "/data/Обзоры/ОИП-05-2019 Параметры Cu EW.docx", "category": "Обзоры" }
```

**Ответ `202 Accepted`:**
```json
{
  "doc_id": "doc_a1b2c3d4e5f6",
  "status": "processing",
  "title": "ОИП-05-2019 Параметры Cu EW",
  "received_at": "2026-07-04T10:00:00Z"
}
```
Ошибки: `415 unsupported_media` (не docx/pdf), `400 bad_request` (нет файла/пути).

---

## 2. `GET /documents` — список документов

**Query-параметры (все опциональны):**

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `status` | enum | — | фильтр по статусу |
| `q` | string | — | подстрока в title |
| `limit` | int | 50 | пагинация |
| `offset` | int | 0 | пагинация |

**Ответ `200 OK`:**
```json
{
  "total": 120,
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
      "ingested_at": "2026-07-04T10:03:11Z",
      "error": null
    }
  ]
}
```
`status:"failed"` → поле `error` содержит причину (напр. `"scanned pdf, no text layer"`).

---

## 3. `DELETE /documents/{doc_id}` — удалить документ

Удаляет факты/рёбра документа, чистит осиротевшие узлы, пересчитывает `contradicts`.
Идемпотентно.

**Ответ `200 OK`:**
```json
{
  "doc_id": "doc_a1b2c3d4e5f6",
  "deleted": true,
  "removed_facts": 88,
  "removed_edges": 120,
  "orphan_nodes_cleaned": 12,
  "contradicts_recomputed": 3
}
```
Ошибки: `404 not_found`.

---

## 4. `POST /search` — семантический запрос (гибридный GraphRAG)

**Запрос:**
```json
{
  "query": "Какие технические решения организации циркуляции католита при электроэкстракции никеля описаны в мировой практике, и какая скорость потока считается оптимальной?",
  "filters": {
    "numeric": [{ "param": "скорость циркуляции", "op": ">", "value": 0, "unit": "м3/ч" }],
    "geo": "world",
    "year_from": 2010,
    "year_to": 2025,
    "confidence_min": 0.4,
    "intent": null
  },
  "options": {
    "max_citations": 10,
    "include_subgraph": true,
    "language": "ru"
  }
}
```
`filters` и `options` целиком опциональны. `intent:null` → определяется автоматически.

**Ответ `200 OK`** (полная схема; живой пример — в `mocks/search-catholyte.mock.json`):
```jsonc
{
  "query": "…",
  "intent": "lookup",
  "answer_md": "Строка Markdown с инлайн-цитатами [1][2]. …",
  "citations": [
    {
      "id": 1,
      "doc_id": "doc_…",
      "title": "…",
      "snippet": "дословная цитата-обоснование из документа",
      "section": "3.2 Циркуляция электролита",
      "page": 12,
      "confidence": 0.86,
      "geo": "world",
      "year": 2019,
      "lang": "ru"
    }
  ],
  "consensus": [
    { "statement": "…", "support_count": 4, "citation_ids": [1, 2, 3, 4] }
  ],
  "contradictions": [
    {
      "topic": "оптимальная скорость циркуляции католита",
      "positions": [
        { "claim": "…", "value": 8, "unit": "м3/ч", "citation_id": 1 },
        { "claim": "…", "value": 15, "unit": "м3/ч", "citation_id": 3 }
      ]
    }
  ],
  "gaps": [
    {
      "description": "…",
      "facet": "Process × климат",
      "missing_combination": { "process": "кучное выщелачивание", "condition": "холодный климат" },
      "suggestion": "…"
    }
  ],
  "subgraph": {
    "nodes": [
      {
        "id": "n1", "type": "Material", "label": "католит",
        "canonical_name": "католит (Ni electrowinning)", "aliases": ["catholyte"],
        "props": {}
      }
    ],
    "edges": [
      {
        "id": "e1", "type": "operates_at_condition",
        "source": "n2", "target": "n3",
        "props": { "snippet": "…", "confidence": 0.86, "doc_id": "doc_…", "citation_id": 1 }
      }
    ]
  },
  "meta": {
    "took_ms": 3200,
    "retrieved_facts": 34,
    "used_facts": 12,
    "model": "anthropic:claude-opus-4-8",
    "no_data": false
  }
}
```

**Случай «нет данных»:** `answer_md` объясняет отсутствие поддержки, `citations` пуст,
`meta.no_data:true`, обычно заполнен `gaps`. HTTP всё равно `200`.

---

## Стабильность контракта

Это `v0`. Поля могут ДОБАВЛЯТЬСЯ (консьюмеру стоит игнорировать неизвестные поля),
но перечисленные не переименовываются без бампа версии. Для параллельной разработки
консьюмер может поднять мок-сервер на `mocks/search-catholyte.mock.json`.
