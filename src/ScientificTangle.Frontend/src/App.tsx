import { type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent, type ReactNode, type WheelEvent, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  type AuthUser,
  checkEmailAvailability,
  login,
  logout,
  register,
  type ValidationErrors,
} from "./shared/api/auth";
import searchCatholyteMock from "../../../mock-data/search-catholyte.mock.json";

type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  disabled?: boolean;
};

type ChatItem = {
  id: string;
  title: string;
};

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type KnowledgeGraphNode = {
  id: string;
  type: "Material" | "Process" | "Equipment" | "Property" | "Experiment" | "Publication" | "Expert" | "Facility";
  label: string;
  canonicalName: string;
  aliases: string[];
  properties: Record<string, unknown>;
  x: number;
  y: number;
};

type KnowledgeGraphEdge = {
  id: string;
  type: string;
  source: string;
  target: string;
  label: string;
  properties: Record<string, unknown>;
};

type ReferencedDocument = {
  id: string;
  title: string;
  snippet: string;
  section: string;
  page: number;
  confidence: number;
  year: number;
  language: string;
  downloadUrl: string;
};

type ChatKnowledgeContext = {
  graph: {
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
  };
  documents: ReferencedDocument[];
  representedNodeIds: string[];
};

type MockSearchResponse = {
  query: string;
  answer_md: string;
  citations: Array<{
    id: number;
    doc_id: string;
    title: string;
    snippet: string;
    section: string;
    page: number;
    confidence: number;
    year: number;
    lang: string;
  }>;
  subgraph: {
    nodes: Array<{
      id: string;
      type: KnowledgeGraphNode["type"];
      label: string;
      canonical_name: string;
      aliases: string[];
      props: Record<string, unknown>;
    }>;
    edges: Array<{
      id: string;
      type: string;
      source: string;
      target: string;
      props: Record<string, unknown>;
    }>;
  };
  meta: Record<string, unknown>;
};

type AppRoute = "/" | "/auth" | "/access-denied";
type AuthMode = "login" | "register";
type AuthViewState = "idle" | "loading";

type LoginFormState = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type RegisterFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  roleName: string;
};

type RoleOption = {
  value: string;
  label: string;
};

type AppErrorState = {
  message: string;
  fieldErrors: ValidationErrors;
};

const USER_STORAGE_KEY = "scientific-tangle-auth-user";
const SIDEBAR_STORAGE_KEY = "scientific-tangle-sidebar-mode";
const CONTEXT_STORAGE_KEY = "scientific-tangle-context-open";
const MOBILE_BREAKPOINT = 768;

const roleOptions: RoleOption[] = [
  { value: "Researcher", label: "Исследователь" },
  { value: "Analyst", label: "Аналитик" },
  { value: "ProjectManager", label: "Руководитель проекта" },
  { value: "Administrator", label: "Администратор" },
  { value: "ExternalPartner", label: "Внешний партнёр" },
];

const navItems: NavItem[] = [
  { id: "new", label: "Новый чат", icon: "spark" },
  { id: "search", label: "Поиск чатов", icon: "search" },
];

const pinnedChats: ChatItem[] = [
  { id: "p1", title: "Дашборд отклонений по производству никеля" },
  { id: "p2", title: "Карта знаний по технологической цепочке" },
  { id: "p3", title: "Риски плавильного передела за неделю" },
  { id: "p4", title: "Сводка KPI для утреннего штаба" },
];

const seededDemoChatId = "demo-loss-reduction-dialog";

const initialRecentChats: ChatItem[] = [
  { id: seededDemoChatId, title: "Диалог по снижению потерь металла" },
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

const initialChatMessagesById: Record<string, Message[]> = {
  [seededDemoChatId]: [
    {
      id: "seeded-demo-user-1",
      role: "user",
      text: "Нужно быстро понять, почему выросли потери металла в хвостах за последнюю неделю.",
    },
    {
      id: "seeded-demo-assistant-1",
      role: "assistant",
      text: "Сначала стоит сравнить распределение по сменам, влажность сырья, расход реагентов и долю тонких классов. Эти факторы чаще всего дают резкий рост потерь.",
    },
    {
      id: "seeded-demo-user-2",
      role: "user",
      text: "Какие данные лучше проверить в первую очередь?",
    },
    {
      id: "seeded-demo-assistant-2",
      role: "assistant",
      text: "Начните с трёх срезов: лабораторные пробы хвостов по дням, параметры флотации по сменам и журнал простоев оборудования. Если пики совпадут по времени, можно сузить причину до конкретного участка.",
    },
  ],
};

const llmSearchResponse = searchCatholyteMock as MockSearchResponse;

const edgeTypeLabels: Record<string, string> = {
  uses_material: "использует материал",
  operates_at_condition: "условие работы",
  produces_output: "производит результат",
  described_in: "описано в",
  validated_by: "подтверждено",
  contradicts: "противоречит",
};

const graphNodeLayout: Record<string, { x: number; y: number }> = {
  n1: { x: 420, y: 235 },
  n2: { x: 205, y: 170 },
  n3: { x: 210, y: 355 },
  n4: { x: 650, y: 170 },
  n5: { x: 650, y: 355 },
};

function buildKnowledgeContextFromLlmResponse(response: MockSearchResponse): ChatKnowledgeContext {
  const nodes = response.subgraph.nodes.map((node, index) => {
    const fallbackAngle = (Math.PI * 2 * index) / Math.max(response.subgraph.nodes.length, 1);
    const layout = graphNodeLayout[node.id] ?? {
      x: 420 + Math.cos(fallbackAngle) * 230,
      y: 235 + Math.sin(fallbackAngle) * 135,
    };

    return {
      id: node.id,
      type: node.type,
      label: node.label,
      canonicalName: node.canonical_name,
      aliases: node.aliases,
      properties: node.props,
      x: layout.x,
      y: layout.y,
    };
  });

  return {
    graph: {
      nodes,
      edges: response.subgraph.edges.map((edge) => ({
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        label: edgeTypeLabels[edge.type] ?? edge.type,
        properties: edge.props,
      })),
    },
    documents: response.citations.map((citation) => ({
      id: citation.doc_id,
      title: citation.title,
      snippet: citation.snippet,
      section: citation.section,
      page: citation.page,
      confidence: citation.confidence,
      year: citation.year,
      language: citation.lang,
      downloadUrl: "#",
    })),
    representedNodeIds: nodes.map((node) => node.id),
  };
}

const promptSuggestions = [
  "Какие методы обессоливания воды подходят для обогатительной фабрики, если исходная вода содержит сульфаты, хлориды, Ca, Mg, Na по 200–300 мг/л, а требуемый сухой остаток — ≤1000 мг/дм³?",
  "Какие технические решения организации циркуляции католита при электроэкстракции никеля описаны в мировой практике, и какая скорость потока считается оптимальной?",
  "Покажите все эксперименты и публикации по распределению Au, Ag и МПГ между медным/никелевым штейном и шлаком за последние 5 лет.",
  "Какие способы закачки шахтных вод в глубокие горизонты применялись в России и за рубежом, и каковы их технико-экономические показатели?",
];

const initialLoginForm: LoginFormState = {
  email: "",
  password: "",
  rememberMe: true,
};

const initialRegisterForm: RegisterFormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  roleName: roleOptions[0]?.value ?? "",
};

