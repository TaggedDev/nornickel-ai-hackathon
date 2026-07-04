import cytoscape, { type Core, type StylesheetJson } from "cytoscape";
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  type AuthUser,
  checkEmailAvailability,
  login,
  logout,
  register,
  type ValidationErrors,
} from "./shared/api/auth";
import {
  addChatMessage,
  type ChatDetailsResponse,
  createChat,
  getChat,
  getChats,
  type ChatKnowledgeContextResponse,
} from "./shared/api/chats";

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
  isPending?: boolean;
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
  citationId: number;
  id: string;
  title: string;
  snippet: string;
  section: string | null;
  page: number | null;
  confidence: number;
  year: number | null;
  language: string | null;
  downloadUrl: string;
};

type ChatKnowledgeContext = {
  graph: {
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
  };
  documents: ReferencedDocument[];
  representedNodeIds: string[];
  search: ChatKnowledgeSearchMeta | null;
};

type ChatKnowledgeSearchMeta = {
  query: string;
  intent: string;
  retrievedFacts: number;
  usedFacts: number;
  model: string | null;
  noData: boolean;
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
  status?: number;
};

const USER_STORAGE_KEY = "scientific-tangle-auth-user";
const SIDEBAR_STORAGE_KEY = "scientific-tangle-sidebar-mode";
const CONTEXT_STORAGE_KEY = "scientific-tangle-context-open";
const MOBILE_BREAKPOINT = 768;
const WAITING_MESSAGE_TEXT = "Ожидаем ответ от LLM";
const ANSWER_ERROR_TEXT = "Не удалось получить ответ из базы знаний. Попробуйте повторить запрос позже.";

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

const edgeTypeLabels: Record<string, string> = {
  uses_material: "использует материал",
  operates_at_condition: "условие работы",
  produces_output: "производит результат",
  described_in: "описано в",
  validated_by: "подтверждено",
  contradicts: "противоречит",
};

function buildKnowledgeContextFromApiResponse(context: ChatKnowledgeContextResponse): ChatKnowledgeContext {
  const nodes = context.graph.nodes.map((node) => ({
      id: node.id,
      type: node.type as KnowledgeGraphNode["type"],
      label: node.label,
      canonicalName: node.canonicalName,
      aliases: node.aliases,
      properties: node.properties,
      x: 0,
      y: 0,
    }));

  return {
    graph: {
      nodes,
      edges: context.graph.edges.map((edge) => ({
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        label: edgeTypeLabels[edge.type] ?? edge.type,
        properties: edge.properties,
      })),
    },
    documents: context.documents.map((document) => ({
      citationId: document.citationId,
      id: document.id,
      title: document.title,
      snippet: document.snippet,
      section: document.section,
      page: document.page,
      confidence: document.confidence,
      year: document.year,
      language: document.language,
      downloadUrl: document.downloadUrl,
    })),
    representedNodeIds: context.representedNodeIds,
    search: context.search,
  };
}

function mapChatMessages(chat: ChatDetailsResponse): Message[] {
  return chat.messages.map((message) => ({
    id: message.id,
    role: message.sender.toLowerCase() === "user" ? "user" : "assistant",
    text: message.text,
  }));
}

function isServerChatId(chatId: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId);
}

