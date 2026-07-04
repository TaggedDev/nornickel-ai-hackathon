import { useEffect, useState } from "react";

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
  | "profile"
  | "chevron"
  | "close";

const SIDEBAR_STORAGE_KEY = "scientific-tangle-sidebar-mode";
const CONTEXT_STORAGE_KEY = "scientific-tangle-context-open";
const MOBILE_BREAKPOINT = 768;

const navItems: NavItem[] = [
  { id: "new", label: "New chat", icon: "spark" },
  { id: "search", label: "Search chats", icon: "search" },
];

const pinnedChats: ChatItem[] = [
  { id: "p1", title: "Nickel process chain overview" },
  { id: "p2", title: "Sulfide ore enrichment summary" },
];

const recentChats: ChatItem[] = [
  { id: "r1", title: "New chat" },
  { id: "r2", title: "Collect LLM questions for metallurgical constraints" },
  { id: "r3", title: "Compare concentrate processing scenarios by energy cost" },
  { id: "r4", title: "Prepare a graph knowledge outline for raw material flows" },
  { id: "r5", title: "List transition risks for the new furnace mode" },
  { id: "r6", title: "Compare quarterly production loss reports" },
];

const messages: Message[] = [
  {
    id: "m1",
    role: "assistant",
    text: "The interface uses a dark shell with navigation, chat history, and a contextual side panel.",
  },
  {
    id: "m2",
    role: "user",
    text: "Build a ChatGPT-like layout, but keep it generic and suitable for a custom product.",
  },
  {
    id: "m3",
    role: "assistant",
    text: "The left sidebar stays visible on desktop, collapses into an icon rail, and becomes a drawer on mobile.",
  },
];

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

function readStorageFlag(key: string, expectedValue: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.localStorage.getItem(key) === expectedValue;
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
    </span>
  );
}

export default function App() {
  const isMobile = useIsMobile();
  const [sidebarExpanded, setSidebarExpanded] = useState(() =>
    readStorageFlag(SIDEBAR_STORAGE_KEY, "expanded", true),
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(() => readStorageFlag(CONTEXT_STORAGE_KEY, "open", false));
  const [activeNav, setActiveNav] = useState("new");
  const [activeChatId, setActiveChatId] = useState("r1");
  const [draft, setDraft] = useState("");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarExpanded ? "expanded" : "collapsed");
  }, [sidebarExpanded]);

  useEffect(() => {
    window.localStorage.setItem(CONTEXT_STORAGE_KEY, contextOpen ? "open" : "closed");
  }, [contextOpen]);

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

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

  return (
    <div className="app-shell">
      {isMobile && mobileSidebarOpen ? (
        <button
          aria-label="Close sidebar"
          className="sidebar-overlay"
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={sidebarClassName}
        aria-label="Navigation and chat history"
        onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
        onTouchStart={(event) => handleTouchStart(event.changedTouches[0]?.clientX ?? 0)}
      >
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <button
              aria-label={isMobile ? "Close menu" : sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              className="sidebar-toggle"
              type="button"
              onClick={handleToggleSidebar}
            >
              <Icon name="menu" />
            </button>

            {sidebarExpanded ? (
              <div className="sidebar-brand-text">
                <strong>Scientific Tangle</strong>
                <span>Research workspace</span>
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
                Pinned
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
                Recent
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
          <button
            aria-label={!sidebarExpanded ? "User profile" : undefined}
            className="profile-button"
            title={!sidebarExpanded ? "User profile" : undefined}
            type="button"
          >
            <span className="profile-avatar">
              <Icon name="profile" />
            </span>
            {sidebarExpanded ? (
              <>
                <span className="profile-meta">
                  <strong>Denis</strong>
                  <span>Исследователь</span>
                </span>
                <span className="profile-more">
                  <Icon name="chevron" />
                </span>
              </>
            ) : null}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="main-header">
          <div className="main-header-left">
            {isMobile ? (
              <button
                aria-label="Open menu"
                className="mobile-menu-button"
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Icon name="panel" />
              </button>
            ) : null}

            <div>
              <p className="main-header-kicker">Active chat</p>
              <h1>{activeChat.title}</h1>
            </div>
          </div>

          <button
            aria-expanded={contextOpen}
            className={`context-button ${contextOpen ? "is-active" : ""}`}
            type="button"
            onClick={() => setContextOpen((value) => !value)}
          >
            Context
          </button>
        </header>

        <section className={`workspace ${contextOpen ? "workspace-with-context" : ""}`}>
          <div className="conversation-panel" aria-label="Conversation">
            <div className="message-list">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`message-row ${message.role === "user" ? "message-row-user" : "message-row-assistant"}`}
                >
                  <div className={`message-bubble message-bubble-${message.role}`}>
                    <p>{message.text}</p>
                  </div>
                </article>
              ))}
            </div>

            <form className="composer" onSubmit={(event) => event.preventDefault()}>
              <textarea
                aria-label="Message input"
                className="composer-input"
                placeholder="Write a message"
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button className="composer-submit" type="submit">
                Send
              </button>
            </form>
          </div>

          {contextOpen ? (
            <aside className="context-panel" aria-label="Context panel">
              <div className="context-panel-header">
                <h2>References</h2>
                <button
                  aria-label="Close context panel"
                  className="context-close"
                  type="button"
                  onClick={() => setContextOpen(false)}
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="context-panel-body">
                <section className="context-card">
                  <h3>Answer references</h3>
                  <p>Reserved for citations, source excerpts, and supporting links.</p>
                </section>

                <section className="context-card">
                  <h3>Knowledge graph</h3>
                  <p>Reserved for entities, connected nodes, and graph exploration widgets.</p>
                </section>
              </div>
            </aside>
          ) : null}
        </section>
      </main>
    </div>
  );
}