function readStorageFlag(key: string, expectedValue: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.localStorage.getItem(key) === expectedValue;
}

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthUser;
  } catch {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

function persistUser(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function normalizePath(pathname: string): AppRoute {
  if (pathname === "/auth" || pathname === "/access-denied") {
    return pathname;
  }

  return "/";
}

function navigate(path: AppRoute) {
  const nextPath = normalizePath(path);
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, "", nextPath);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getFieldErrors(errors?: ValidationErrors, fieldName?: string) {
  if (!errors || !fieldName) {
    return [];
  }

  return errors[fieldName] ?? [];
}

function hasFieldError(errors: ValidationErrors | undefined, fieldName: string) {
  return getFieldErrors(errors, fieldName).length > 0;
}

function getPasswordPolicyErrors(errors?: ValidationErrors) {
  if (!errors) {
    return [];
  }

  return Object.entries(errors)
    .filter(([key]) => key.startsWith("Password") && key !== "Password")
    .flatMap(([, messages]) => messages);
}

function getRegisterValidationErrors(form: RegisterFormState): ValidationErrors {
  const errors: ValidationErrors = {};
  const password = form.password.trim();
  const confirmPassword = form.confirmPassword.trim();

  if (!form.lastName.trim()) {
    errors.LastName = ["Укажите фамилию."];
  }

  if (!form.firstName.trim()) {
    errors.FirstName = ["Укажите имя."];
  }

  if (!form.email.trim()) {
    errors.Email = ["Укажите электронную почту."];
  }

  if (!form.roleName.trim()) {
    errors.RoleName = ["Выберите роль."];
  }

  if (!password) {
    errors.Password = ["Укажите пароль."];
  }

  if (!confirmPassword) {
    errors.ConfirmPassword = ["Подтвердите пароль."];
  }

  if (password && confirmPassword && password !== confirmPassword) {
    errors.ConfirmPassword = ["Пароли не совпадают."];
  }

  if (password && !isPasswordAllowed(password)) {
    errors.PasswordPolicy = ["Пароль должен содержать минимум 6 символов, заглавную букву, строчную букву и цифру."];
  }

  return errors;
}

function hasValidationErrors(errors: ValidationErrors) {
  return Object.values(errors).some((messages) => messages.length > 0);
}

function isPasswordAllowed(password: string) {
  return password.length >= 6 && /[A-ZА-ЯЁ]/.test(password) && /[a-zа-яё]/.test(password) && /\d/.test(password);
}

function getTextFieldClassName(hasError: boolean) {
  return `text-field ${hasError ? "text-field-error" : ""}`;
}

function shouldShowErrorBanner(errorState: AppErrorState | null) {
  if (!errorState) {
    return false;
  }

  return errorState.message.trim().length > 0 && errorState.message !== "One or more validation errors occurred.";
}

function getInitials(user: AuthUser) {
  const firstLetter = user.firstName.trim()[0] ?? "";
  const lastLetter = user.lastName.trim()[0] ?? "";
  return `${firstLetter}${lastLetter}`.toUpperCase();
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

function Icon({ name }: { name: IconName }) {
  return (
    <span className="ui-icon" aria-hidden="true">
      {name === "menu" ? (
        <svg viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      ) : null}
      {name === "spark" ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
        </svg>
      ) : null}
      {name === "search" ? (
        <svg viewBox="0 0 24 24">
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
        </svg>
      ) : null}
      {name === "library" ? (
        <svg viewBox="0 0 24 24">
          <path d="M5 5h4v14H5zM10 5h4v14h-4zM15 5h4v14h-4z" />
        </svg>
      ) : null}
      {name === "projects" ? (
        <svg viewBox="0 0 24 24">
          <path d="M4 7h7v5H4zM13 7h7v10h-7zM4 14h7v3H4z" />
        </svg>
      ) : null}
      {name === "scheduled" ? (
        <svg viewBox="0 0 24 24">
          <path d="M7 4v3M17 4v3M5 8h14M6 6h12a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM9 13l2 2 4-4" />
        </svg>
      ) : null}
      {name === "apps" ? (
        <svg viewBox="0 0 24 24">
          <path d="M7 7h4v4H7zM13 7h4v4h-4zM7 13h4v4H7zM13 13h4v4h-4z" />
        </svg>
      ) : null}
      {name === "more" ? (
        <svg viewBox="0 0 24 24">
          <path d="M6 12h.01M12 12h.01M18 12h.01" />
        </svg>
      ) : null}
      {name === "panel" ? (
        <svg viewBox="0 0 24 24">
          <path d="M4 5h16v14H4zM9 5v14" />
        </svg>
      ) : null}
      {name === "chat" ? (
        <svg viewBox="0 0 24 24">
          <path d="M6 7h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H10l-4 3v-3H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
        </svg>
      ) : null}
      {name === "menuDots" ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 6h.01M12 12h.01M12 18h.01" />
        </svg>
      ) : null}
      {name === "profile" ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0" />
        </svg>
      ) : null}
      {name === "chevron" ? (
        <svg viewBox="0 0 24 24">
          <path d="M9 6l6 6-6 6" />
        </svg>
      ) : null}
      {name === "close" ? (
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      ) : null}
      {name === "send" ? (
        <svg viewBox="0 0 24 24">
          <path d="M4 12l16-8-5 16-3-7-8-1z" />
        </svg>
      ) : null}
      {name === "logout" ? (
        <svg viewBox="0 0 24 24">
          <path d="M10 17l5-5-5-5M15 12H4M20 4v16" />
        </svg>
      ) : null}
      {name === "expand" ? (
        <svg viewBox="0 0 24 24">
          <path d="M8 4H4v4M4 4l6 6M16 4h4v4M20 4l-6 6M8 20H4v-4M4 20l6-6M16 20h4v-4M20 20l-6-6" />
        </svg>
      ) : null}
      {name === "plus" ? (
        <svg viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ) : null}
      {name === "minus" ? (
        <svg viewBox="0 0 24 24">
          <path d="M5 12h14" />
        </svg>
      ) : null}
    </span>
  );
}