function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const activeNode = graph.nodes.find((node) => node.id === hoveredNodeId);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      autounselectify: true,
      boxSelectionEnabled: false,
      container: containerRef.current,
      elements: [
        ...graph.nodes.map((node) => ({
          data: {
            id: node.id,
            label: node.label,
            color: getNodeColor(node.type),
          },
        })),
        ...graph.edges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label,
          },
        })),
      ],
      layout: {
        name: "cose",
        animate: false,
        edgeElasticity: 80,
        fit: true,
        gravity: 0.18,
        idealEdgeLength: fullscreen ? 180 : 150,
        nestingFactor: 1.2,
        nodeOverlap: 32,
        nodeRepulsion: 900000,
        numIter: 1200,
        padding: fullscreen ? 48 : 28,
        randomize: false,
      },
      maxZoom: 2.4,
      minZoom: 0.35,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            "background-opacity": 0.18,
            "border-color": "data(color)",
            "border-width": 2,
            color: "#f8fafc",
            "font-family": "Inter, Segoe UI, system-ui, sans-serif",
            "font-size": fullscreen ? 12 : 11,
            "font-weight": 650,
            height: fullscreen ? 64 : 56,
            label: "data(label)",
            shape: "round-rectangle",
            "text-halign": "center",
            "text-max-width": fullscreen ? "128px" : "108px",
            "text-valign": "center",
            "text-wrap": "wrap",
            width: fullscreen ? 150 : 126,
          },
        },
        {
          selector: "edge",
          style: {
            color: "rgba(236, 236, 241, 0.58)",
            "curve-style": "bezier",
            "font-family": "Inter, Segoe UI, system-ui, sans-serif",
            "font-size": 10,
            label: "data(label)",
            "line-color": "rgba(255, 255, 255, 0.28)",
            "target-arrow-color": "rgba(255, 255, 255, 0.28)",
            "target-arrow-shape": "triangle",
            "text-background-color": "#111318",
            "text-background-opacity": 0.82,
            "text-background-padding": "2px",
            "text-max-width": "104px",
            "text-rotation": "autorotate",
            "text-wrap": "wrap",
            width: 1.4,
          },
        },
        {
          selector: ".dimmed",
          style: {
            opacity: 0.3,
          },
        },
        {
          selector: ".highlighted-edge",
          style: {
            color: "rgba(236, 236, 241, 0.86)",
            "line-color": "rgba(255, 255, 255, 0.86)",
            "target-arrow-color": "rgba(255, 255, 255, 0.86)",
            width: 2.4,
          },
        },
      ] satisfies StylesheetJson,
      wheelSensitivity: 0.18,
    });

    cyRef.current = cy;

    const clearHighlights = () => {
      cy.elements().removeClass("dimmed highlighted-edge");
      setHoveredNodeId(null);
    };

    cy.on("mouseover", "node", (event) => {
      const node = event.target;
      const neighborhood = node.closedNeighborhood();
      cy.elements().not(neighborhood).addClass("dimmed");
      neighborhood.edges().addClass("highlighted-edge");
      setHoveredNodeId(node.id());
    });

    cy.on("mouseover", "edge", (event) => {
      const edge = event.target;
      const connected = edge.connectedNodes().union(edge);
      cy.elements().not(connected).addClass("dimmed");
      edge.addClass("highlighted-edge");
      setHoveredNodeId(null);
    });

    cy.on("mouseout", "node, edge", clearHighlights);

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [fullscreen, graph]);

  function zoomBy(delta: number) {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.zoom({
      level: Math.min(2.4, Math.max(0.35, cy.zoom() + delta)),
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
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
      <div ref={containerRef} aria-label="Knowledge graph" className="graph-cytoscape" />

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
      {context.search ? (
        <section className="search-meta-section" aria-label="Метаданные ответа">
          <div>
            <span>Intent</span>
            <strong>{context.search.intent}</strong>
          </div>
          <div>
            <span>Model</span>
            <strong>{context.search.model ?? "unknown"}</strong>
          </div>
          <div>
            <span>Facts</span>
            <strong>{context.search.usedFacts}/{context.search.retrievedFacts}</strong>
          </div>
          <div>
            <span>No data</span>
            <strong>{context.search.noData ? "true" : "false"}</strong>
          </div>
        </section>
      ) : null}

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

function WaitingMessage() {
  return (
    <div className="waiting-message" aria-label={WAITING_MESSAGE_TEXT}>
      <span />
      <span />
      <span />
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
  const [activeChatId, setActiveChatId] = useState("");
  const [recentChatItems, setRecentChatItems] = useState<ChatItem[]>([]);
  const [chatMessagesById, setChatMessagesById] = useState<Record<string, Message[]>>({});
  const [draft, setDraft] = useState("");
  const [isAnswering, setIsAnswering] = useState(false);
  const [chatRequestError, setChatRequestError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isCancelled = false;

    async function loadChats() {
      try {
        const response = await getChats();
        if (isCancelled) {
          return;
        }

        const chats = response.items.map((chat) => ({ id: chat.id, title: chat.title }));
        setRecentChatItems(chats);
        if (chats.length > 0 && activeNav !== "chat") {
          setActiveChatId(chats[0].id);
        }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedSession();
        return;
      }

      console.error(error);
    }
  }

    void loadChats();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);


  function handleAuthSuccess(user: AuthUser) {
    setCurrentUser(user);
    setActiveNav("new");
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

  function handleUnauthorizedSession() {
    setCurrentUser(null);
    setActiveNav("new");
    setActiveChatId("");
    setChatRequestError(null);
    setIsAnswering(false);
    navigate("/auth");
  }

  function isUnauthorizedError(error: unknown) {
    return error instanceof ApiError && error.status === 401;
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
    const citationNums = activeKnowledgeContext?.documents
      .filter((document) => document.id === docId)
      .map((document) => document.citationId) ?? [];
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

  async function handleSelectChat(chatId: string) {
    setActiveNav("chat");
    setActiveChatId(chatId);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }

    if (!isServerChatId(chatId)) {
      return;
    }

    if (chatMessagesById[chatId]) {
      return;
    }

    try {
      const chat = await getChat(chatId);
      setChatMessagesById((messagesById) => ({
        ...messagesById,
        [chat.id]: mapChatMessages(chat),
      }));
      if (chat.knowledgeContext) {
        setChatKnowledgeContexts((value) => ({
          ...value,
          [chat.id]: buildKnowledgeContextFromApiResponse(chat.knowledgeContext!),
        }));
      }
      } catch (error) {
        if (isUnauthorizedError(error)) {
          handleUnauthorizedSession();
          return;
        }

        console.error(error);
      }
    }

  async function handlePromptSubmit(text: string) {
    await submitMessage(text);
  }

  async function handleSubmitMessage() {
    await submitMessage(draft);
  }

  async function submitMessage(message: string) {
    const messageText = message.trim();
    if (!messageText || isAnswering) {
      return;
    }

    const isExistingServerChat = activeNav === "chat" && isServerChatId(activeChatId);
    const optimisticChatId = isExistingServerChat ? activeChatId : createClientId("pending-chat");
    const optimisticUserMessage: Message = {
      id: createClientId("user-message"),
      role: "user",
      text: messageText,
    };
    const optimisticAssistantMessage: Message = {
      id: createClientId("assistant-message"),
      role: "assistant",
      text: WAITING_MESSAGE_TEXT,
      isPending: true,
    };

    setIsAnswering(true);
    setChatRequestError(null);
    setDraft("");
    setActiveChatId(optimisticChatId);
    setActiveNav("chat");
    setRecentChatItems((items) => {
      if (isExistingServerChat) {
        return items;
      }

      const title = messageText.length <= 60 ? messageText : `${messageText.slice(0, 57)}...`;
      return [{ id: optimisticChatId, title }, ...items];
    });
    setChatMessagesById((messagesById) => ({
      ...messagesById,
      [optimisticChatId]: [...(messagesById[optimisticChatId] ?? []), optimisticUserMessage, optimisticAssistantMessage],
    }));

    try {
      const chat = isExistingServerChat
        ? await addChatMessage(optimisticChatId, messageText)
        : await createChat(messageText);

      setRecentChatItems((items) => {
        const nextItem = { id: chat.id, title: chat.title };
        return [nextItem, ...items.filter((item) => item.id !== chat.id && item.id !== optimisticChatId)];
      });
      setChatMessagesById((messagesById) => {
        const nextMessagesById = { ...messagesById };
        if (optimisticChatId !== chat.id) {
          delete nextMessagesById[optimisticChatId];
        }

        nextMessagesById[chat.id] = mapChatMessages(chat);
        return nextMessagesById;
      });
      if (chat.knowledgeContext) {
        setChatKnowledgeContexts((value) => ({
          ...value,
          [chat.id]: buildKnowledgeContextFromApiResponse(chat.knowledgeContext!),
        }));
      }
      setActiveChatId(chat.id);
      setActiveNav("chat");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setRecentChatItems((items) => items.filter((item) => item.id !== optimisticChatId));
        setChatMessagesById((messagesById) => {
          const nextMessagesById = { ...messagesById };
          delete nextMessagesById[optimisticChatId];
          return nextMessagesById;
        });
        handleUnauthorizedSession();
        return;
      }

      const appError = extractAppError(error);
      setChatRequestError(appError.message);
      setChatMessagesById((messagesById) => ({
        ...messagesById,
        [optimisticChatId]: (messagesById[optimisticChatId] ?? []).map((item) =>
          item.id === optimisticAssistantMessage.id
            ? { ...item, text: ANSWER_ERROR_TEXT, isPending: false }
            : item,
        ),
      }));
    } finally {
      setIsAnswering(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void handleSubmitMessage();
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

  const pinnedChatItems: ChatItem[] = [];
  const allChats = [...pinnedChatItems, ...recentChatItems];
  const activeChat = allChats.find((chat) => chat.id === activeChatId);
  const isNewChat = activeNav === "new";
  const isSearchChats = activeNav === "search";
  const canSend = draft.trim().length > 0 && !isAnswering;
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

    return activeChat?.title ?? "Новый чат";
  }, [activeChat?.title, isNewChat, isSearchChats]);

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
          <section className="chat-group" aria-labelledby="pinned-chats-heading" style={{ display: "none" }}>
            {sidebarExpanded ? (
              <h2 className="chat-group-title" id="pinned-chats-heading">
                Закреплённые
              </h2>
            ) : null}
            <div className="chat-list" role="list">
              {pinnedChatItems.map((chat) => {
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
                </section>
              ) : activeMessages.length > 0 ? (
                activeMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`message-row ${message.role === "user" ? "message-row-user" : "message-row-assistant"}`}
                  >
                    <div className={`message-bubble message-bubble-${message.role}`}>
                      {message.role === "assistant" ? (
                        message.isPending ? (
                          <WaitingMessage />
                        ) : (
                          <MarkdownRenderer
                            text={message.text}
                            getCitationDocId={(num) => activeKnowledgeContext?.documents.find((document) => document.citationId === num)?.id ?? ""}
                            onCitationClick={handleCitationClick}
                            onCitationHover={handleCitationHover}
                            onCitationLeave={handleCitationLeave}
                            hoveredCitationNum={hoveredCitationNum}
                          />
                        )
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
                  <h2>{activeChat?.title ?? "Новый чат"}</h2>
                  <p>Продолжите диалог или задайте уточнение по этой теме.</p>
                </section>
              )}
              {chatRequestError ? <p className="inline-status">{chatRequestError}</p> : null}
            </div>

            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmitMessage();
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
              <section className="context-empty-state" style={{ display: "none" }}>
                <h3>Граф знаний не загружен</h3>
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
      status: error.status,
    };
  }

  return {
    message: "Произошла ошибка. Попробуйте еще раз.",
    fieldErrors: {},
  };
}
