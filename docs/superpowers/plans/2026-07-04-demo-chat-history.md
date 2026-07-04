# Demo Chat History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small hardcoded frontend demo chat history with 30+ Russian-language demo chat titles.

**Architecture:** Keep the existing single-file frontend structure. Modify only the `pinnedChats` and `recentChats` constants in `App.tsx`, preserving the existing `ChatItem` interface and sidebar rendering.

**Tech Stack:** React, TypeScript, Vite.

## Global Constraints

Only frontend demo chat history is in scope. Do not change backend data, API contracts, authentication logic, routing, or sidebar layout behavior. The sidebar must show several pinned chats and at least 30 recent chats.

---

## File Structure

- Modify: `src/ScientificTangle.Frontend/src/App.tsx` replaces hardcoded `pinnedChats` and `recentChats` values.
- No new runtime source files are needed.
- Verify with the existing frontend build command from `src/ScientificTangle.Frontend/package.json`.

### Task 1: Replace Demo Chat History

**Files:**
- Modify: `src/ScientificTangle.Frontend/src/App.tsx:77-89`

**Interfaces:**
- Consumes: existing `ChatItem` type `{ id: string; title: string }`.
- Produces: `pinnedChats: ChatItem[]` and `recentChats: ChatItem[]` used by existing sidebar rendering.

- [ ] **Step 1: Inspect current constants**

Read `src/ScientificTangle.Frontend/src/App.tsx` and confirm `pinnedChats` and `recentChats` are defined near the top of the file.

- [ ] **Step 2: Replace constants with new demo data**

Replace the current arrays with this content:

```ts
const pinnedChats: ChatItem[] = [
  { id: "p1", title: "Дашборд отклонений по производству никеля" },
  { id: "p2", title: "Карта знаний по технологической цепочке" },
  { id: "p3", title: "Риски плавильного передела за неделю" },
  { id: "p4", title: "Сводка KPI для утреннего штаба" },
];

const recentChats: ChatItem[] = [
  { id: "r1", title: "Проанализировать причины снижения извлечения металла" },
  { id: "r2", title: "Сравнить сценарии переработки медно-никелевого концентрата" },
  { id: "r3", title: "Подготовить вопросы к отчёту по обогащению руды" },
  { id: "r4", title: "Найти связи между простоем оборудования и качеством сырья" },
  { id: "r5", title: "Сформировать краткую сводку по энергопотреблению" },
  { id: "r6", title: "Оценить влияние влажности шихты на режим печи" },
  { id: "r7", title: "Собрать гипотезы по потерям металла в хвостах" },
  { id: "r8", title: "Построить структуру графа знаний для фабрики" },
  { id: "r9", title: "Выделить ключевые события из сменного журнала" },
  { id: "r10", title: "Сравнить показатели цехов за последний квартал" },
  { id: "r11", title: "Подготовить резюме по аварийным остановкам" },
  { id: "r12", title: "Сформулировать SQL-запрос для анализа простоев" },
  { id: "r13", title: "Объяснить отклонения в расходе реагентов" },
  { id: "r14", title: "Сопоставить лабораторные пробы и параметры процесса" },
  { id: "r15", title: "Сделать план внедрения LLM-ассистента на участке" },
  { id: "r16", title: "Проверить корректность терминов в технологическом отчёте" },
  { id: "r17", title: "Найти узкие места в цепочке поставки сырья" },
  { id: "r18", title: "Подготовить тезисы для презентации по цифровизации" },
  { id: "r19", title: "Собрать список сущностей для промышленной онтологии" },
  { id: "r20", title: "Оценить риски изменения температурного режима" },
  { id: "r21", title: "Сравнить фактический выпуск с производственным планом" },
  { id: "r22", title: "Проверить аномалии в данных датчиков флотации" },
  { id: "r23", title: "Составить чек-лист для анализа качества концентрата" },
  { id: "r24", title: "Суммировать переписку по ремонту дробильного оборудования" },
  { id: "r25", title: "Предложить метрики для мониторинга технологического режима" },
  { id: "r26", title: "Разобрать причины роста себестоимости передела" },
  { id: "r27", title: "Подготовить набор промптов для производственного аналитика" },
  { id: "r28", title: "Выявить зависимости между сортом руды и выходом концентрата" },
  { id: "r29", title: "Составить краткий отчёт по экологическим показателям" },
  { id: "r30", title: "Сравнить варианты оптимизации логистики концентрата" },
  { id: "r31", title: "Объяснить модель прогнозирования отказов оборудования" },
  { id: "r32", title: "Подготовить план проверки качества данных MES" },
  { id: "r33", title: "Сгенерировать вопросы для интервью с технологом" },
  { id: "r34", title: "Свести замечания экспертов по графу знаний" },
  { id: "r35", title: "Сформировать сценарий демонстрации AI-ассистента" },
];
```

- [ ] **Step 3: Run frontend build**

Run: `npm run build`

Working directory: `src/ScientificTangle.Frontend`

Expected: Vite build completes without TypeScript errors.

- [ ] **Step 4: Review diff**

Run: `git diff -- src/ScientificTangle.Frontend/src/App.tsx docs/superpowers/specs/2026-07-04-chat-history-demo-design.md docs/superpowers/plans/2026-07-04-demo-chat-history.md`

Expected: diff includes only the spec, this plan, and replacement of the two demo chat arrays.

---

## Self-Review

Spec coverage: Task 1 replaces the frontend demo history with 4 pinned chats and 35 recent chats. Backend/API/auth/layout are untouched. Placeholder scan: no placeholders remain. Type consistency: all demo entries match existing `ChatItem` fields `id` and `title`.