type IconName =
  | "spark"
  | "search"
  | "library"
  | "projects"
  | "scheduled"
  | "apps"
  | "more"
  | "panel"
  | "chat"
  | "menu"
  | "menuDots"
  | "profile"
  | "chevron"
  | "close"
  | "send"
  | "logout"
  | "expand"
  | "plus"
  | "minus";

const nodeTypeColors: Record<KnowledgeGraphNode["type"], string> = {
  Material: "#2dd4bf",
  Process: "#60a5fa",
  Equipment: "#f59e0b",
  Property: "#a78bfa",
  Experiment: "#fb7185",
  Publication: "#34d399",
  Expert: "#f472b6",
  Facility: "#facc15",
};

function getNodeColor(type: KnowledgeGraphNode["type"]) {
  return nodeTypeColors[type] ?? "#d1d5db";
}

function KnowledgeGraphCanvas({
  graph,
  fullscreen = false,
}: {
  graph: ChatKnowledgeContext["graph"];
  fullscreen?: boolean;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const activeNode = graph.nodes.find((node) => node.id === (hoveredNodeId ?? selectedNodeId));
  const canPan = fullscreen;

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    if (!fullscreen) {
      return;
    }

    event.preventDefault();
    setScale((value) => Math.min(2.4, Math.max(0.65, value + (event.deltaY < 0 ? 0.12 : -0.12))));
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!canPan || !(event.target instanceof Element) || !event.target.classList.contains("graph-background")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    setOffset({
      x: dragStart.offsetX + (event.clientX - dragStart.x) / scale,
      y: dragStart.offsetY + (event.clientY - dragStart.y) / scale,
    });
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragStart?.pointerId === event.pointerId) {
      setDragStart(null);
    }
  }

  function zoomBy(delta: number) {
    setScale((value) => Math.min(2.4, Math.max(0.65, value + delta)));
  }

  return (
    <div className={`knowledge-graph ${fullscreen ? "knowledge-graph-full" : "knowledge-graph-preview"}`}>
      {fullscreen ? (
        <div className="graph-toolbar" aria-label="Graph controls">
          <button aria-label="Zoom in" className="graph-icon-button" type="button" onClick={() => zoomBy(0.15)}>
            <Icon name="plus" />
          </button>
          <button aria-label="Zoom out" className="graph-icon-button" type="button" onClick={() => zoomBy(-0.15)}>
            <Icon name="minus" />
          </button>
        </div>
      ) : null}
      <svg
        aria-label="Knowledge graph"
        className={canPan ? "graph-canvas graph-canvas-pannable" : "graph-canvas"}
        role="img"
        viewBox="0 0 840 472.5"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <rect className="graph-background" height="472.5" width="840" x="0" y="0" />
        <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
          {graph.edges.map((edge) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) {
              return null;
            }

            const isActive = hoveredNodeId === source.id || hoveredNodeId === target.id || selectedNodeId === source.id || selectedNodeId === target.id;

            return (
              <g key={edge.id} className={`graph-edge ${isActive ? "is-active" : ""}`}>
                <line x1={source.x} x2={target.x} y1={source.y} y2={target.y} />
                <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 6}>
                  {edge.label}
                </text>
              </g>
            );
          })}

          {graph.nodes.map((node) => {
            const color = getNodeColor(node.type);
            const isActive = hoveredNodeId === node.id || selectedNodeId === node.id;

            return (
              <g
                key={node.id}
                className={`graph-node ${isActive ? "is-active" : ""}`}
                style={{ "--node-color": color } as CSSProperties}
                tabIndex={0}
                transform={`translate(${node.x} ${node.y})`}
                onBlur={() => setHoveredNodeId(null)}
                onClick={() => setSelectedNodeId(node.id)}
                onFocus={() => setHoveredNodeId(node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <circle r={fullscreen ? 31 : 27} />
                <text dy="4">{node.label}</text>
              </g>
            );
          })}
        </g>
      </svg>

      {activeNode ? (
        <div className="graph-tooltip" style={{ borderColor: getNodeColor(activeNode.type) }}>
          <strong>{activeNode.label}</strong>
          <span>{activeNode.canonicalName}</span>
        </div>
      ) : null}
    </div>
  );
}

