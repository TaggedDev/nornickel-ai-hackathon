import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  type AuthUser,
  checkEmailAvailability,
  login,
  logout,
  register,
  type ValidationErrors,
} from "./shared/api/auth";
import { fetchOverview, type DashboardOverview } from "./shared/api/dashboard";

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
  { id: "p1", title: "Обзор технологической цепочки никеля" },
  { id: "p2", title: "Сводка по обогащению сульфидной руды" },
];

const recentChats: ChatItem[] = [
  { id: "r1", title: "Новый чат" },
  { id: "r2", title: "Собрать вопросы для LLM по металлургическим ограничениям" },
  { id: "r3", title: "Сравнить сценарии переработки концентрата по энергозатратам" },
  { id: "r4", title: "Подготовить структуру графа знаний для потоков сырья" },
  { id: "r5", title: "Перечислить риски перехода на новый режим печи" },
  { id: "r6", title: "Сравнить квартальные отчёты о потерях производства" },
];

const messages: Message[] = [
  {
    id: "m1",
    role: "assistant",
    text: "Интерфейс использует тёмную оболочку с навигацией, историей чатов и контекстной боковой панелью.",
  },
  {
    id: "m2",
    role: "user",
    text: "Собери интерфейс в стиле ChatGPT, но оставь его универсальным и подходящим для кастомного продукта.",
  },
  {
    id: "m3",
    role: "assistant",
    text: "Левая панель видна на десктопе, сворачивается до панели иконок и становится выдвижным меню на мобильных устройствах.",
  },
];

const promptSuggestions = [
  "Суммировать риски производства никеля",
  "Сравнить сценарии переработки",
  "Подготовить сущности графа знаний",
  "Сформулировать вопросы по металлургии",
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
  | "logout";

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
  const [activeChatId, setActiveChatId] = useState("r1");
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      setOverview(null);
      if (route !== "/auth") {
        navigate("/auth");
      }
      return;
    }

    if (route === "/auth") {
      navigate("/");
      return;
    }

    let isActive = true;
    setOverviewError(null);
    void fetchOverview()
      .then((payload) => {
        if (!isActive) {
          return;
        }

        setOverview(payload);
      })
      .catch((error: Error) => {
        if (!isActive) {
          return;
        }

        if (error.message.includes("401")) {
          setCurrentUser(null);
          navigate("/auth");
          return;
        }

        if (error.message.includes("403")) {
          navigate("/access-denied");
          return;
        }

        setOverviewError("Не удалось загрузить данные панели.");
      });

    return () => {
      isActive = false;
    };
  }, [currentUser, route]);

  function handleAuthSuccess(user: AuthUser) {
    setCurrentUser(user);
    setOverviewError(null);
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
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
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

  const allChats = [...pinnedChats, ...recentChats];
  const activeChat = allChats.find((chat) => chat.id === activeChatId) ?? recentChats[0];
  const isNewChat = activeNav === "new";
  const isSearchChats = activeNav === "search";
  const canSend = draft.trim().length > 0;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearchQuery
    ? allChats.filter((chat) => chat.title.toLowerCase().includes(normalizedSearchQuery))
    : allChats;
  const profileLabel = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "User";
  const dashboardActivities = overview?.activities ?? [];
  const welcomeTitle = useMemo(() => {
    if (isSearchChats) {
      return "Поиск чатов";
    }

    if (isNewChat) {
      return "Новый чат";
    }

    return overview?.productName ?? activeChat.title;
  }, [activeChat.title, isNewChat, isSearchChats, overview?.productName]);

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
              {recentChats.map((chat) => {
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

      <main className="main-panel">
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

          <button
            aria-expanded={contextOpen}
            className={`context-button ${contextOpen ? "is-active" : ""}`}
            type="button"
            onClick={() => setContextOpen((value) => !value)}
          >
            Контекст
          </button>
        </header>

        <section className={`workspace ${contextOpen ? "workspace-with-context" : ""}`}>
          <div className="conversation-panel" aria-label="Диалог">
            {overviewError ? <div className="inline-status">{overviewError}</div> : null}

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
                      <button key={suggestion} className="prompt-card" type="button" onClick={() => setDraft(suggestion)}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={`message-row ${message.role === "user" ? "message-row-user" : "message-row-assistant"}`}
                  >
                    <div className={`message-bubble message-bubble-${message.role}`}>
                      <p>{message.text}</p>
                    </div>
                  </article>
                ))
              )}
            </div>

            <form className="composer" onSubmit={(event) => event.preventDefault()}>
              <textarea
                aria-label="Message input"
                className="composer-input"
                placeholder="Введите сообщение"
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button aria-label="Отправить сообщение" className="composer-submit" disabled={!canSend} type="submit">
                <Icon name="send" />
              </button>
            </form>
          </div>

          {contextOpen ? (
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
                {dashboardActivities.length > 0 ? (
                  <section className="context-card">
                    <h3>Недавняя активность</h3>
                    <div className="activity-list">
                      {dashboardActivities.map((activity) => (
                        <div key={`${activity.category}-${activity.title}`} className="activity-item">
                          <strong>{activity.category}</strong>
                          <p>{activity.title}</p>
                          <span>{activity.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="context-card">
                  <h3>Граф знаний</h3>
                  <p>Место для сущностей, связанных узлов и виджетов исследования графа.</p>
                </section>
              </div>
            </aside>
          ) : null}
        </section>
      </main>
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