function ContextPanelContent({
  context,
  onOpenGraph,
  hoveredDocId,
  onDocumentHover,
  onDocumentLeave,
}: {
  context: ChatKnowledgeContext;
  onOpenGraph: () => void;
  hoveredDocId: string | null;
  onDocumentHover: (docId: string) => void;
  onDocumentLeave: () => void;
}) {
  return (
    <>
      <section className="graph-preview-section" aria-label="Превью графа знаний">
        <div className="graph-preview-header">
          <h3>Граф знаний</h3>
          <button aria-label="Открыть на весь экран" className="graph-icon-button" title="Открыть на весь экран" type="button" onClick={onOpenGraph}>
            <Icon name="expand" />
          </button>
        </div>
        <KnowledgeGraphCanvas graph={context.graph} />
      </section>

      <section className="document-section" aria-label="Документы-источники">
        <div className="document-section-header">
          <h3>Документы-источники</h3>
          <span>{context.documents.length}</span>
        </div>
        <div className="document-list">
          {context.documents.map((document) => (
            <button
              key={document.id}
              id={`source-${document.id}`}
              className={`document-item ${hoveredDocId === document.id ? "source-hovered" : ""}`}
              type="button"
              onMouseEnter={() => onDocumentHover(document.id)}
              onMouseLeave={onDocumentLeave}
            >
              <span className="document-title">{document.title}</span>
              <span className="document-meta">
                {document.section} · стр. {document.page} · {Math.round(document.confidence * 100)}% · {document.year}
              </span>
              <span className="document-snippet">{document.snippet}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function KnowledgeGraphModal({
  context,
  onClose,
}: {
  context: ChatKnowledgeContext;
  onClose: () => void;
}) {
  return (
    <div className="graph-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="graph-modal" aria-label="Граф знаний на весь экран" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="graph-modal-header">
          <div>
            <h2>Граф знаний</h2>
            <p>{context.representedNodeIds.length} узлов из metadata ответа LLM</p>
          </div>
          <button aria-label="Закрыть граф" className="context-close" type="button" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <KnowledgeGraphCanvas fullscreen graph={context.graph} />
      </section>
    </div>
  );
}

function AuthScreen({
  authMode,
  onModeChange,
  onLoginSuccess,
  onRegisterSuccess,
}: {
  authMode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onLoginSuccess: (user: AuthUser) => void;
  onRegisterSuccess: (user: AuthUser) => void;
}) {
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [viewState, setViewState] = useState<AuthViewState>("idle");
  const [errorState, setErrorState] = useState<AppErrorState | null>(null);
  const [emailAvailabilityMessage, setEmailAvailabilityMessage] = useState<string | null>(null);

  function clearErrors() {
    setErrorState(null);
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setViewState("loading");
    clearErrors();

    try {
      const user = await login(loginForm);
      onLoginSuccess(user);
    } catch (error) {
      setErrorState(extractAppError(error));
    } finally {
      setViewState("idle");
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearErrors();

    const validationErrors = getRegisterValidationErrors(registerForm);
    if (hasValidationErrors(validationErrors)) {
      setErrorState({ message: "", fieldErrors: validationErrors });
      return;
    }

    setViewState("loading");

    try {
      const user = await register(registerForm);
      onRegisterSuccess(user);
    } catch (error) {
      setErrorState(extractAppError(error));
    } finally {
      setViewState("idle");
    }
  }

  async function handleEmailBlur() {
    const email = registerForm.email.trim();
    if (!email) {
      setEmailAvailabilityMessage(null);
      return;
    }

    try {
      const isAvailable = await checkEmailAvailability(email);
      setEmailAvailabilityMessage(isAvailable ? null : "Этот email уже зарегистрирован.");
    } catch {
      setEmailAvailabilityMessage(null);
    }
  }

  const isBusy = viewState === "loading";
  const fieldErrors = errorState?.fieldErrors;
  const passwordPolicyErrors = getPasswordPolicyErrors(fieldErrors);
  const hasPasswordError = hasFieldError(fieldErrors, "Password") || passwordPolicyErrors.length > 0;
  const hasConfirmPasswordError = hasFieldError(fieldErrors, "ConfirmPassword") || passwordPolicyErrors.length > 0;

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-card-header">
          <p className="auth-eyebrow">Scientific Tangle</p>
          <h1>{authMode === "login" ? "Авторизация" : "Регистрация"}</h1>
          <p className="auth-subtitle">
            {authMode === "login"
              ? "Войдите, чтобы открыть исследовательский чат и материалы проекта."
              : "Создайте учетную запись сотрудника для доступа к системе."}
          </p>
        </div>

        <div className="auth-switch">
          <button
            className={`auth-switch-button ${authMode === "login" ? "is-active" : ""}`}
            type="button"
            onClick={() => {
              clearErrors();
              onModeChange("login");
            }}
          >
            Вход
          </button>
          <button
            className={`auth-switch-button ${authMode === "register" ? "is-active" : ""}`}
            type="button"
            onClick={() => {
              clearErrors();
              onModeChange("register");
            }}
          >
            Регистрация
          </button>
        </div>

        {shouldShowErrorBanner(errorState) ? <div className="form-error-banner">{errorState?.message}</div> : null}

        {authMode === "login" ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label className="field">
              <span>Электронная почта</span>
              <input
                autoComplete="email"
                className={getTextFieldClassName(hasFieldError(fieldErrors, "Email"))}
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((value) => ({ ...value, email: event.target.value }))}
              />
              {getFieldErrors(errorState?.fieldErrors, "Email").map((message) => (
                <small key={message} className="field-error">
                  {message}
                </small>
              ))}
            </label>

            <label className="field">
              <span>Пароль</span>
              <input
                autoComplete="current-password"
                className={getTextFieldClassName(hasFieldError(fieldErrors, "Password"))}
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((value) => ({ ...value, password: event.target.value }))}
              />
              {getFieldErrors(errorState?.fieldErrors, "Password").map((message) => (
                <small key={message} className="field-error">
                  {message}
                </small>
              ))}
            </label>

            <label className="checkbox-field">
              <input
                checked={loginForm.rememberMe}
                type="checkbox"
                onChange={(event) => setLoginForm((value) => ({ ...value, rememberMe: event.target.checked }))}
              />
              <span>Запомнить меня на 30 дней</span>
            </label>

            <button className="auth-submit" disabled={isBusy} type="submit">
              {isBusy ? "Входим..." : "Войти"}
            </button>

            <p className="auth-footer">
              Нет аккаунта?{" "}
              <button className="auth-inline-button" type="button" onClick={() => onModeChange("register")}>
                Регистрация
              </button>
            </p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <label className="field">
              <span>Фамилия</span>
              <input
                autoComplete="family-name"
                className={getTextFieldClassName(hasFieldError(fieldErrors, "LastName"))}
                maxLength={100}
                value={registerForm.lastName}
                onChange={(event) => setRegisterForm((value) => ({ ...value, lastName: event.target.value }))}
              />
              {getFieldErrors(errorState?.fieldErrors, "LastName").map((message) => (
                <small key={message} className="field-error">
                  {message}
                </small>
              ))}
            </label>

            <label className="field">
              <span>Имя</span>
              <input
                autoComplete="given-name"
                className={getTextFieldClassName(hasFieldError(fieldErrors, "FirstName"))}
                maxLength={100}
                value={registerForm.firstName}
                onChange={(event) => setRegisterForm((value) => ({ ...value, firstName: event.target.value }))}
              />
              {getFieldErrors(errorState?.fieldErrors, "FirstName").map((message) => (
                <small key={message} className="field-error">
                  {message}
                </small>
              ))}
            </label>

            <label className="field">
              <span>Электронная почта</span>
              <input
                autoComplete="email"
                className={getTextFieldClassName(hasFieldError(fieldErrors, "Email") || Boolean(emailAvailabilityMessage))}
                type="email"
                value={registerForm.email}
                onBlur={handleEmailBlur}
                onChange={(event) => {
                  setEmailAvailabilityMessage(null);
                  setRegisterForm((value) => ({ ...value, email: event.target.value }));
                }}
              />
              {emailAvailabilityMessage ? <small className="field-error">{emailAvailabilityMessage}</small> : null}
              {getFieldErrors(errorState?.fieldErrors, "Email").map((message) => (
                <small key={message} className="field-error">
                  {message}
                </small>
              ))}
            </label>

            <label className="field">
              <span>Роль</span>
              <select
                className={`${getTextFieldClassName(hasFieldError(fieldErrors, "RoleName"))} role-select`}
                value={registerForm.roleName}
                onChange={(event) => setRegisterForm((value) => ({ ...value, roleName: event.target.value }))}
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {getFieldErrors(errorState?.fieldErrors, "RoleName").map((message) => (
                <small key={message} className="field-error">
                  {message}
                </small>
              ))}
            </label>

            <label className="field">
              <span>Пароль</span>
              <input
                autoComplete="new-password"
                className={getTextFieldClassName(hasPasswordError)}
                type="password"
                value={registerForm.password}
                onChange={(event) => setRegisterForm((value) => ({ ...value, password: event.target.value }))}
              />
              <small className="field-hint">Минимум 6 символов, заглавная буква, строчная буква и цифра.</small>
              {getFieldErrors(errorState?.fieldErrors, "Password").map((message) => (
                <small key={message} className="field-error">
                  {message}
                </small>
              ))}
              {passwordPolicyErrors.map((message) => (
                <small key={message} className="field-error">
                  {message}
                </small>
              ))}
            </label>

            <label className="field">
              <span>Подтверждение пароля</span>
              <input
                autoComplete="new-password"
                className={getTextFieldClassName(hasConfirmPasswordError)}
                type="password"
                value={registerForm.confirmPassword}
                onChange={(event) =>
                  setRegisterForm((value) => ({ ...value, confirmPassword: event.target.value }))
                }
              />
              {getFieldErrors(errorState?.fieldErrors, "ConfirmPassword").map((message) => (
                <small key={message} className="field-error">
                  {message}
                </small>
              ))}
            </label>

            <button className="auth-submit" disabled={isBusy} type="submit">
              {isBusy ? "Регистрируем..." : "Зарегистрироваться"}
            </button>

            <p className="auth-footer">
              Уже есть аккаунт?{" "}
              <button className="auth-inline-button" type="button" onClick={() => onModeChange("login")}>
                Войти
              </button>
            </p>
          </form>
        )}
      </section>
    </div>
  );
}

function AccessDeniedScreen() {
  return (
    <div className="auth-page">
      <section className="auth-card auth-card-compact">
        <p className="auth-eyebrow">Scientific Tangle</p>
        <h1>Доступ запрещен</h1>
        <p className="auth-subtitle">
          У вашей учетной записи нет прав для просмотра этого раздела.
        </p>
        <button className="auth-submit" type="button" onClick={() => navigate("/")}>
          Вернуться в приложение
        </button>
      </section>
    </div>
  );
}

function MarkdownRenderer({
  text,
  getCitationDocId,
  onCitationClick,
  onCitationHover,
  onCitationLeave,
  hoveredCitationNum,
}: {
  text: string;
  getCitationDocId: (num: number) => string;
  onCitationClick: (docId: string) => void;
  onCitationHover: (docId: string, citationNum: number) => void;
  onCitationLeave: () => void;
  hoveredCitationNum: number | null;
}) {
  if (!text) return null;

  function renderBold(text: string) {
    const parts: ReactNode[] = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push(<strong key={key++}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }

  function renderInline(segment: string) {
    const parts: ReactNode[] = [];
    const citationRegex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = citationRegex.exec(segment)) !== null) {
      const num = parseInt(match[1], 10);
      const docId = getCitationDocId(num);
      const isHovered = num === hoveredCitationNum;

      if (match.index > lastIndex) {
        const textBefore = segment.slice(lastIndex, match.index);
        if (textBefore.trim()) {
          parts.push(
            <a
              key={key++}
              href="#"
              className={`citation-text-link ${isHovered ? "is-hovered" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                if (docId) onCitationClick(docId);
              }}
              onMouseEnter={() => onCitationHover(docId, num)}
              onMouseLeave={onCitationLeave}
            >
              {renderBold(textBefore)}
            </a>
          );
        }
      }

      parts.push(
        <a
          key={key++}
          href="#"
          className={`citation-link ${isHovered ? "is-hovered" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            if (docId) onCitationClick(docId);
          }}
          onMouseEnter={() => onCitationHover(docId, num)}
          onMouseLeave={onCitationLeave}
        >
          [{num}]
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < segment.length) {
      parts.push(renderBold(segment.slice(lastIndex)));
    }

    return parts.length > 0 ? parts : segment;
  }

  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="markdown-content">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (/^[-*]\s/.test(trimmed)) {
          const items = trimmed.split(/\n/).filter((line) => /^[-*]\s/.test(line));
          return (
            <ul key={i} style={{ margin: "0.25rem 0", paddingLeft: "1.25rem" }}>
              {items.map((item, j) => (
                <li key={j}>{renderInline(item.replace(/^[-*]\s/, ""))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();
  const [route, setRoute] = useState<AppRoute>(() => normalizePath(window.location.pathname));
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());
  const [sidebarExpanded, setSidebarExpanded] = useState(() =>
    readStorageFlag(SIDEBAR_STORAGE_KEY, "expanded", true),
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(() => readStorageFlag(CONTEXT_STORAGE_KEY, "open", false));
  const [activeNav, setActiveNav] = useState("new");
  const [activeChatId, setActiveChatId] = useState(seededDemoChatId);
  const [recentChatItems, setRecentChatItems] = useState<ChatItem[]>(initialRecentChats);
  const [chatMessagesById, setChatMessagesById] = useState<Record<string, Message[]>>(initialChatMessagesById);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [graphFullscreenOpen, setGraphFullscreenOpen] = useState(false);
  const [chatKnowledgeContexts, setChatKnowledgeContexts] = useState<Record<string, ChatKnowledgeContext>>({});
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);
  const [hoveredCitationNum, setHoveredCitationNum] = useState<number | null>(null);

  useEffect(() => {
    function handleRouteChange() {
      setRoute(normalizePath(window.location.pathname));
    }

    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarExpanded ? "expanded" : "collapsed");
  }, [sidebarExpanded]);

  useEffect(() => {
    window.localStorage.setItem(CONTEXT_STORAGE_KEY, contextOpen ? "open" : "closed");
  }, [contextOpen]);

  useEffect(() => {
    persistUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!currentUser) {
      if (route !== "/auth") {
        navigate("/auth");
      }
      return;
    }

    if (route === "/auth") {
      navigate("/");
      return;
    }

  }, [currentUser, route]);

  function createLocalChatTitle(messageText: string) {
    const normalized = messageText.replace(/\s+/g, " ").trim();
    return normalized.length > 54 ? `${normalized.slice(0, 54)}...` : normalized;
  }

  function createMockAssistantAnswer(messageText: string) {
    return `Принял запрос: «${messageText}». Для демо я подготовлю краткий ответ и могу продолжить анализ по этой теме.`;
  }

  function handleAuthSuccess(user: AuthUser) {
    setCurrentUser(user);
    navigate("/");
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setCurrentUser(null);
      setIsLoggingOut(false);
      navigate("/auth");
    }
  }

  function handleCitationHover(docId: string, citationNum: number) {
    setHoveredDocId(docId);
    setHoveredCitationNum(citationNum);
  }

  function handleCitationLeave() {
    setHoveredDocId(null);
    setHoveredCitationNum(null);
  }

  function handleDocumentHover(docId: string) {
    setHoveredDocId(docId);
    const citationNums = llmSearchResponse.citations.filter((c) => c.doc_id === docId).map((c) => c.id);
    if (citationNums.length > 0) {
      setHoveredCitationNum(citationNums[0]);
    }
  }

  function handleDocumentLeave() {
    setHoveredDocId(null);
    setHoveredCitationNum(null);
  }

  function handleCitationClick(docId: string) {
    setContextOpen(true);
    setTimeout(() => {
      const el = document.getElementById(`source-${docId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  }

  function handleToggleSidebar() {
    if (isMobile) {
      setMobileSidebarOpen((value) => !value);
      return;
    }

    setSidebarExpanded((value) => !value);
  }

  function handleSelectNav(itemId: string) {
    setActiveNav(itemId);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  }

  function handleSelectChat(chatId: string) {
    setActiveNav("chat");
    setActiveChatId(chatId);
    setChatKnowledgeContexts((value) => ({
      ...value,
      [chatId]: value[chatId] ?? buildKnowledgeContextFromLlmResponse(llmSearchResponse),
    }));
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  }

  function handlePromptSubmit(text: string) {
    const now = Date.now();
    const targetChatId = `local-${now}`;
    const userMessage: Message = {
      id: `${targetChatId}-user-${now}`,
      role: "user",
      text,
    };
    const assistantMessage: Message = {
      id: `${targetChatId}-assistant-${now}`,
      role: "assistant",
      text: createMockAssistantAnswer(text),
    };
    const newChat: ChatItem = {
      id: targetChatId,
      title: createLocalChatTitle(text),
    };
    setRecentChatItems((items) => [newChat, ...items]);
    setChatMessagesById((messagesById) => ({
      ...messagesById,
      [targetChatId]: [userMessage, assistantMessage],
    }));
    setActiveChatId(targetChatId);
    setActiveNav("chat");
  }

  function handleSubmitMessage() {
    const messageText = draft.trim();
    if (!messageText) {
      return;
    }

    const now = Date.now();
    const targetChatId = activeNav === "chat" ? activeChatId : `local-${now}`;
    const userMessage: Message = {
      id: `${targetChatId}-user-${now}`,
      role: "user",
      text: messageText,
    };
    const assistantMessage: Message = {
      id: `${targetChatId}-assistant-${now}`,
      role: "assistant",
      text: createMockAssistantAnswer(messageText),
    };

    if (activeNav !== "chat") {
      const newChat: ChatItem = {
        id: targetChatId,
        title: createLocalChatTitle(messageText),
      };
      setRecentChatItems((items) => [newChat, ...items]);
    }

    setChatMessagesById((messagesById) => ({
      ...messagesById,
      [targetChatId]: [...(messagesById[targetChatId] ?? []), userMessage, assistantMessage],
    }));
    setActiveChatId(targetChatId);
    setActiveNav("chat");
    setDraft("");
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleSubmitMessage();
  }

  function handleTouchStart(clientX: number) {
    if (isMobile) {
      setTouchStartX(clientX);
    }
  }

  function handleTouchEnd(clientX: number) {
    if (!isMobile || touchStartX === null) {
      return;
    }

    if (touchStartX - clientX > 60) {
      setMobileSidebarOpen(false);
    }

    setTouchStartX(null);
  }

  const sidebarClassName = [
    "sidebar",
    sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed",
    isMobile ? "sidebar-mobile" : "sidebar-desktop",
    isMobile ? (mobileSidebarOpen ? "sidebar-mobile-open" : "sidebar-mobile-closed") : "",
  ]
    .filter(Boolean)
    .join(" ");

  const allChats = [...pinnedChats, ...recentChatItems];
  const activeChat = allChats.find((chat) => chat.id === activeChatId) ?? recentChatItems[0];
  const isNewChat = activeNav === "new";
  const isSearchChats = activeNav === "search";
  const canSend = draft.trim().length > 0;
  const activeMessages = activeNav === "chat" ? (chatMessagesById[activeChatId] ?? []) : [];
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearchQuery
    ? allChats.filter((chat) => chat.title.toLowerCase().includes(normalizedSearchQuery))
    : allChats;
  const profileLabel = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "User";
  const activeKnowledgeContext = chatKnowledgeContexts[activeChatId];
  const welcomeTitle = useMemo(() => {
    if (isSearchChats) {
      return "Поиск чатов";
    }

    if (isNewChat) {
      return "Новый чат";
    }

    return activeChat.title;
  }, [activeChat.title, isNewChat, isSearchChats]);

  if (route === "/auth") {
    return (
      <AuthScreen
        authMode={authMode}
        onLoginSuccess={handleAuthSuccess}
        onModeChange={setAuthMode}
        onRegisterSuccess={handleAuthSuccess}
      />
    );
  }

  if (route === "/access-denied") {
    return <AccessDeniedScreen />;
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="app-shell">
      {isMobile && mobileSidebarOpen ? (
        <button
          aria-label="Закрыть боковую панель"
          className="sidebar-overlay"
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={sidebarClassName}
          aria-label="Навигация и история чатов"
        onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
        onTouchStart={(event) => handleTouchStart(event.changedTouches[0]?.clientX ?? 0)}
      >
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <button
              aria-label={isMobile ? "Закрыть меню" : sidebarExpanded ? "Свернуть боковую панель" : "Развернуть боковую панель"}
              className="sidebar-toggle"
              type="button"
              onClick={handleToggleSidebar}
            >
              <Icon name="menu" />
            </button>

            {sidebarExpanded ? (
              <div className="sidebar-brand-text">
                <strong>Scientific Tangle</strong>
                <span>Исследовательская среда</span>
              </div>
            ) : null}
          </div>

          <nav className="sidebar-nav" aria-label="Primary navigation">
            {navItems.map((item) => {
              const isActive = activeNav === item.id;

              return (
                <button
                  key={item.id}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={!sidebarExpanded ? item.label : undefined}
                  className={["nav-item", isActive ? "is-active" : "", item.disabled ? "is-disabled" : ""].join(" ")}
                  disabled={item.disabled}
                  title={!sidebarExpanded ? item.label : undefined}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                >
                  <Icon name={item.icon} />
                  {sidebarExpanded ? <span className="nav-item-label">{item.label}</span> : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-scroll">
          <section className="chat-group" aria-labelledby="pinned-chats-heading">
            {sidebarExpanded ? (
              <h2 className="chat-group-title" id="pinned-chats-heading">
                Закреплённые
              </h2>
            ) : null}
            <div className="chat-list" role="list">
              {pinnedChats.map((chat) => {
                const isActive = activeChatId === chat.id;

                return (
                  <button
                    key={chat.id}
                    aria-label={!sidebarExpanded ? chat.title : undefined}
                    aria-pressed={isActive}
                    className={`chat-list-item ${isActive ? "is-active" : ""}`}
                    title={chat.title}
                    type="button"
                    onClick={() => handleSelectChat(chat.id)}
                  >
                    <Icon name="chat" />
                    {sidebarExpanded ? <span className="chat-list-label">{chat.title}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="chat-group" aria-labelledby="recent-chats-heading">
            {sidebarExpanded ? (
              <h2 className="chat-group-title" id="recent-chats-heading">
                Недавние
              </h2>
            ) : null}
            <div className="chat-list" role="list">
              {recentChatItems.map((chat) => {
                const isActive = activeChatId === chat.id;

                return (
                  <button
                    key={chat.id}
                    aria-label={!sidebarExpanded ? chat.title : undefined}
                    aria-pressed={isActive}
                    className={`chat-list-item ${isActive ? "is-active" : ""}`}
                    title={chat.title}
                    type="button"
                    onClick={() => handleSelectChat(chat.id)}
                  >
                    <Icon name="chat" />
                    {sidebarExpanded ? <span className="chat-list-label">{chat.title}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="sidebar-profile">
          <div className="profile-menu">
            <button
              aria-label={!sidebarExpanded ? profileLabel : undefined}
              className="profile-button"
              title={!sidebarExpanded ? profileLabel : undefined}
              type="button"
            >
              <span className="profile-avatar profile-avatar-text">{getInitials(currentUser)}</span>
              {sidebarExpanded ? (
                <>
                  <span className="profile-meta">
                    <strong>{profileLabel}</strong>
                    <span>{currentUser.roleDisplayName}</span>
                  </span>
                  <span className="profile-more">
                    <Icon name="menuDots" />
                  </span>
                </>
              ) : null}
            </button>

            <div className="profile-menu-popover">
              <button className="profile-menu-action" disabled={isLoggingOut} type="button" onClick={handleLogout}>
                <Icon name="logout" />
                <span>{isLoggingOut ? "Выходим..." : "Разлогиниться"}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className={`main-panel ${contextOpen ? "main-panel-with-context" : ""}`}>
        <header className="main-header">
          <div className="main-header-left">
            {isMobile ? (
              <button
                aria-label="Открыть меню"
                className="mobile-menu-button"
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Icon name="panel" />
              </button>
            ) : null}

            <div>
              <p className="main-header-kicker">Рабочая область</p>
              <h1>{welcomeTitle}</h1>
            </div>
          </div>

          {!contextOpen ? (
            <button
              className="context-button"
              type="button"
              onClick={() => setContextOpen(true)}
            >
              Контекст
            </button>
          ) : null}
        </header>

        <section className="workspace">
          <div className="conversation-panel" aria-label="Диалог">
            <div className="message-list">
              {isSearchChats ? (
                <section className="search-chat-view" aria-label="Поиск чатов">
                  <div className="search-chat-panel">
                    <div className="search-chat-heading">
                      <h2>Поиск чатов</h2>
                      <p>Найдите предыдущий диалог по названию.</p>
                    </div>
                    <label className="search-chat-field">
                      <Icon name="search" />
                      <input
                        aria-label="Поиск чатов"
                        placeholder="Поиск чатов..."
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                      />
                    </label>
                    <div className="search-chat-results" role="list">
                      {searchResults.length > 0 ? (
                        searchResults.map((chat) => (
                          <button
                            key={chat.id}
                            className="search-chat-result"
                            type="button"
                            onClick={() => handleSelectChat(chat.id)}
                          >
                            <Icon name="chat" />
                            <span>{chat.title}</span>
                          </button>
                        ))
                      ) : (
                        <p className="search-chat-empty">Чаты не найдены</p>
                      )}
                    </div>
                  </div>
                </section>
              ) : isNewChat ? (
                <section className="empty-chat" aria-label="Подсказки для нового чата">
                  <div className="empty-chat-mark">
                    <Icon name="spark" />
                  </div>
                  <h2>Чем могу помочь?</h2>
                  <div className="prompt-grid">
                    {promptSuggestions.map((suggestion) => (
                      <button key={suggestion} className="prompt-card" type="button" onClick={() => handlePromptSubmit(suggestion)}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </section>
              ) : activeMessages.length > 0 ? (
                activeMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`message-row ${message.role === "user" ? "message-row-user" : "message-row-assistant"}`}
                  >
                    <div className={`message-bubble message-bubble-${message.role}`}>
                      {message.role === "assistant" ? (
                        <MarkdownRenderer
                          text={message.text}
                          getCitationDocId={(num) => llmSearchResponse.citations.find((c) => c.id === num)?.doc_id ?? ""}
                          onCitationClick={handleCitationClick}
                          onCitationHover={handleCitationHover}
                          onCitationLeave={handleCitationLeave}
                          hoveredCitationNum={hoveredCitationNum}
                        />
                      ) : (
                        <p>{message.text}</p>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <section className="selected-chat-start" aria-label="Выбранный чат">
                  <div className="selected-chat-mark">
                    <Icon name="chat" />
                  </div>
                  <h2>{activeChat.title}</h2>
                  <p>Продолжите диалог или задайте уточнение по этой теме.</p>
                </section>
              )}
            </div>

            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmitMessage();
              }}
            >
              <textarea
                aria-label="Message input"
                className="composer-input"
                placeholder="Введите сообщение"
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
              />
              <button aria-label="Отправить сообщение" className="composer-submit" disabled={!canSend} type="submit">
                <Icon name="send" />
              </button>
            </form>
          </div>
        </section>

        <aside className="context-panel" aria-label="Панель контекста">
          <div className="context-panel-header">
            <h2>Материалы</h2>
            <button
              aria-label="Закрыть панель контекста"
              className="context-close"
              type="button"
              onClick={() => setContextOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="context-panel-body">
            {activeKnowledgeContext ? (
              <ContextPanelContent context={activeKnowledgeContext} onOpenGraph={() => setGraphFullscreenOpen(true)} hoveredDocId={hoveredDocId} onDocumentHover={handleDocumentHover} onDocumentLeave={handleDocumentLeave} />
            ) : (
              <section className="context-empty-state">
                <h3>Граф знаний не загружен</h3>
                <p>Выберите чат в истории, чтобы загрузить mock-ответ LLM вместе с metadata для графа знаний.</p>
              </section>
            )}
          </div>
        </aside>
      </main>

      {graphFullscreenOpen && activeKnowledgeContext ? (
        <KnowledgeGraphModal context={activeKnowledgeContext} onClose={() => setGraphFullscreenOpen(false)} />
      ) : null}
    </div>
  );
}

function extractAppError(error: unknown): AppErrorState {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      fieldErrors: error.errors ?? {},
    };
  }

  return {
    message: "Произошла ошибка. Попробуйте еще раз.",
    fieldErrors: {},
  };
}
