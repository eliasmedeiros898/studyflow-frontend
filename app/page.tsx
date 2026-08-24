"use client";

import {
  BarChart3, Bell, BookOpen, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CirclePlus,
  Clock3, Flame, Home, LockKeyhole, LogOut, Mail, Menu, MoreHorizontal, Play, Plus,
  Search, Settings, Sparkles, Target, TimerReset, UserRound, X, Zap, Pencil, Archive, Trash2,
  Coffee, SlidersHorizontal, History, RotateCcw, AlertCircle
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Subject = { id: string; name: string; color: string; archived: boolean };
type Task = { id: string; subjectId: string; subjectName?: string; subjectColor?: string; title: string; date: string; type: string; completed: boolean; origin?: "MANUAL" | "AUTOMATIC_REVIEW"; sourceSessionId?: string | null };
type ReviewSchedule = { taskId: string; date: string; intervalDays: number; accuracy: number };
type StudySession = { id: string; subjectId: string; subjectName: string; subjectColor: string; topic: string; durationMinutes: number; date: string; questions: number; correctAnswers: number; type: string; accuracy: number; createdAt: string; scheduledReview?: ReviewSchedule | null };
type AppNotification = { id: string; type: string; title: string; message: string; actionTarget: "CALENDAR" | "REVIEWS"; relatedTaskId?: string | null; read: boolean; createdAt: string };
type NotificationCenterData = { unreadCount: number; notifications: AppNotification[] };
type SubjectMetrics = { subjectId: string; minutes: number; sessionCount: number; questions: number; correctAnswers: number; accuracy: number; lastStudiedOn?: string | null };
type TopicSummary = { topic: string; sessionCount: number; minutes: number; questions: number; correctAnswers: number; accuracy: number; lastStudiedOn: string };
type SubjectDetails = { subject: Subject; metrics: SubjectMetrics; topics: TopicSummary[]; recentSessions: StudySession[]; reviews?: Task[] };
type Activity = { date: string; minutes: number };
type Dashboard = {
  minutesStudied: number; questionsAnswered: number; correctAnswers: number; accuracy: number;
  currentStreak: number; bestStreak: number; weeklyGoalMinutes: number; weeklyGoalQuestions: number; targetAccuracy: number; activity: Activity[]; todayTasks: Task[];
};
type Goal = { id: string | null; periodStart: string; periodEnd: string; targetMinutes: number; targetQuestions: number; targetAccuracy: number };
type TimelinePoint = { label: string; date: string; minutes: number; questions: number };
type SubjectPerformance = { subjectId: string; name: string; color: string; minutes: number; questions: number; correctAnswers: number; accuracy: number; sharePercent: number };
type Performance = { period: "WEEK" | "MONTH" | "YEAR"; periodStart: string; periodEnd: string; minutes: number; questions: number; correctAnswers: number; accuracy: number; previousMinutes: number; timeline: TimelinePoint[]; subjects: SubjectPerformance[] };
type User = { id: string; name: string; email: string; timezone: string; targetExamName: string | null; targetExamDate: string | null };
type AuthState = "checking" | "guest" | "authenticated" | "demo";
type FocusSettings = { focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number; cycles: number; soundEnabled: boolean; browserNotifications: boolean };
type AccountPreferences = FocusSettings & { reviewDifficultyDays: number; reviewDevelopingDays: number; reviewProficientDays: number; reviewMasteredDays: number };
type ReviewAttempt = { sessionId: string; date: string; questions: number; correctAnswers: number; accuracy: number; type: string };
type TopicProgress = { subjectId: string; subjectName: string; subjectColor: string; topic: string; answeredSessions: number; questions: number; correctAnswers: number; accuracy: number; latestAccuracy: number; trend: number | null; status: "DIFFICULTY" | "PROGRESS" | "MASTERED"; lastStudiedOn: string; pendingReviewTaskId?: string | null; nextReviewDate?: string | null; history: ReviewAttempt[] };

const API_URL = "/api/backend";
const today = new Date().toISOString().slice(0, 10);
const palette = ["#7567F8", "#EB6F92", "#32B58B", "#F2A65A", "#4E9DE0"];
const suggestedSubjects = ["Matemática", "Linguagens", "Biologia", "História", "Física", "Química", "Geografia", "Redação"];
const defaultFocusSettings: AccountPreferences = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, cycles: 4, soundEnabled: true, browserNotifications: false, reviewDifficultyDays: 1, reviewDevelopingDays: 3, reviewProficientDays: 7, reviewMasteredDays: 15 };
const demoSubjects: Subject[] = [
  { id: "math", name: "Matemática", color: "#7567F8", archived: false },
  { id: "lang", name: "Linguagens", color: "#EB6F92", archived: false },
  { id: "bio", name: "Biologia", color: "#32B58B", archived: false },
  { id: "hist", name: "História", color: "#F2A65A", archived: false },
];
const demoTasks: Task[] = [
  { id: "t1", subjectId: "math", title: "Funções e gráficos", date: today, type: "Primeiro contato", completed: false },
  { id: "t2", subjectId: "lang", title: "Lista de interpretação", date: today, type: "Revisão", completed: true },
  { id: "t3", subjectId: "bio", title: "Revisar citologia", date: today, type: "Revisão", completed: false },
];

function initialActivity(): Activity[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { date: date.toISOString().slice(0, 10), minutes: [50, 80, 0, 110, 65, 95, 35][index] };
  });
}

const demoDashboard: Dashboard = {
  minutesStudied: 435, questionsAnswered: 128, correctAnswers: 94, accuracy: 73,
  currentStreak: 4, bestStreak: 12, weeklyGoalMinutes: 600, weeklyGoalQuestions: 180, targetAccuracy: 75, activity: initialActivity(), todayTasks: demoTasks,
};
const demoNotificationCenter: NotificationCenterData = { unreadCount: 2, notifications: [
  { id: "demo-notification-1", type: "REVIEW_TODAY", title: "Revisão para hoje", message: "Biologia: citologia", actionTarget: "REVIEWS", read: false, createdAt: new Date().toISOString() },
  { id: "demo-notification-2", type: "TASK_TODAY", title: "Tarefa para hoje", message: "Matemática: funções e gráficos", actionTarget: "CALENDAR", read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
] };

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [user, setUser] = useState<User | null>(null);
  const [active, setActive] = useState("Início");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dashboard, setDashboard] = useState(demoDashboard);
  const [subjects, setSubjects] = useState(demoSubjects);
  const [tasks, setTasks] = useState(demoTasks);
  const [modal, setModal] = useState<"session" | "focusSession" | "task" | "subject" | null>(null);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [taskDefaultDate, setTaskDefaultDate] = useState(today);
  const [taskRevision, setTaskRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [notificationCenter, setNotificationCenter] = useState<NotificationCenterData>(demoNotificationCenter);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [focusPreferences, setFocusPreferences] = useState<AccountPreferences>(defaultFocusSettings);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(response => response.json())
      .then(session => {
        if (session.authenticated) { setUser(session.user); setAuthState("authenticated"); }
        else setAuthState("guest");
      })
      .catch(() => setAuthState("guest"));
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return;
    Promise.all([fetch(`${API_URL}/dashboard`), fetch(`${API_URL}/subjects`), fetch(`${API_URL}/notifications`), fetch(`${API_URL}/preferences`)])
      .then(async ([dashboardResponse, subjectsResponse, notificationsResponse, preferencesResponse]) => {
        if (!dashboardResponse.ok || !subjectsResponse.ok || !notificationsResponse.ok || !preferencesResponse.ok) throw new Error();
        const [nextDashboard, nextSubjects, nextNotifications, nextPreferences] = await Promise.all([dashboardResponse.json(), subjectsResponse.json(), notificationsResponse.json(), preferencesResponse.json()]);
        setDashboard(nextDashboard);
        setTasks(nextDashboard.todayTasks);
        setSubjects(nextSubjects);
        setNotificationCenter(nextNotifications);
        setFocusPreferences(nextPreferences);
      })
      .catch(() => setAuthState("guest"));
  }, [authState]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const toggleTask = async (id: string) => {
    const target = tasks.find(task => task.id === id);
    if (target?.origin === "AUTOMATIC_REVIEW") {
      setActive("Revisões");
      showNotice("Registre o resultado pela Central de revisões.");
      return;
    }
    setTasks(current => current.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
    if (authState === "demo") return;
    try {
      const response = await fetch(`${API_URL}/tasks/${id}/toggle`, { method: "PATCH" });
      if (!response.ok) throw new Error();
    } catch {
      setTasks(current => current.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
      showNotice("Não foi possível atualizar a tarefa.");
    }
  };

  const completeSession = (minutes: number, questions: number, correct: number, scheduledReview?: ReviewSchedule | null) => {
    setDashboard(current => ({
      ...current,
      minutesStudied: current.minutesStudied + minutes,
      questionsAnswered: current.questionsAnswered + questions,
      correctAnswers: current.correctAnswers + correct,
      accuracy: current.questionsAnswered + questions === 0 ? 0 : Math.round((current.correctAnswers + correct) * 100 / (current.questionsAnswered + questions)),
    }));
    if (scheduledReview) setTaskRevision(value => value + 1);
    setModal(null);
    if (active === "Foco") window.dispatchEvent(new Event("studyflow-focus-saved"));
    showNotice(scheduledReview ? `Sessão salva. Revisão agendada para ${formatShortDate(scheduledReview.date)}.` : "Sessão registrada. Seu progresso foi atualizado!");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null); setAuthState("guest");
  };

  const toggleNotifications = async () => {
    const opening = !notificationsOpen;
    setNotificationsOpen(opening);
    if (opening && authState === "authenticated") {
      const response = await fetch(`${API_URL}/notifications`, { cache: "no-store" });
      if (response.ok) setNotificationCenter(await response.json());
    }
  };

  if (authState === "checking") return <LoadingScreen />;
  if (authState === "guest") return <AuthScreen onAuthenticated={(nextUser) => { setUser(nextUser); setAuthState("authenticated"); }} onDemo={() => setAuthState("demo")} />;
  if (authState === "authenticated" && user && (!user.targetExamName || !user.targetExamDate)) {
    return <OnboardingScreen user={user} onComplete={(nextUser, nextSubjects) => {
      setUser(nextUser); setSubjects(nextSubjects); setTasks([]);
    }} onLogout={logout} />;
  }

  const examName = user?.targetExamName ?? "ENEM 2026";
  const examDays = user?.targetExamDate ? daysUntil(user.targetExamDate, user.timezone) : 79;

  return (
    <div className="app-shell">
      <Sidebar active={active} setActive={setActive} open={mobileMenu} close={() => setMobileMenu(false)} onLogout={authState === "authenticated" ? logout : () => setAuthState("guest")} />
      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-only" aria-label="Abrir menu" onClick={() => setMobileMenu(true)}><Menu /></button>
          <div className="topbar-spacer" />
          <div className="exam-pill"><Target size={17} /><span><strong>{examName}</strong><small>{examDays === 0 ? "É hoje!" : `${examDays} dias restantes`}</small></span></div>
          <div className="notification-anchor"><button className="icon-button" aria-label="Notificações" aria-expanded={notificationsOpen} onClick={toggleNotifications}><Bell size={20} />{notificationCenter.unreadCount > 0 && <i />}</button>{notificationsOpen && <NotificationPopover data={notificationCenter} isDemo={authState === "demo"} close={() => setNotificationsOpen(false)} update={setNotificationCenter} goTo={(target) => { setActive(target === "REVIEWS" ? "Revisões" : "Calendário"); setNotificationsOpen(false); }} />}</div>
          <div className="avatar" aria-label={`Perfil de ${user?.name ?? "visitante"}`}>{initials(user?.name ?? "Demo")}</div>
        </header>

        <div key={active} className="view-transition">
        {active === "Início" && <DashboardView firstName={(user?.name ?? "Elias").split(" ")[0]} timezone={user?.timezone ?? "America/Sao_Paulo"} dashboard={dashboard} tasks={tasks} subjects={subjects} toggleTask={toggleTask} setModal={(value) => { if (value === "task") setTaskDefaultDate(today); setModal(value); }} goTo={setActive} />}
        {active === "Disciplinas" && <SubjectsView subjects={subjects} isDemo={authState === "demo"} setModal={setModal} onUpdate={(next) => { setSubjects(current => current.map(item => item.id === next.id ? next : item)); showNotice("Disciplina atualizada."); }} onArchive={(next) => { setSubjects(current => current.filter(item => item.id !== next.id)); showNotice("Disciplina arquivada sem apagar o histórico."); }} onRestore={(next) => { setSubjects(current => [...current.filter(item => item.id !== next.id), next].sort((a, b) => a.name.localeCompare(b.name))); showNotice("Disciplina restaurada."); }} />}
        {active === "Calendário" && <CalendarView tasks={tasks} subjects={subjects} isDemo={authState === "demo"} revision={taskRevision} toggleTask={toggleTask} openTaskModal={(date) => { setTaskDefaultDate(date); setModal("task"); }} onTaskChanged={(next) => { setTasks(current => [...current.filter(item => item.id !== next.id), ...(next.date === today ? [next] : [])]); setTaskRevision(value => value + 1); showNotice("Tarefa atualizada."); }} onTaskDeleted={(id) => { setTasks(current => current.filter(item => item.id !== id)); setTaskRevision(value => value + 1); showNotice("Tarefa excluída."); }} />}
        {active === "Revisões" && <ReviewsView isDemo={authState === "demo"} subjects={subjects} revision={taskRevision} onChanged={() => { setTaskRevision(value => value + 1); showNotice("Revisão atualizada."); }} />}
        {active === "Histórico" && <SessionHistoryView isDemo={authState === "demo"} subjects={subjects} onChanged={() => { setTaskRevision(value => value + 1); if (authState === "authenticated") fetch(`${API_URL}/dashboard`, { cache: "no-store" }).then(response => response.json()).then(next => { setDashboard(next); setTasks(next.todayTasks); }); showNotice("Histórico e indicadores atualizados."); }} />}
        {active === "Foco" && <FocusView initialSettings={focusPreferences} onSettingsChange={(next) => setFocusPreferences(current => ({ ...current, ...next }))} persistSettings={authState === "authenticated"} goalMinutes={Math.max(25, Math.round(dashboard.weeklyGoalMinutes / 6))} studiedToday={dashboard.activity.find(item => item.date === today)?.minutes ?? 0} onSave={(minutes) => { setFocusMinutes(minutes); setModal("focusSession"); }} />}
        {active === "Desempenho" && <PerformanceView isDemo={authState === "demo"} subjects={subjects} dashboard={dashboard} />}
        {active === "Metas" && <GoalsView isDemo={authState === "demo"} dashboard={dashboard} onGoalSaved={(goal) => setDashboard(current => ({ ...current, weeklyGoalMinutes: goal.targetMinutes, weeklyGoalQuestions: goal.targetQuestions, targetAccuracy: goal.targetAccuracy }))} showNotice={showNotice} />}
        {active === "Configurações" && (user ? <ProfileSettings user={user} preferences={focusPreferences} onPreferencesUpdate={setFocusPreferences} onUpdate={setUser} onPasswordChanged={logout} showNotice={showNotice} /> : <ComingSoon title="Configurações da demonstração" />)}
        {!["Início", "Disciplinas", "Calendário", "Revisões", "Histórico", "Foco", "Desempenho", "Metas", "Configurações"].includes(active) && <ComingSoon title={active} />}
        </div>
      </main>

      {modal && <Modal type={modal} subjects={subjects} isDemo={authState === "demo"} focusMinutes={focusMinutes} defaultTaskDate={taskDefaultDate} close={() => setModal(null)} addSubject={(subject) => { setSubjects([...subjects, subject]); setModal(null); showNotice("Disciplina criada com sucesso!"); }} addTask={(task) => { if (authState === "demo" || task.date === today) setTasks(current => [...current, task]); setTaskRevision(value => value + 1); setModal(null); showNotice("Tarefa adicionada ao seu plano!"); }} saveSession={completeSession} />}
      {notice && <div className="toast" role="status"><Check size={18} />{notice}</div>}
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function dateInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function daysUntil(target: string, timezone: string) {
  const [targetYear, targetMonth, targetDay] = target.split("-").map(Number);
  const [year, month, day] = dateInTimezone(timezone).split("-").map(Number);
  return Math.max(0, Math.ceil((Date.UTC(targetYear, targetMonth - 1, targetDay) - Date.UTC(year, month - 1, day)) / 86400000));
}

function longDate(timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, weekday: "long", day: "2-digit", month: "long" })
    .format(new Date()).replace("-feira", "-FEIRA").toUpperCase();
}

function toIsoDate(date: Date) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTaskType(type: string) {
  const aliases: Record<string, string> = { "Primeiro contato": "FIRST_CONTACT", "Revisão": "REVIEW", "Prova ou simulado": "EXAM", "Geral": "GENERAL" };
  return aliases[type] ?? type;
}

function taskTypeLabel(type: string) {
  const labels: Record<string, string> = { FIRST_CONTACT: "Primeiro contato", REVIEW: "Revisão", EXAM: "Prova ou simulado", GENERAL: "Geral" };
  return labels[normalizeTaskType(type)] ?? type.replaceAll("_", " ").toLowerCase();
}

function sessionTypeLabel(type: string) {
  const labels: Record<string, string> = { FIRST_CONTACT: "Primeiro contato", REVIEW: "Revisão", MOCK_EXAM: "Simulado", OTHER: "Outro" };
  return labels[type] ?? type;
}

const navItems = [
  ["Início", Home], ["Calendário", CalendarDays], ["Disciplinas", BookOpen],
  ["Revisões", RotateCcw], ["Histórico", History], ["Foco", Clock3], ["Desempenho", BarChart3], ["Metas", Target],
] as const;

function Sidebar({ active, setActive, open, close, onLogout }: { active: string; setActive: (name: string) => void; open: boolean; close: () => void; onLogout: () => void }) {
  return <>
    {open && <button className="scrim" onClick={close} aria-label="Fechar menu" />}
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><span><Zap size={21} fill="currentColor" /></span>StudyFlow<button className="icon-button mobile-only" onClick={close}><X /></button></div>
      <nav aria-label="Navegação principal">
        {navItems.map(([name, Icon]) => <button key={name} className={active === name ? "active" : ""} onClick={() => { setActive(name); close(); }}><Icon size={20} /><span>{name}</span>{active === name && <i />}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <button className={active === "Configurações" ? "active" : ""} onClick={() => { setActive("Configurações"); close(); }}><Settings size={20} />Configurações</button>
        <button onClick={onLogout}><LogOut size={20} />Sair</button>
        <div className="encouragement"><Sparkles size={18} /><div><strong>Você está indo bem!</strong><small>4 dias de constância</small></div></div>
      </div>
    </aside>
  </>;
}

function NotificationPopover({ data, isDemo, close, update, goTo }: { data: NotificationCenterData; isDemo: boolean; close: () => void; update: (data: NotificationCenterData) => void; goTo: (target: "CALENDAR" | "REVIEWS") => void }) {
  const markRead = async (notification: AppNotification) => {
    if (!notification.read && !isDemo) await fetch(`${API_URL}/notifications/${notification.id}/read`, { method: "PATCH" });
    if (!notification.read) update({ unreadCount: Math.max(0, data.unreadCount - 1), notifications: data.notifications.map(item => item.id === notification.id ? { ...item, read: true } : item) });
    goTo(notification.actionTarget);
  };
  const markAll = async () => {
    if (!isDemo) await fetch(`${API_URL}/notifications/read-all`, { method: "PATCH" });
    update({ unreadCount: 0, notifications: data.notifications.map(item => ({ ...item, read: true })) });
  };
  return <section className="notification-popover" aria-label="Central de notificações"><div className="notification-heading"><div><strong>Notificações</strong><small>{data.unreadCount ? `${data.unreadCount} não ${data.unreadCount === 1 ? "lida" : "lidas"}` : "Tudo em dia"}</small></div><button className="icon-button" onClick={close} aria-label="Fechar notificações"><X /></button></div>{data.notifications.length ? <><div className="notification-list">{data.notifications.slice(0, 12).map(item => <button key={item.id} className={item.read ? "read" : ""} onClick={() => markRead(item)}><span className={`notification-icon ${item.type.includes("REVIEW") ? "review" : "task"}`}>{item.type.includes("REVIEW") ? <RotateCcw /> : <CalendarDays />}</span><span><strong>{item.title}</strong><small>{item.message}</small><em>{new Date(item.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</em></span>{!item.read && <i />}</button>)}</div>{data.unreadCount > 0 && <button className="notification-read-all" onClick={markAll}><Check />Marcar todas como lidas</button>}</> : <div className="notification-empty"><Bell /><strong>Nenhum aviso por enquanto</strong><small>Suas tarefas e revisões aparecerão aqui.</small></div>}</section>;
}

function DashboardView({ firstName, timezone, dashboard, tasks, subjects, toggleTask, setModal, goTo }: { firstName: string; timezone: string; dashboard: Dashboard; tasks: Task[]; subjects: Subject[]; toggleTask: (id: string) => void; setModal: (value: "session" | "task" | "subject") => void; goTo: (value: string) => void }) {
  const goalPercent = Math.min(100, Math.round(dashboard.minutesStudied / dashboard.weeklyGoalMinutes * 100));
  return <div className="page dashboard-page">
    <section className="welcome">
      <div><span className="eyebrow">{longDate(timezone)}</span><h1>Olá, {firstName}! <span>👋</span></h1><p>Mais um passo hoje. Seu futuro agradece.</p></div>
      <button className="primary" onClick={() => goTo("Foco")}><Play size={18} fill="currentColor" />Iniciar foco</button>
    </section>

    <section className="stats-grid">
      <StatCard icon={<Clock3 />} tone="purple" label="Tempo estudado" value={`${Math.floor(dashboard.minutesStudied / 60)}h ${dashboard.minutesStudied % 60}min`} helper={`${goalPercent}% da meta semanal`} progress={goalPercent} />
      <StatCard icon={<BookOpen />} tone="pink" label="Questões resolvidas" value={String(dashboard.questionsAnswered)} helper="+18 desde ontem" />
      <StatCard icon={<Target />} tone="green" label="Taxa de acertos" value={`${dashboard.accuracy}%`} helper={`${dashboard.correctAnswers} respostas corretas`} />
      <StatCard icon={<Flame />} tone="orange" label="Sequência atual" value={`${dashboard.currentStreak} dias`} helper={`Seu recorde é ${dashboard.bestStreak} dias`} />
    </section>

    <section className="dashboard-grid">
      <article className="panel activity-panel">
        <div className="panel-heading"><div><h2>Seu ritmo nesta semana</h2><p>Minutos de estudo por dia</p></div><span className="subtle-badge">Esta semana</span></div>
        <WeeklyChart activity={dashboard.activity} />
      </article>
      <article className="panel consistency-panel">
        <div className="panel-heading"><div><h2>Constância</h2><p>Continue construindo seu hábito</p></div><Flame className="orange-text" /></div>
        <div className="streak-number"><strong>{dashboard.currentStreak}</strong><span>dias<br />seguidos</span></div>
        <div className="week-dots">{dashboard.activity.map((day, index) => <div key={day.date}><span className={day.minutes > 0 ? "studied" : ""}>{day.minutes > 0 ? <Check size={15} /> : ""}</span><small>{["S", "T", "Q", "Q", "S", "S", "D"][index]}</small></div>)}</div>
        <p className="kind-note">Cada sessão conta. Mantenha o seu ritmo.</p>
      </article>
    </section>

    <section className="dashboard-grid lower">
      <article className="panel tasks-panel">
        <div className="panel-heading"><div><h2>Planejado para hoje</h2><p>{tasks.filter(task => task.completed).length} de {tasks.length} tarefas concluídas</p></div><button className="text-button" onClick={() => goTo("Calendário")}>Ver calendário <ChevronRight size={17} /></button></div>
        <div className="task-list">{tasks.map(task => <TaskRow key={task.id} task={task} subject={subjects.find(subject => subject.id === task.subjectId)} toggle={() => toggleTask(task.id)} />)}</div>
        <button className="add-line" onClick={() => setModal("task")}><CirclePlus size={18} />Adicionar tarefa</button>
      </article>
      <article className="panel quick-panel">
        <div className="panel-heading"><div><h2>Ações rápidas</h2><p>Registre sem perder o ritmo</p></div></div>
        <button onClick={() => goTo("Foco")}><span className="quick-icon purple"><Play size={19} /></span><div><strong>Iniciar uma sessão</strong><small>Use o temporizador de foco</small></div><ChevronRight size={18} /></button>
        <button onClick={() => setModal("session")}><span className="quick-icon green"><Plus size={19} /></span><div><strong>Registrar estudo</strong><small>Adicione uma sessão já feita</small></div><ChevronRight size={18} /></button>
        <button onClick={() => setModal("task")}><span className="quick-icon orange"><CalendarDays size={19} /></span><div><strong>Planejar tarefa</strong><small>Organize os próximos estudos</small></div><ChevronRight size={18} /></button>
      </article>
    </section>
  </div>;
}

function StatCard({ icon, tone, label, value, helper, progress }: { icon: React.ReactNode; tone: string; label: string; value: string; helper: string; progress?: number }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-content"><span>{label}</span><strong>{value}</strong><small>{helper}</small>{progress !== undefined && <div className="progress"><i style={{ transform: `scaleX(${progress / 100})` }} /></div>}</div><button aria-label={`Mais opções para ${label}`}><MoreHorizontal /></button></article>;
}

function WeeklyChart({ activity }: { activity: Activity[] }) {
  const max = Math.max(...activity.map(day => day.minutes), 120);
  return <div className="chart" aria-label="Gráfico de minutos estudados por dia">
    <div className="chart-grid"><span>120</span><span>90</span><span>60</span><span>30</span><span>0</span></div>
    <div className="bars">{activity.map((day, index) => <div className="bar-column" key={day.date}><div className="bar-track"><i style={{ height: `${Math.max(day.minutes ? 8 : 0, day.minutes / max * 100)}%` }}><b>{day.minutes || ""}</b></i></div><span>{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][index]}</span></div>)}</div>
  </div>;
}

function demoPerformance(subjects: Subject[], dashboard: Dashboard, period: Performance["period"]): Performance {
  const shares = [42, 27, 19, 12];
  return {
    period, periodStart: dashboard.activity[0]?.date ?? today, periodEnd: dashboard.activity.at(-1)?.date ?? today,
    minutes: dashboard.minutesStudied, questions: dashboard.questionsAnswered, correctAnswers: dashboard.correctAnswers,
    accuracy: dashboard.accuracy, previousMinutes: 360,
    timeline: dashboard.activity.map((item, index) => ({ label: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][index], date: item.date, minutes: item.minutes, questions: [20, 24, 0, 31, 18, 25, 10][index] })),
    subjects: subjects.map((subject, index) => {
      const share = shares[index] ?? 0; const questions = Math.round(dashboard.questionsAnswered * share / 100);
      const accuracy = Math.max(55, dashboard.accuracy + [6, -3, 2, -8][index % 4]);
      return { subjectId: subject.id, name: subject.name, color: subject.color, minutes: Math.round(dashboard.minutesStudied * share / 100), questions, correctAnswers: Math.round(questions * accuracy / 100), accuracy, sharePercent: share };
    }),
  };
}

function PerformanceView({ isDemo, subjects, dashboard }: { isDemo: boolean; subjects: Subject[]; dashboard: Dashboard }) {
  const [period, setPeriod] = useState<Performance["period"]>("WEEK");
  const [performance, setPerformance] = useState<Performance>(() => demoPerformance(subjects, dashboard, "WEEK"));
  useEffect(() => {
    if (isDemo) return;
    fetch(`${API_URL}/performance?period=${period}`, { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); setPerformance(await response.json()); });
  }, [period, isDemo]);
  const displayed = isDemo ? demoPerformance(subjects, dashboard, period) : performance;
  const change = displayed.previousMinutes === 0 ? null : Math.round((displayed.minutes - displayed.previousMinutes) * 100 / displayed.previousMinutes);
  const max = Math.max(60, ...displayed.timeline.map(point => point.minutes));
  return <div className="page performance-page"><section className="page-title"><div><span className="eyebrow">VISÃO ANALÍTICA</span><h1>Desempenho</h1><p>Entenda onde seu esforço está gerando resultado.</p></div><div className="period-switch" aria-label="Período do desempenho">{(["WEEK", "MONTH", "YEAR"] as const).map(value => <button key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{({ WEEK: "Semana", MONTH: "Mês", YEAR: "Ano" })[value]}</button>)}</div></section>
    <section className="analytics-summary"><article><span><Clock3 /></span><div><small>Tempo líquido</small><strong>{formatMinutes(displayed.minutes)}</strong><p className={change !== null && change >= 0 ? "positive" : ""}>{change === null ? "Primeiro período com dados" : `${change >= 0 ? "+" : ""}${change}% versus período anterior`}</p></div></article><article><span><BookOpen /></span><div><small>Questões resolvidas</small><strong>{displayed.questions}</strong><p>{displayed.correctAnswers} respostas corretas</p></div></article><article><span><Target /></span><div><small>Acurácia consolidada</small><strong>{displayed.accuracy}%</strong><p>Calculada sobre o volume total</p></div></article></section>
    <section className="analytics-layout"><article className="panel performance-chart"><div className="panel-heading"><div><h2>Evolução no período</h2><p>Minutos líquidos estudados</p></div><span className="subtle-badge">{formatDateRange(displayed.periodStart, displayed.periodEnd)}</span></div>{displayed.timeline.some(point => point.minutes > 0) ? <div className={`performance-bars ${period.toLowerCase()}`}>{displayed.timeline.map(point => <div key={point.date} title={`${point.label}: ${point.minutes} min`}><span><i style={{ height: `${Math.max(point.minutes ? 5 : 1, point.minutes / max * 100)}%` }} /></span><small>{point.label.replace(".", "")}</small></div>)}</div> : <MetricEmpty />}</article><article className="panel insight-card"><span className="insight-icon"><Sparkles /></span><h2>Leitura rápida</h2>{displayed.minutes > 0 ? <><p>Você dedicou mais tempo a <strong>{displayed.subjects[0]?.name ?? "seus estudos"}</strong>, que representa {displayed.subjects[0]?.sharePercent ?? 0}% do período.</p><div><span>Maior acurácia</span><strong>{[...displayed.subjects].sort((a, b) => b.accuracy - a.accuracy)[0]?.name ?? "Sem dados"}</strong></div><div><span>Volume total</span><strong>{formatMinutes(displayed.minutes)}</strong></div></> : <p>Registre sua primeira sessão neste período para receber uma leitura do seu ritmo.</p>}</article></section>
    <section className="panel subject-performance"><div className="panel-heading"><div><h2>Desempenho por disciplina</h2><p>Tempo, volume de questões e acurácia no período</p></div></div><div className="performance-table"><div className="performance-head"><span>Disciplina</span><span>Tempo</span><span>Questões</span><span>Acurácia</span><span>Participação</span></div>{displayed.subjects.map(subject => <div className="performance-row" key={subject.subjectId}><span className="performance-subject"><i style={{ background: subject.color }} />{subject.name}</span><strong>{formatMinutes(subject.minutes)}</strong><strong>{subject.questions}</strong><strong>{subject.accuracy}%</strong><span className="share-bar"><i style={{ transform: `scaleX(${subject.sharePercent / 100})`, background: subject.color }} /><small>{subject.sharePercent}%</small></span></div>)}</div></section>
  </div>;
}

function GoalsView({ isDemo, dashboard, onGoalSaved, showNotice }: { isDemo: boolean; dashboard: Dashboard; onGoalSaved: (goal: Goal) => void; showNotice: (message: string) => void }) {
  const [goal, setGoal] = useState<Goal>({ id: null, periodStart: dashboard.activity[0]?.date ?? today, periodEnd: dashboard.activity.at(-1)?.date ?? today, targetMinutes: dashboard.weeklyGoalMinutes, targetQuestions: dashboard.weeklyGoalQuestions, targetAccuracy: dashboard.targetAccuracy });
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isDemo) return;
    fetch(`${API_URL}/goals/current`, { cache: "no-store" }).then(async response => { if (response.ok) setGoal(await response.json()); });
  }, [isDemo]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setError(""); const values = Object.fromEntries(new FormData(event.currentTarget));
    const next = { ...goal, targetMinutes: Number(values.targetMinutes), targetQuestions: Number(values.targetQuestions), targetAccuracy: Number(values.targetAccuracy) };
    try {
      if (!isDemo) {
        const response = await fetch(`${API_URL}/goals/current`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.message ?? "Não foi possível salvar a meta."); Object.assign(next, payload);
      }
      setGoal(next); onGoalSaved(next); setEditing(false); showNotice("Metas da semana atualizadas.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar a meta."); }
    finally { setSubmitting(false); }
  };
  const goals = [
    { label: "Horas líquidas", icon: <Clock3 />, value: dashboard.minutesStudied, target: goal.targetMinutes, display: `${formatMinutes(dashboard.minutesStudied)} de ${formatMinutes(goal.targetMinutes)}`, tone: "purple" },
    { label: "Questões", icon: <BookOpen />, value: dashboard.questionsAnswered, target: goal.targetQuestions, display: `${dashboard.questionsAnswered} de ${goal.targetQuestions}`, tone: "pink" },
    { label: "Acurácia", icon: <Target />, value: dashboard.accuracy, target: goal.targetAccuracy, display: `${dashboard.accuracy}% de ${goal.targetAccuracy}%`, tone: "green" },
  ];
  return <div className="page goals-page"><section className="page-title"><div><span className="eyebrow">DIREÇÃO DA SEMANA</span><h1>Metas</h1><p>Defina um alvo realista e acompanhe o avanço sem pressão desnecessária.</p></div><button className="primary" onClick={() => setEditing(true)}><Settings size={17} />Ajustar metas</button></section><div className="goal-period"><CalendarDays /><span><small>Vigência atual</small><strong>{formatDateRange(goal.periodStart, goal.periodEnd)}</strong></span><p>Alterações ficam restritas a esta semana e não reescrevem períodos anteriores.</p></div><section className="goal-cards">{goals.map(item => { const percent = Math.min(100, Math.round(item.value / item.target * 100)); return <article key={item.label}><div className={`goal-icon ${item.tone}`}>{item.icon}</div><span>{item.label}</span><strong>{item.display}</strong><div className="goal-progress"><i style={{ transform: `scaleX(${percent / 100})` }} /></div><small>{percent >= 100 ? "Meta alcançada!" : `${percent}% concluído`}</small></article>; })}</section><section className="panel goal-message"><div><span><Sparkles /></span><div><h2>{dashboard.minutesStudied >= goal.targetMinutes ? "Você chegou lá." : "Constância vence intensidade."}</h2><p>{dashboard.minutesStudied >= goal.targetMinutes ? "Sua meta de tempo foi concluída. Continue no ritmo que fizer sentido para você." : `Faltam ${formatMinutes(Math.max(0, goal.targetMinutes - dashboard.minutesStudied))} para sua meta de tempo desta semana.`}</p></div></div><strong>{Math.min(100, Math.round(dashboard.minutesStudied / goal.targetMinutes * 100))}%</strong></section>
    {editing && <div className="modal-backdrop" onMouseDown={() => setEditing(false)}><section className="modal goal-modal" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">SEMANA ATUAL</span><h2 id="goal-modal-title">Ajustar metas</h2></div><button className="icon-button" onClick={() => setEditing(false)} aria-label="Fechar"><X /></button></div><form onSubmit={save}><label>Tempo líquido semanal (minutos)<input name="targetMinutes" type="number" min="1" max="10080" defaultValue={goal.targetMinutes} required /><small>Ex.: 600 minutos equivalem a 10 horas.</small></label><label>Questões na semana<input name="targetQuestions" type="number" min="1" max="100000" defaultValue={goal.targetQuestions} required /></label><label>Acurácia desejada (%)<input name="targetAccuracy" type="number" min="1" max="100" defaultValue={goal.targetAccuracy} required /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setEditing(false)}>Cancelar</button><button className="primary" disabled={submitting}>{submitting ? "Salvando…" : "Salvar metas"}</button></div></form></section></div>}
  </div>;
}

function MetricEmpty() { return <div className="metric-empty"><BarChart3 /><strong>Nenhum estudo neste período</strong><p>Registre uma sessão para começar a construir este gráfico.</p></div>; }
function formatMinutes(minutes: number) { return minutes < 60 ? `${minutes}min` : `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}min` : ""}`.trim(); }
function formatDateRange(start: string, end: string) { const format = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`)).replace(".", ""); return `${format(start)} — ${format(end)}`; }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(new Date(`${value}T12:00:00`)); }

function TaskRow({ task, subject, toggle, onEdit, onDelete }: { task: Task; subject?: Subject; toggle: () => void; onEdit?: () => void; onDelete?: () => void }) {
  return <div className={`task-row ${task.completed ? "completed" : ""}`}><button className="check-button" onClick={toggle} aria-label={task.completed ? "Reabrir tarefa" : "Concluir tarefa"}>{task.completed && <Check size={15} />}</button><span className="subject-line" style={{ background: subject?.color ?? task.subjectColor }} /><div><strong>{task.title}</strong><small>{subject?.name ?? task.subjectName ?? "Disciplina"} · {taskTypeLabel(task.type)}{task.origin === "AUTOMATIC_REVIEW" && <em>Automática</em>}</small></div>{onEdit || onDelete ? <span className="task-actions">{onEdit && <button onClick={onEdit} aria-label={`Editar ${task.title}`}><Pencil /></button>}{onDelete && <button onClick={onDelete} aria-label={`Excluir ${task.title}`}><Trash2 /></button>}</span> : <button className="more-button" aria-label="Opções da tarefa"><MoreHorizontal size={19} /></button>}</div>;
}

function SubjectsView({ subjects, isDemo, setModal, onUpdate, onArchive, onRestore }: { subjects: Subject[]; isDemo: boolean; setModal: (value: "subject") => void; onUpdate: (subject: Subject) => void; onArchive: (subject: Subject) => void; onRestore: (subject: Subject) => void }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [archiving, setArchiving] = useState<Subject | null>(null);
  const [metrics, setMetrics] = useState<SubjectMetrics[]>([]);
  const [details, setDetails] = useState<SubjectDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archived, setArchived] = useState<Subject[]>([]);
  const demoMetricValues: Record<string, Omit<SubjectMetrics, "subjectId">> = { math: { minutes: 435, sessionCount: 9, questions: 80, correctAnswers: 58, accuracy: 73, lastStudiedOn: today }, lang: { minutes: 310, sessionCount: 7, questions: 55, correctAnswers: 42, accuracy: 76, lastStudiedOn: today }, bio: { minutes: 245, sessionCount: 5, questions: 40, correctAnswers: 31, accuracy: 78, lastStudiedOn: today }, hist: { minutes: 180, sessionCount: 4, questions: 20, correctAnswers: 12, accuracy: 60, lastStudiedOn: today } };
  const demoMetrics = subjects.map(subject => ({ subjectId: subject.id, ...(demoMetricValues[subject.id] ?? { minutes: 0, sessionCount: 0, questions: 0, correctAnswers: 0, accuracy: 0, lastStudiedOn: null }) }));
  const effectiveMetrics = isDemo ? demoMetrics : metrics;
  useEffect(() => {
    if (isDemo) return;
    fetch(`${API_URL}/subjects/metrics`, { cache: "no-store" }).then(async response => { if (response.ok) setMetrics(await response.json()); });
  }, [isDemo, subjects]);
  const openDetails = async (subject: Subject) => {
    setDetailsLoading(true);
    if (isDemo) {
      const metric = effectiveMetrics.find(item => item.subjectId === subject.id) ?? { subjectId: subject.id, minutes: 0, sessionCount: 0, questions: 0, correctAnswers: 0, accuracy: 0 };
      setDetails({ subject, metrics: metric, topics: metric.sessionCount ? [{ topic: "Conteúdo introdutório", sessionCount: metric.sessionCount, minutes: metric.minutes, questions: metric.questions, correctAnswers: metric.correctAnswers, accuracy: metric.accuracy, lastStudiedOn: today }] : [], recentSessions: metric.sessionCount ? [{ id: `demo-${subject.id}`, subjectId: subject.id, subjectName: subject.name, subjectColor: subject.color, topic: "Conteúdo introdutório", durationMinutes: 50, date: today, questions: 10, correctAnswers: 7, type: "FIRST_CONTACT", accuracy: 70, createdAt: new Date().toISOString() }] : [], reviews: metric.sessionCount ? [{ id: `demo-review-${subject.id}`, subjectId: subject.id, subjectName: subject.name, subjectColor: subject.color, title: "Revisar: Conteúdo introdutório", date: addDays(today, 3), type: "REVIEW", completed: false, origin: "AUTOMATIC_REVIEW" }] : [] }); setDetailsLoading(false); return;
    }
    const response = await fetch(`${API_URL}/subjects/${subject.id}`, { cache: "no-store" });
    if (response.ok) setDetails(await response.json()); setDetailsLoading(false);
  };
  const openArchived = async () => {
    if (isDemo) setArchived([{ id: "archived-demo", name: "Filosofia", color: "#4E9DE0", archived: true }]);
    else { const response = await fetch(`${API_URL}/subjects?includeArchived=true`, { cache: "no-store" }); if (response.ok) setArchived((await response.json()).filter((item: Subject) => item.archived)); }
    setArchivedOpen(true);
  };
  const filtered = subjects.filter(subject => subject.name.toLowerCase().includes(search.toLowerCase()));
  const maxMinutes = Math.max(1, ...effectiveMetrics.map(item => item.minutes));
  return <div className="page"><section className="page-title"><div><span className="eyebrow">SUA BASE DE CONHECIMENTO</span><h1>Disciplinas</h1><p>Organize o que você está estudando e acompanhe cada evolução.</p></div><div className="page-title-actions"><button className="secondary" onClick={openArchived}><Archive size={17} />Arquivadas</button><button className="primary" onClick={() => setModal("subject")}><Plus size={18} />Nova disciplina</button></div></section>
    <div className="search-box"><Search size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar disciplina" aria-label="Buscar disciplina" /></div>
    <section className="subject-grid">{filtered.map(subject => { const metric = effectiveMetrics.find(item => item.subjectId === subject.id); return <article className="subject-card" key={subject.id}><span className="subject-symbol" style={{ background: `${subject.color}18`, color: subject.color }}>{subject.name.charAt(0)}</span><div className="subject-actions"><button onClick={() => setEditing(subject)} aria-label={`Editar ${subject.name}`}><Pencil /></button><button onClick={() => setArchiving(subject)} aria-label={`Arquivar ${subject.name}`}><Archive /></button></div><h2>{subject.name}</h2><p>{formatMinutes(metric?.minutes ?? 0)} estudados</p><div className="subject-progress"><i style={{ transform: `scaleX(${Math.round((metric?.minutes ?? 0) / maxMinutes * 100) / 100})`, background: subject.color }} /></div><div className="subject-real-metrics"><small>{metric?.sessionCount ?? 0} sessões</small><small>{metric?.questions ? `${metric.accuracy}% de acerto` : "Sem questões"}</small></div><button className="subject-detail-link" onClick={() => openDetails(subject)}>Ver detalhes <ChevronRight /></button></article>; })}</section>
    {!filtered.length && <div className="inline-empty"><BookOpen /><strong>Nenhuma disciplina encontrada</strong><p>Ajuste a busca ou crie uma nova disciplina.</p></div>}
    {editing && <EditSubjectModal subject={editing} isDemo={isDemo} close={() => setEditing(null)} saved={(next) => { onUpdate(next); setEditing(null); }} />}
    {archiving && <ConfirmDialog title="Arquivar disciplina?" description={`${archiving.name} deixará de aparecer nos novos registros, mas todo o histórico será preservado.`} confirmLabel="Arquivar disciplina" tone="warning" close={() => setArchiving(null)} confirm={async () => { if (isDemo) { onArchive({ ...archiving, archived: true }); setArchiving(null); return; } const response = await fetch(`${API_URL}/subjects/${archiving.id}/archive`, { method: "PATCH" }); if (!response.ok) return; onArchive(await response.json()); setArchiving(null); }} />}
    {(details || detailsLoading) && <SubjectDetailsModal details={details} loading={detailsLoading} close={() => { setDetails(null); setDetailsLoading(false); }} />}
    {archivedOpen && <ArchivedSubjectsModal subjects={archived} close={() => setArchivedOpen(false)} restore={async (subject) => { let restored = { ...subject, archived: false }; if (!isDemo) { const response = await fetch(`${API_URL}/subjects/${subject.id}/restore`, { method: "PATCH" }); if (!response.ok) return; restored = await response.json(); } setArchived(current => current.filter(item => item.id !== subject.id)); onRestore(restored); }} />}
  </div>;
}

function SubjectDetailsModal({ details, loading, close }: { details: SubjectDetails | null; loading: boolean; close: () => void }) {
  if (loading || !details) return <div className="modal-backdrop" onMouseDown={close}><section className="modal subject-detail-modal" role="dialog" aria-modal="true" aria-labelledby="subject-detail-title" onMouseDown={event => event.stopPropagation()}><div className="metric-empty"><Clock3 /><strong>Carregando disciplina…</strong></div></section></div>;
  const reviews = [...(details.reviews ?? [])].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.completed ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });
  const reviewStatus = (review: Task) => review.completed ? "Concluída" : review.date < today ? "Atrasada" : "Agendada";
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal subject-detail-modal" role="dialog" aria-modal="true" aria-labelledby="subject-detail-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">VISÃO DA DISCIPLINA</span><h2 id="subject-detail-title">{details.subject.name}</h2></div><button className="icon-button" onClick={close} aria-label="Fechar"><X /></button></div><section className="subject-detail-summary"><article><Clock3 /><span><small>Tempo total</small><strong>{formatMinutes(details.metrics.minutes)}</strong></span></article><article><BookOpen /><span><small>Sessões</small><strong>{details.metrics.sessionCount}</strong></span></article><article><Target /><span><small>Acurácia</small><strong>{details.metrics.questions ? `${details.metrics.accuracy}%` : "—"}</strong></span></article></section><div className="subject-detail-columns"><section><div className="panel-heading"><div><h2>Assuntos estudados</h2><p>Consolidação de todo o histórico</p></div></div>{details.topics.length ? <div className="topic-list">{details.topics.map(topic => <article key={topic.topic.toLowerCase()}><i style={{ background: details.subject.color }} /><div><strong>{topic.topic}</strong><small>{topic.sessionCount} {topic.sessionCount === 1 ? "sessão" : "sessões"} · {formatMinutes(topic.minutes)}</small></div><span>{topic.questions ? `${topic.accuracy}%` : "—"}</span></article>)}</div> : <div className="compact-empty">Nenhum assunto registrado.</div>}</section><section><div className="panel-heading"><div><h2>Sessões recentes</h2><p>Últimos registros desta disciplina</p></div></div>{details.recentSessions.length ? <div className="detail-session-list">{details.recentSessions.map(session => <article key={session.id}><span>{new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}</span><div><strong>{session.topic}</strong><small>{formatMinutes(session.durationMinutes)} · {sessionTypeLabel(session.type)}</small></div></article>)}</div> : <div className="compact-empty">Nenhuma sessão registrada.</div>}</section></div><section className="subject-review-section"><div className="panel-heading"><div><h2>Revisões da disciplina</h2><p>Próximos retornos e revisões já concluídas</p></div><span className="subtle-badge">{reviews.filter(review => !review.completed).length} pendentes</span></div>{reviews.length ? <div className="subject-review-list">{reviews.map(review => <article key={review.id}><i style={{ background: details.subject.color }} /><div><strong>{review.title.replace(/^Revisar:\s*/, "")}</strong><small>Revisão automática</small></div><span className={`subject-review-status ${review.completed ? "done" : review.date < today ? "late" : "pending"}`}>{reviewStatus(review)}</span><time dateTime={review.date}>{formatShortDate(review.date)}</time></article>)}</div> : <div className="compact-empty">Nenhuma revisão agendada para esta disciplina.</div>}</section></section></div>;
}

function ArchivedSubjectsModal({ subjects, close, restore }: { subjects: Subject[]; close: () => void; restore: (subject: Subject) => Promise<void> }) {
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal archived-modal" role="dialog" aria-modal="true" aria-labelledby="archived-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">ORGANIZAÇÃO</span><h2 id="archived-title">Disciplinas arquivadas</h2></div><button className="icon-button" onClick={close} aria-label="Fechar"><X /></button></div>{subjects.length ? <div className="archived-list">{subjects.map(subject => <article key={subject.id}><span className="subject-symbol" style={{ background: `${subject.color}18`, color: subject.color }}>{subject.name[0]}</span><div><strong>{subject.name}</strong><small>Histórico preservado</small></div><button className="secondary" onClick={() => restore(subject)}><RotateCcw />Restaurar</button></article>)}</div> : <div className="metric-empty"><Archive /><strong>Nenhuma disciplina arquivada</strong><p>As disciplinas arquivadas aparecerão aqui.</p></div>}</section></div>;
}

function CalendarView({ tasks, subjects, isDemo, revision, toggleTask, openTaskModal, onTaskChanged, onTaskDeleted }: { tasks: Task[]; subjects: Subject[]; isDemo: boolean; revision: number; toggleTask: (id: string) => void; openTaskModal: (date: string) => void; onTaskChanged: (task: Task) => void; onTaskDeleted: (id: string) => void }) {
  const now = new Date(`${today}T12:00:00`);
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [loadedTasks, setLoadedTasks] = useState<Task[]>([]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  useEffect(() => {
    if (isDemo) return;
    fetch(`${API_URL}/tasks`, { cache: "no-store" }).then(async response => { if (response.ok) setLoadedTasks(await response.json()); });
  }, [isDemo, revision]);
  const sourceTasks = isDemo ? tasks : loadedTasks;
  const selectedTasks = sourceTasks.filter(task => task.date === selectedDate);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return { date, iso: toIsoDate(date), inMonth: date.getMonth() === month.getMonth() }; });
  const moveMonth = (amount: number) => { const next = new Date(month.getFullYear(), month.getMonth() + amount, 1); setMonth(next); setSelectedDate(toIsoDate(next)); };
  return <div className="page"><section className="page-title"><div><span className="eyebrow">SEU PLANO</span><h1>Calendário</h1><p>Selecione um dia para visualizar, concluir ou reorganizar suas tarefas.</p></div><button className="primary" onClick={() => openTaskModal(selectedDate)}><Plus size={18} />Nova tarefa</button></section>
    <section className="calendar-layout"><article className="panel calendar-panel"><div className="calendar-header"><button onClick={() => moveMonth(-1)} aria-label="Mês anterior">‹</button><h2>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2><button onClick={() => moveMonth(1)} aria-label="Próximo mês">›</button></div><div className="calendar-week">{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-days">{days.map(item => <button key={item.iso} onClick={() => { setSelectedDate(item.iso); if (!item.inMonth) setMonth(new Date(item.date.getFullYear(), item.date.getMonth(), 1)); }} className={`${!item.inMonth ? "muted" : ""} ${item.iso === today ? "today" : ""} ${item.iso === selectedDate ? "selected" : ""}`} aria-label={item.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}><span>{item.date.getDate()}</span>{sourceTasks.some(task => task.date === item.iso) && <i />}</button>)}</div></article>
      <article className="panel day-agenda"><div className="panel-heading"><div><h2>{selectedDate === today ? "Hoje" : "Agenda do dia"}</h2><p>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</p></div><span className="subtle-badge">{selectedTasks.length} {selectedTasks.length === 1 ? "tarefa" : "tarefas"}</span></div><div className="task-list">{selectedTasks.map(task => <TaskRow key={task.id} task={task} subject={subjects.find(subject => subject.id === task.subjectId)} toggle={() => { if (!isDemo) setLoadedTasks(current => current.map(item => item.id === task.id ? { ...item, completed: !item.completed } : item)); toggleTask(task.id); }} onEdit={() => setEditing(task)} onDelete={() => setDeleting(task)} />)}</div>{!selectedTasks.length && <div className="agenda-empty"><CalendarDays /><strong>Dia livre por enquanto</strong><p>Adicione uma tarefa quando quiser planejar este dia.</p><button className="text-button" onClick={() => openTaskModal(selectedDate)}><Plus />Criar tarefa</button></div>}</article>
    </section>
    {editing && <EditTaskModal task={editing} subjects={subjects} isDemo={isDemo} close={() => setEditing(null)} saved={(next) => { if (!isDemo) setLoadedTasks(current => current.map(item => item.id === next.id ? next : item)); onTaskChanged(next); setEditing(null); }} />}
    {deleting && <ConfirmDialog title="Excluir tarefa?" description={`“${deleting.title}” será removida do calendário. Sessões de estudo já registradas não serão afetadas.`} confirmLabel="Excluir tarefa" tone="danger" close={() => setDeleting(null)} confirm={async () => { if (!isDemo) { const response = await fetch(`${API_URL}/tasks/${deleting.id}`, { method: "DELETE" }); if (!response.ok) return; setLoadedTasks(current => current.filter(item => item.id !== deleting.id)); } onTaskDeleted(deleting.id); setDeleting(null); }} />}
  </div>;
}

type FocusPhase = "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";
function playCompletionTone() {
  try {
    const context = new AudioContext();
    [0, 0.18].forEach((delay, index) => {
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.frequency.value = index ? 880 : 660; gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.16);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(context.currentTime + delay); oscillator.stop(context.currentTime + delay + 0.18);
    });
    window.setTimeout(() => context.close(), 700);
  } catch { /* O aviso visual continua disponível quando o áudio não é suportado. */ }
}

function FocusView({ onSave, goalMinutes, studiedToday, initialSettings, onSettingsChange, persistSettings }: { onSave: (minutes: number) => void; goalMinutes: number; studiedToday: number; initialSettings: AccountPreferences; onSettingsChange: (settings: FocusSettings) => void; persistSettings: boolean }) {
  const [settings, setSettings] = useState(initialSettings);
  const [phase, setPhase] = useState<FocusPhase>("FOCUS");
  const [cycle, setCycle] = useState(1);
  const [duration, setDuration] = useState(defaultFocusSettings.focusMinutes * 60);
  const [remaining, setRemaining] = useState(defaultFocusSettings.focusMinutes * 60);
  const [running, setRunning] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [accumulatedFocusSeconds, setAccumulatedFocusSeconds] = useState(0);
  const [configuring, setConfiguring] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");
  const completionAlerted = useRef(false);
  const notifyPeriodComplete = useCallback(() => {
    const focusCompleted = phase === "FOCUS";
    const title = focusCompleted ? "Foco concluído" : "Pausa concluída";
    const message = focusCompleted ? "Registre sua sessão ou avance para a pausa." : "Seu próximo período está pronto para começar.";
    setCompletionNotice(`${title}. ${message}`);
    if (settings.soundEnabled) playCompletionTone();
    if (settings.browserNotifications && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: message, tag: "studyflow-timer" });
    }
  }, [phase, settings.browserNotifications, settings.soundEnabled]);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("studyflow-timer");
        if (!saved) return;
        const state = JSON.parse(saved) as { endsAt: number | null; remaining: number; duration: number; running: boolean; phase: FocusPhase; cycle: number; settings: FocusSettings; accumulatedFocusSeconds?: number };
        const next = state.running && state.endsAt ? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)) : state.remaining;
        const restoredSettings = { ...initialSettings, ...state.settings };
        setSettings(restoredSettings); setPhase(state.phase); setCycle(state.cycle); setDuration(state.duration);
        setAccumulatedFocusSeconds(Math.max(0, state.accumulatedFocusSeconds ?? 0));
        setRemaining(next); setEndsAt(next > 0 && state.running ? state.endsAt : null); setRunning(next > 0 && state.running);
        if (state.running && next === 0) {
          localStorage.setItem("studyflow-timer", JSON.stringify({ ...state, remaining: 0, running: false, endsAt: null }));
        }
      } catch { localStorage.removeItem("studyflow-timer"); }
    }, 0);
    return () => window.clearTimeout(restore);
  }, [initialSettings]);

  useEffect(() => {
    if (!running || !endsAt) return;
    const update = () => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false); setEndsAt(null);
        if (!completionAlerted.current) { completionAlerted.current = true; notifyPeriodComplete(); }
        localStorage.setItem("studyflow-timer", JSON.stringify({
          duration, phase, cycle, settings, accumulatedFocusSeconds, remaining: 0, running: false, endsAt: null,
        }));
      }
    };
    const interval = window.setInterval(update, 500); update();
    return () => window.clearInterval(interval);
  }, [running, endsAt, duration, phase, cycle, settings, accumulatedFocusSeconds, notifyPeriodComplete]);

  const store = useCallback((next: { running: boolean; endsAt: number | null; remaining: number; duration?: number; phase?: FocusPhase; cycle?: number; settings?: FocusSettings; accumulatedFocusSeconds?: number }) => localStorage.setItem("studyflow-timer", JSON.stringify({ duration, phase, cycle, settings, accumulatedFocusSeconds, ...next })), [accumulatedFocusSeconds, cycle, duration, phase, settings]);
  const toggle = () => {
    if (running) { const next = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : remaining; setRemaining(next); setRunning(false); setEndsAt(null); store({ running: false, endsAt: null, remaining: next }); }
    else { completionAlerted.current = false; setCompletionNotice(""); const nextEnd = Date.now() + remaining * 1000; setEndsAt(nextEnd); setRunning(true); store({ running: true, endsAt: nextEnd, remaining }); }
  };
  const reset = () => { completionAlerted.current = false; setCompletionNotice(""); setRunning(false); setEndsAt(null); setRemaining(duration); store({ running: false, endsAt: null, remaining: duration }); };
  const durationFor = useCallback((nextPhase: FocusPhase, nextSettings = settings) => (nextPhase === "FOCUS" ? nextSettings.focusMinutes : nextPhase === "SHORT_BREAK" ? nextSettings.shortBreakMinutes : nextSettings.longBreakMinutes) * 60, [settings]);
  const transition = useCallback((nextAccumulatedFocusSeconds: number) => {
    const nextPhase: FocusPhase = phase === "FOCUS" ? (cycle >= settings.cycles ? "LONG_BREAK" : "SHORT_BREAK") : "FOCUS";
    const nextCycle = phase === "FOCUS" ? cycle : phase === "LONG_BREAK" ? 1 : Math.min(settings.cycles, cycle + 1);
    const nextDuration = durationFor(nextPhase); completionAlerted.current = false; setCompletionNotice(""); setPhase(nextPhase); setCycle(nextCycle); setDuration(nextDuration); setRemaining(nextDuration); setRunning(false); setEndsAt(null); setAccumulatedFocusSeconds(nextAccumulatedFocusSeconds);
    store({ running: false, endsAt: null, remaining: nextDuration, duration: nextDuration, phase: nextPhase, cycle: nextCycle, accumulatedFocusSeconds: nextAccumulatedFocusSeconds });
  }, [cycle, durationFor, phase, settings.cycles, store]);
  const advance = useCallback(() => {
    const completedFocusSeconds = phase === "FOCUS" ? Math.max(0, duration - remaining) : 0;
    transition(accumulatedFocusSeconds + completedFocusSeconds);
  }, [accumulatedFocusSeconds, duration, phase, remaining, transition]);
  useEffect(() => {
    const handleSaved = () => transition(0);
    window.addEventListener("studyflow-focus-saved", handleSaved);
    return () => window.removeEventListener("studyflow-focus-saved", handleSaved);
  }, [transition]);
  const record = () => {
    const currentFocusSeconds = phase === "FOCUS" ? Math.max(0, duration - remaining) : 0;
    const minutes = Math.max(1, Math.round((accumulatedFocusSeconds + currentFocusSeconds) / 60));
    onSave(minutes);
  };
  const elapsedSeconds = duration - remaining;
  const angle = duration === 0 ? 0 : elapsedSeconds / duration * 360;
  const isFocus = phase === "FOCUS";
  const completed = remaining === 0;
  const hasPendingFocus = accumulatedFocusSeconds > 0;
  const completeAction = isFocus ? record : phase === "LONG_BREAK" && hasPendingFocus ? record : advance;
  const completeActionLabel = isFocus ? "Registrar sessão" : phase === "LONG_BREAK" && hasPendingFocus ? "Registrar sessão" : "Próximo período";
  const skipAction = isFocus && !completed ? record : phase === "LONG_BREAK" && hasPendingFocus ? record : advance;
  const skipActionLabel = isFocus ? (completed ? "Ir para a pausa sem registrar" : "Encerrar e registrar") : phase === "LONG_BREAK" && hasPendingFocus ? "Pular pausa e registrar sessão" : "Pular pausa";
  const phaseLabel = isFocus ? "Foco" : phase === "SHORT_BREAK" ? "Pausa curta" : "Pausa longa";
  const goalPercent = Math.min(100, Math.round(studiedToday / goalMinutes * 100));
  return <div className={`focus-page ${!isFocus ? "break-phase" : ""}`}><div className="focus-card"><button className="focus-config" onClick={() => setConfiguring(true)} disabled={running} aria-label="Configurar ciclos"><SlidersHorizontal />Configurar</button><span className="eyebrow">{phaseLabel.toUpperCase()} · CICLO {cycle} DE {settings.cycles}</span><h1>{isFocus ? "Hora de mergulhar." : "Respire um pouco."}</h1><p>{isFocus ? "Silencie o ruído. Este momento é seu." : "Uma pausa consciente também faz parte do progresso."}</p><div className="focus-phases">{Array.from({ length: settings.cycles }, (_, index) => <span key={index} className={index + 1 < cycle || (index + 1 === cycle && elapsedSeconds > 0) ? "done" : index + 1 === cycle ? "current" : ""}>{index + 1}</span>)}</div><div className="timer-ring" style={{ background: `conic-gradient(${isFocus ? "var(--purple)" : "var(--green)"} ${angle}deg, #ebe9f5 ${angle}deg)` }}><div>{isFocus ? <Clock3 /> : <Coffee />}<strong>{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</strong><span>{running ? `${phaseLabel.toLowerCase()} em andamento` : completed ? "período concluído" : elapsedSeconds ? "pausado" : "pronto para começar"}</span></div></div>{hasPendingFocus && <div className="focus-accumulated"><Clock3 />{formatMinutes(Math.max(1, Math.round(accumulatedFocusSeconds / 60)))} de foco aguardando registro</div>}{completionNotice && <div className="focus-complete-banner" role="status"><Bell />{completionNotice}</div>}<div className="timer-actions"><button className="icon-button large" onClick={reset} aria-label="Reiniciar período"><TimerReset /></button>{completed ? <button className="focus-start" onClick={completeAction}>{completeActionLabel}</button> : <button className="focus-start" onClick={toggle}>{running ? "Pausar" : elapsedSeconds ? "Continuar" : "Começar"}</button>}<button className="icon-button large" onClick={skipAction} disabled={isFocus && elapsedSeconds < 60} aria-label={skipActionLabel} title={skipActionLabel}>{isFocus && !completed ? <Check /> : <ChevronRight />}</button></div><div className="focus-goal"><div><Target /><span><strong>Meta do dia</strong><small>{formatMinutes(studiedToday)} de {formatMinutes(goalMinutes)}</small></span></div><strong>{goalPercent}%</strong></div></div>
    {configuring && <div className="modal-backdrop" onMouseDown={() => setConfiguring(false)}><section className="modal focus-settings-modal" role="dialog" aria-modal="true" aria-labelledby="focus-settings-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">SEU RITMO</span><h2 id="focus-settings-title">Configurar ciclos</h2></div><button className="icon-button" onClick={() => setConfiguring(false)} aria-label="Fechar"><X /></button></div><form onSubmit={async (event) => { event.preventDefault(); setSettingsError(""); const data = new FormData(event.currentTarget); let browserNotifications = data.get("browserNotifications") === "on"; if (browserNotifications && "Notification" in window && Notification.permission !== "granted") browserNotifications = await Notification.requestPermission() === "granted"; let next: AccountPreferences = { ...initialSettings, focusMinutes: Number(data.get("focusMinutes")), shortBreakMinutes: Number(data.get("shortBreakMinutes")), longBreakMinutes: Number(data.get("longBreakMinutes")), cycles: Number(data.get("cycles")), soundEnabled: data.get("soundEnabled") === "on", browserNotifications }; if (persistSettings) { const response = await fetch(`${API_URL}/preferences`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...initialSettings, ...next }) }); const payload = await response.json(); if (!response.ok) { setSettingsError(payload.message ?? "Não foi possível salvar as preferências."); return; } next = payload; } const nextDuration = durationFor("FOCUS", next); completionAlerted.current = false; setCompletionNotice(""); setSettings(next); onSettingsChange(next); setPhase("FOCUS"); setCycle(1); setDuration(nextDuration); setRemaining(nextDuration); setRunning(false); setEndsAt(null); setAccumulatedFocusSeconds(0); store({ running: false, endsAt: null, remaining: nextDuration, duration: nextDuration, phase: "FOCUS", cycle: 1, settings: next, accumulatedFocusSeconds: 0 }); setConfiguring(false); }}><div className="form-row"><label>Foco (min)<input name="focusMinutes" type="number" min="1" max="180" defaultValue={settings.focusMinutes} required /></label><label>Pausa curta (min)<input name="shortBreakMinutes" type="number" min="1" max="60" defaultValue={settings.shortBreakMinutes} required /></label></div><div className="form-row"><label>Pausa longa (min)<input name="longBreakMinutes" type="number" min="1" max="120" defaultValue={settings.longBreakMinutes} required /></label><label>Ciclos<input name="cycles" type="number" min="1" max="8" defaultValue={settings.cycles} required /></label></div><fieldset className="focus-alert-options"><legend>Avisos ao concluir</legend><label><input type="checkbox" name="soundEnabled" defaultChecked={settings.soundEnabled} /><span><strong>Som do temporizador</strong><small>Emite dois toques ao terminar foco ou pausa.</small></span></label><label><input type="checkbox" name="browserNotifications" defaultChecked={settings.browserNotifications} /><span><strong>Notificação do navegador</strong><small>O navegador solicitará sua permissão ao ativar.</small></span></label></fieldset><p className="focus-settings-note">Ao concluir um foco, você complementa disciplina, assunto e questões antes de salvar.</p>{settingsError && <p className="form-error">{settingsError}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setConfiguring(false)}>Cancelar</button><button className="primary">Aplicar configuração</button></div></form></section></div>}
  </div>;
}

function ReviewsView({ isDemo, subjects, revision, onChanged }: { isDemo: boolean; subjects: Subject[]; revision: number; onChanged: () => void }) {
  const demoProgress: TopicProgress[] = [{ subjectId: "math", subjectName: "Matemática", subjectColor: "#7567F8", topic: "Funções e gráficos", answeredSessions: 2, questions: 20, correctAnswers: 15, accuracy: 75, latestAccuracy: 80, trend: 10, status: "PROGRESS", lastStudiedOn: today, pendingReviewTaskId: "t1", nextReviewDate: today, history: [{ sessionId: "demo-1", date: today, questions: 10, correctAnswers: 8, accuracy: 80, type: "REVIEW" }] }];
  const [reviews, setReviews] = useState<Task[]>(isDemo ? demoTasks.filter(task => task.type === "Revisão") : []);
  const [progress, setProgress] = useState<TopicProgress[]>(isDemo ? demoProgress : []);
  const [filter, setFilter] = useState<"PENDING" | "OVERDUE" | "DONE">("PENDING");
  const [editing, setEditing] = useState<Task | null>(null);
  const [removing, setRemoving] = useState<Task | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isDemo);
  const load = () => {
    if (isDemo) return;
    Promise.all([fetch(`${API_URL}/reviews`, { cache: "no-store" }), fetch(`${API_URL}/reviews/progress`, { cache: "no-store" })])
      .then(async ([reviewResponse, progressResponse]) => {
        if (!reviewResponse.ok || !progressResponse.ok) throw new Error();
        const [nextReviews, nextProgress] = await Promise.all([reviewResponse.json(), progressResponse.json()]);
        setReviews(nextReviews); setProgress(nextProgress);
      }).finally(() => setLoading(false));
  };
  useEffect(load, [isDemo, revision]);
  const overdue = reviews.filter(item => !item.completed && item.date < today).length;
  const upcoming = reviews.filter(item => !item.completed && item.date >= today).length;
  const completed = reviews.filter(item => item.completed).length;
  const visible = reviews.filter(item => filter === "DONE" ? item.completed : filter === "OVERDUE" ? !item.completed && item.date < today : !item.completed && item.date >= today);
  const reopen = async (task: Task) => {
    if (!isDemo) {
      const response = await fetch(`${API_URL}/tasks/${task.id}/toggle`, { method: "PATCH" });
      if (!response.ok) return;
    }
    setReviews(current => current.map(item => item.id === task.id ? { ...item, completed: false } : item)); onChanged();
  };
  const remove = async (task: Task) => {
    if (!isDemo) await fetch(`${API_URL}/tasks/${task.id}`, { method: "DELETE" });
    setReviews(current => current.filter(item => item.id !== task.id)); setRemoving(null); onChanged();
  };
  const statusLabel = (status: TopicProgress["status"]) => status === "DIFFICULTY" ? "Em dificuldade" : status === "MASTERED" ? "Dominado" : "Em progresso";
  const progressCounts = progress.reduce((counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }), { DIFFICULTY: 0, PROGRESS: 0, MASTERED: 0 });
  return <div className="page reviews-page"><section className="page-title"><div><span className="eyebrow">MEMÓRIA EM DIA</span><h1>Central de revisões</h1><p>Acompanhe o que precisa voltar ao seu radar e mantenha o conteúdo vivo.</p></div></section>
    <section className="review-summary"><button className={filter === "PENDING" ? "active" : ""} onClick={() => setFilter("PENDING")}><span className="review-summary-icon purple"><CalendarDays /></span><small>Próximas</small><strong>{upcoming}</strong></button><button className={filter === "OVERDUE" ? "active" : ""} onClick={() => setFilter("OVERDUE")}><span className="review-summary-icon orange"><AlertCircle /></span><small>Atrasadas</small><strong>{overdue}</strong></button><button className={filter === "DONE" ? "active" : ""} onClick={() => setFilter("DONE")}><span className="review-summary-icon green"><Check /></span><small>Concluídas</small><strong>{completed}</strong></button></section>
    <section className="panel record-panel"><div className="panel-heading"><div><h2>{filter === "PENDING" ? "Próximas revisões" : filter === "OVERDUE" ? "Revisões atrasadas" : "Revisões concluídas"}</h2><p>{visible.length} {visible.length === 1 ? "item" : "itens"} nesta lista</p></div></div>{loading ? <div className="metric-empty"><Clock3 /><strong>Carregando revisões…</strong></div> : visible.length === 0 ? <div className="metric-empty"><RotateCcw /><strong>Nada pendente por aqui</strong><p>As revisões automáticas aparecerão após sessões com questões.</p></div> : <div className="record-list">{visible.map(task => <article className="review-row" key={task.id}><button className={`task-check ${task.completed ? "checked" : ""}`} onClick={() => task.completed ? reopen(task) : setCompleting(task)} aria-label={task.completed ? "Reabrir revisão" : "Concluir revisão"}>{task.completed && <Check />}</button><i style={{ background: task.subjectColor ?? subjects.find(subject => subject.id === task.subjectId)?.color }} /><div><strong>{task.title.replace(/^Revisar:\s*/, "")}</strong><small>{task.subjectName ?? subjects.find(subject => subject.id === task.subjectId)?.name} · revisão automática</small></div><span className={task.date < today && !task.completed ? "date-pill late" : "date-pill"}>{formatShortDate(task.date)}</span><div className="record-actions"><button className="icon-button" onClick={() => setEditing(task)} aria-label="Reagendar"><Pencil /></button><button className="icon-button danger-icon" onClick={() => setRemoving(task)} aria-label="Cancelar revisão"><Trash2 /></button></div></article>)}</div>}</section>
    <section className="review-progress-section"><div className="review-progress-heading"><div className="panel-heading"><div><h2>Evolução por assunto</h2><p>O domínio considera seu resultado mais recente e o histórico acumulado.</p></div></div>{progress.length > 0 && <div className="review-progress-overview"><span><i className="difficulty" />{progressCounts.DIFFICULTY} em dificuldade</span><span><i className="developing" />{progressCounts.PROGRESS} em progresso</span><span><i className="mastered" />{progressCounts.MASTERED} dominados</span></div>}</div>{!loading && progress.length === 0 ? <div className="metric-empty"><BarChart3 /><strong>Responda questões para acompanhar sua evolução</strong></div> : <div className="review-progress-grid">{progress.map(item => { const key = `${item.subjectId}-${item.topic}`; const isExpanded = expanded === key; return <article className={`review-progress-card status-${item.status.toLowerCase()}`} key={key}><button className="review-progress-main" onClick={() => setExpanded(current => current === key ? null : key)} aria-expanded={isExpanded}><span className="mastery-badge">{statusLabel(item.status)}</span><div className="review-progress-title"><i style={{ background: item.subjectColor }} /><span><strong>{item.topic}</strong><small>{item.subjectName}</small></span></div><div className="review-progress-metrics"><span><strong>{item.latestAccuracy}%</strong><small>último resultado</small></span><span><strong>{item.trend == null ? "—" : `${item.trend > 0 ? "+" : ""}${item.trend} p.p.`}</strong><small>tendência</small></span><span><strong>{item.answeredSessions}</strong><small>tentativas</small></span></div><div className="review-progress-footer"><small>{item.nextReviewDate ? `Próxima em ${formatShortDate(item.nextReviewDate)}` : "Sem revisão pendente"}</small><ChevronRight className={isExpanded ? "expanded" : ""} /></div></button>{isExpanded && <div className="review-history"><strong>Histórico de resultados</strong>{item.history.map(attempt => <div key={attempt.sessionId}><span>{formatShortDate(attempt.date)}</span><span>{sessionTypeLabel(attempt.type)}</span><span>{attempt.correctAnswers}/{attempt.questions} questões</span><b>{attempt.accuracy}%</b></div>)}</div>}</article>; })}</div>}</section>
    {editing && <EditTaskModal task={editing} subjects={subjects} isDemo={isDemo} close={() => setEditing(null)} saved={(next) => { setReviews(current => current.map(item => item.id === next.id ? next : item)); setEditing(null); onChanged(); }} />}
    {removing && <ConfirmDialog title="Cancelar esta revisão?" description="Ela sairá da sua programação, mas a sessão de estudo que a originou continuará no histórico." confirmLabel="Cancelar revisão" tone="danger" close={() => setRemoving(null)} confirm={() => remove(removing)} />}
    {completing && <CompleteReviewModal task={completing} isDemo={isDemo} close={() => setCompleting(null)} completed={(done, next) => { setReviews(current => [...current.filter(item => item.id !== done.id), done, ...(next ? [next] : [])]); setCompleting(null); onChanged(); }} />}
  </div>;
}

function CompleteReviewModal({ task, isDemo, close, completed }: { task: Task; isDemo: boolean; close: () => void; completed: (task: Task, next: Task | null) => void }) {
  const [choice, setChoice] = useState("7");
  const [customDate, setCustomDate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setError("");
    const data = new FormData(event.currentTarget);
    const durationMinutes = Number(data.get("durationMinutes"));
    const questions = Number(data.get("questions"));
    const correctAnswers = Number(data.get("correctAnswers"));
    const studiedOn = String(data.get("studiedOn") ?? today);
    const nextReviewDate = choice === "none" ? null : choice === "custom" ? customDate : addDays(today, Number(choice));
    if (choice === "custom" && !customDate) { setError("Escolha a data da próxima revisão."); setSubmitting(false); return; }
    if (durationMinutes === 0 && questions === 0) { setError("Informe o tempo estudado, as questões respondidas ou ambos."); setSubmitting(false); return; }
    if (correctAnswers > questions) { setError("Os acertos não podem ser maiores que o total de questões."); setSubmitting(false); return; }
    try {
      if (isDemo) { completed({ ...task, completed: true }, nextReviewDate ? { ...task, id: `demo-next-${Date.now()}`, date: nextReviewDate, completed: false } : null); return; }
      const response = await fetch(`${API_URL}/reviews/${task.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nextReviewDate, studiedOn, durationMinutes, questions, correctAnswers }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Não foi possível concluir a revisão.");
      completed(payload.completedReview, payload.nextReview);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível concluir a revisão."); } finally { setSubmitting(false); }
  };
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal complete-review-modal" role="dialog" aria-modal="true" aria-labelledby="complete-review-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">CONTINUIDADE</span><h2 id="complete-review-title">Concluir revisão</h2></div><button className="icon-button" onClick={close} aria-label="Fechar"><X /></button></div><p className="complete-review-topic">Registre o que foi feito em <strong>{task.title.replace(/^Revisar:\s*/, "")}</strong> e defina quando o assunto deve voltar.</p><form onSubmit={submit}><section className="review-result-section"><div className="form-section-heading"><span><Clock3 /></span><div><strong>Resultado da revisão</strong><small>Tempo e questões entram no histórico e nas suas métricas.</small></div></div><DateField label="Data do estudo" name="studiedOn" defaultValue={today} max={today} /><div className="form-row three"><label>Duração (min)<input name="durationMinutes" type="number" min="0" max="1440" defaultValue="30" required /></label><label>Questões<input name="questions" type="number" min="0" defaultValue="0" required /></label><label>Acertos<input name="correctAnswers" type="number" min="0" defaultValue="0" required /></label></div><p className="review-result-note"><Sparkles />Você pode registrar apenas tempo, apenas questões ou os dois.</p></section><section className="review-schedule-section"><div className="form-section-heading"><span><RotateCcw /></span><div><strong>Próxima revisão</strong><small>Escolha um intervalo ou uma data específica.</small></div></div><div className="review-next-options">{[["1", "Amanhã"], ["3", "Em 3 dias"], ["7", "Em 7 dias"], ["15", "Em 15 dias"], ["none", "Não agendar"], ["custom", "Escolher data"]].map(([value, label]) => <label key={value} className={choice === value ? "selected" : ""}><input type="radio" name="nextReview" value={value} checked={choice === value} onChange={() => setChoice(value)} /><span className="review-option-dot"><i /></span><span>{label}</span></label>)}</div>{choice === "custom" && <DateField label="Data personalizada" min={addDays(today, 1)} value={customDate} onChange={setCustomDate} />}</section>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button className="primary" disabled={submitting}>{submitting ? "Concluindo…" : "Concluir e registrar"}</button></div></form></section></div>;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10);
}

type SelectOption = { value: string; label: string };

type FloatingPosition = { top: number; left: number; width: number; placement: "top" | "bottom" };

function getFloatingPosition(trigger: HTMLElement, preferredWidth: number, estimatedHeight: number): FloatingPosition {
  const viewportGutter = 12;
  const triggerGap = 7;
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(preferredWidth, window.innerWidth - viewportGutter * 2);
  const left = Math.min(Math.max(viewportGutter, rect.left), window.innerWidth - width - viewportGutter);
  const hasRoomBelow = rect.bottom + triggerGap + estimatedHeight <= window.innerHeight - viewportGutter;
  return {
    top: hasRoomBelow ? rect.bottom + triggerGap : Math.max(viewportGutter, rect.top - triggerGap - estimatedHeight),
    left,
    width,
    placement: hasRoomBelow ? "bottom" : "top",
  };
}

function AppSelect({ label, name, options, value, defaultValue, onChange }: { label: string; name?: string; options: SelectOption[]; value?: string; defaultValue?: string; onChange?: (value: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const selectedValue = value ?? internalValue;
  const selected = options.find(option => option.value === selectedValue) ?? options[0];
  const updatePosition = useCallback(() => {
    if (!trigger.current) return;
    const menuHeight = Math.min(240, options.length * 38 + 12);
    setPosition(getFloatingPosition(trigger.current, trigger.current.getBoundingClientRect().width, menuHeight));
  }, [options.length]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !surface.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);
  const choose = (next: string) => { setInternalValue(next); onChange?.(next); setOpen(false); };
  const toggle = () => { if (open) setOpen(false); else { updatePosition(); setOpen(true); } };
  return <div className="app-field app-select-root" ref={root}><span className="app-field-label">{label}</span>{name && <input type="hidden" name={name} value={selectedValue} />}<button ref={trigger} type="button" className="app-field-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={toggle}><span>{selected?.label}</span><ChevronDown /></button>{open && position && typeof document !== "undefined" && createPortal(<div ref={surface} className="app-select-menu app-floating-surface" data-placement={position.placement} style={{ top: position.top, left: position.left, width: position.width }} role="listbox" aria-label={label}>{options.map(option => <button type="button" role="option" aria-selected={option.value === selectedValue} className={option.value === selectedValue ? "selected" : ""} key={option.value} onClick={() => choose(option.value)}><span>{option.label}</span>{option.value === selectedValue && <Check />}</button>)}</div>, document.body)}</div>;
}

function isoLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DateField({ label, name, value, defaultValue, min, max, onChange }: { label: string; name?: string; value?: string; defaultValue?: string; min?: string; max?: string; onChange?: (value: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const selectedValue = value ?? internalValue;
  const initial = selectedValue || min || today;
  const [visibleMonth, setVisibleMonth] = useState(() => { const date = new Date(`${initial}T12:00:00`); return new Date(date.getFullYear(), date.getMonth(), 1, 12); });
  const updatePosition = useCallback(() => {
    if (!trigger.current) return;
    setPosition(getFloatingPosition(trigger.current, 300, 342));
  }, []);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !surface.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1, 12);
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  const choose = (next: string) => { setInternalValue(next); onChange?.(next); setOpen(false); };
  const display = selectedValue ? new Date(`${selectedValue}T12:00:00`).toLocaleDateString("pt-BR") : "dd/mm/aaaa";
  const canUseToday = (!min || today >= min) && (!max || today <= max);
  const toggle = () => { if (open) setOpen(false); else { updatePosition(); setOpen(true); } };
  return <div className="app-field app-date-root" ref={root}><span className="app-field-label">{label}</span>{name && <input type="hidden" name={name} value={selectedValue} />}<button ref={trigger} type="button" className="app-field-trigger app-date-trigger" aria-label={`${label}: ${display}`} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}><span className={selectedValue ? "" : "placeholder"}>{display}</span><CalendarDays /></button>{open && position && typeof document !== "undefined" && createPortal(<div ref={surface} className="app-date-popover app-floating-surface" data-placement={position.placement} style={{ top: position.top, left: position.left, width: position.width }} role="dialog" aria-label={`Escolher ${label.toLowerCase()}`}><div className="app-date-heading"><button type="button" aria-label="Mês anterior" onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1, 12))}><ChevronLeft /></button><strong>{visibleMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><button type="button" aria-label="Próximo mês" onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1, 12))}><ChevronRight /></button></div><div className="app-date-week">{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="app-date-grid">{days.map(date => { const iso = isoLocal(date); const disabled = (!!min && iso < min) || (!!max && iso > max); const outside = date.getMonth() !== visibleMonth.getMonth(); return <button type="button" key={iso} disabled={disabled} className={`${outside ? "outside" : ""} ${iso === today ? "today" : ""} ${iso === selectedValue ? "selected" : ""}`} aria-label={date.toLocaleDateString("pt-BR")} aria-pressed={iso === selectedValue} onClick={() => choose(iso)}>{date.getDate()}</button>; })}</div><div className="app-date-footer"><button type="button" disabled={!selectedValue} onClick={() => choose("")}>Limpar</button><button type="button" disabled={!canUseToday} onClick={() => choose(today)}>Hoje</button></div></div>, document.body)}</div>;
}


function SessionHistoryView({ isDemo, subjects, onChanged }: { isDemo: boolean; subjects: Subject[]; onChanged: () => void }) {
  const demoSessions: StudySession[] = [{ id: "demo-session", subjectId: "math", subjectName: "Matemática", subjectColor: "#7567F8", topic: "Funções e gráficos", durationMinutes: 50, date: today, questions: 10, correctAnswers: 7, type: "FIRST_CONTACT", accuracy: 70, createdAt: new Date().toISOString() }];
  const [sessions, setSessions] = useState<StudySession[]>(isDemo ? demoSessions : []);
  const [subjectId, setSubjectId] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [editing, setEditing] = useState<StudySession | null>(null);
  const [removing, setRemoving] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(!isDemo);
  const load = () => {
    if (isDemo) return;
    const query = new URLSearchParams(); if (subjectId) query.set("subjectId", subjectId); if (from) query.set("from", from); if (to) query.set("to", to);
    fetch(`${API_URL}/sessions?${query}`, { cache: "no-store" }).then(async response => { if (!response.ok) throw new Error(); setSessions(await response.json()); }).finally(() => setLoading(false));
  };
  useEffect(load, [isDemo, subjectId, from, to]);
  const remove = async (session: StudySession) => {
    if (!isDemo) await fetch(`${API_URL}/sessions/${session.id}`, { method: "DELETE" });
    setSessions(current => current.filter(item => item.id !== session.id)); setRemoving(null); onChanged();
  };
  const totalMinutes = sessions.reduce((sum, item) => sum + item.durationMinutes, 0);
  const totalQuestions = sessions.reduce((sum, item) => sum + item.questions, 0);
  const totalCorrect = sessions.reduce((sum, item) => sum + item.correctAnswers, 0);
  return <div className="page history-page"><section className="page-title"><div><span className="eyebrow">SUA TRAJETÓRIA</span><h1>Histórico de estudos</h1><p>Consulte, corrija ou remova registros sem perder a visão do seu progresso.</p></div></section>
    <section className="history-summary"><article><Clock3 /><span><small>Tempo no período</small><strong>{formatMinutes(totalMinutes)}</strong></span></article><article><BookOpen /><span><small>Questões</small><strong>{totalQuestions}</strong></span></article><article><Target /><span><small>Aproveitamento</small><strong>{totalQuestions ? Math.round(totalCorrect * 100 / totalQuestions) : 0}%</strong></span></article></section>
    <section className="panel history-filters"><AppSelect label="Disciplina" value={subjectId} onChange={setSubjectId} options={[{ value: "", label: "Todas" }, ...subjects.map(subject => ({ value: subject.id, label: subject.name }))]} /><DateField label="De" value={from} onChange={setFrom} max={to || undefined} /><DateField label="Até" value={to} min={from || undefined} onChange={setTo} />{(subjectId || from || to) && <button className="secondary" onClick={() => { setSubjectId(""); setFrom(""); setTo(""); }}>Limpar filtros</button>}</section>
    <section className="panel record-panel">{loading ? <div className="metric-empty"><Clock3 /><strong>Carregando histórico…</strong></div> : sessions.length === 0 ? <div className="metric-empty"><History /><strong>Nenhuma sessão encontrada</strong><p>Registre uma sessão de estudos ou ajuste os filtros.</p></div> : <div className="record-list">{sessions.map(session => <article className="session-row" key={session.id}><span className="session-date"><strong>{new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit" })}</strong><small>{new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small></span><i style={{ background: session.subjectColor }} /><div className="session-main"><strong>{session.topic}</strong><small>{session.subjectName} · {sessionTypeLabel(session.type)}</small></div><div className="session-metric"><strong>{formatMinutes(session.durationMinutes)}</strong><small>duração</small></div><div className="session-metric"><strong>{session.questions ? `${session.correctAnswers}/${session.questions}` : "—"}</strong><small>{session.questions ? `${session.accuracy}% de acerto` : "sem questões"}</small></div><div className="record-actions"><button className="icon-button" onClick={() => setEditing(session)} aria-label="Editar sessão"><Pencil /></button><button className="icon-button danger-icon" onClick={() => setRemoving(session)} aria-label="Excluir sessão"><Trash2 /></button></div></article>)}</div>}</section>
    {editing && <EditSessionModal session={editing} subjects={subjects} isDemo={isDemo} close={() => setEditing(null)} saved={(next) => { setSessions(current => current.map(item => item.id === next.id ? next : item)); setEditing(null); onChanged(); }} />}
    {removing && <ConfirmDialog title="Excluir esta sessão?" description="Os indicadores serão recalculados e a revisão automática ainda pendente também será removida. Esta ação não pode ser desfeita." confirmLabel="Excluir sessão" tone="danger" close={() => setRemoving(null)} confirm={() => remove(removing)} />}
  </div>;
}

function EditSessionModal({ session, subjects, isDemo, close, saved }: { session: StudySession; subjects: Subject[]; isDemo: boolean; close: () => void; saved: (session: StudySession) => void }) {
  const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setError(""); const data = new FormData(event.currentTarget);
    const questions = Number(data.get("questions")); const correctAnswers = Number(data.get("correctAnswers"));
    if (correctAnswers > questions) { setError("Os acertos não podem superar o total de questões."); setSubmitting(false); return; }
    const subject = subjects.find(item => item.id === String(data.get("subjectId")));
    const body = { subjectId: String(data.get("subjectId")), topic: String(data.get("topic")), durationMinutes: Number(data.get("durationMinutes")), date: String(data.get("date")), questions, correctAnswers, type: String(data.get("type")) };
    const local = { ...session, ...body, subjectName: subject?.name ?? session.subjectName, subjectColor: subject?.color ?? session.subjectColor, accuracy: questions ? Math.round(correctAnswers * 100 / questions) : 0 };
    try { if (isDemo) { saved(local); return; } const response = await fetch(`${API_URL}/sessions/${session.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!response.ok) { const payload = await response.json(); throw new Error(payload.message); } saved(await response.json()); } catch (caught) { setError(caught instanceof Error && caught.message ? caught.message : "Não foi possível atualizar a sessão."); } finally { setSubmitting(false); }
  };
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-session-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">CORRIGIR REGISTRO</span><h2 id="edit-session-title">Editar sessão</h2></div><button className="icon-button" onClick={close} aria-label="Fechar"><X /></button></div><form onSubmit={submit}><AppSelect label="Disciplina" name="subjectId" defaultValue={session.subjectId} options={subjects.map(subject => ({ value: subject.id, label: subject.name }))} /><label>Assunto estudado<input name="topic" defaultValue={session.topic} required maxLength={120} /></label><div className="form-row"><AppSelect label="Tipo" name="type" defaultValue={session.type} options={[{ value: "FIRST_CONTACT", label: "Primeiro contato" }, { value: "REVIEW", label: "Revisão" }, { value: "MOCK_EXAM", label: "Simulado" }, { value: "OTHER", label: "Outro" }]} /><DateField label="Data" name="date" defaultValue={session.date} max={today} /></div><div className="form-row three"><label>Duração (min)<input name="durationMinutes" type="number" min="1" max="1440" defaultValue={session.durationMinutes} required /></label><label>Questões<input name="questions" type="number" min="0" defaultValue={session.questions} required /></label><label>Acertos<input name="correctAnswers" type="number" min="0" defaultValue={session.correctAnswers} required /></label></div><p className="review-rule-note"><Sparkles />Se o resultado mudar, a revisão automática pendente será recalculada.</p>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button className="primary" disabled={submitting}>{submitting ? "Salvando…" : "Salvar alterações"}</button></div></form></section></div>;
}

function EditSubjectModal({ subject, isDemo, close, saved }: { subject: Subject; isDemo: boolean; close: () => void; saved: (subject: Subject) => void }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setError(""); const data = new FormData(event.currentTarget);
    const local = { ...subject, name: String(data.get("name")), color: String(data.get("color")) };
    try {
      if (isDemo) { saved(local); return; }
      const response = await fetch(`${API_URL}/subjects/${subject.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(local) });
      if (response.ok) { saved(await response.json()); return; }
      const payload = await response.json(); setError(payload.message ?? "Não foi possível atualizar a disciplina.");
    } catch { setError("O servidor está indisponível."); }
    finally { setSubmitting(false); }
  };
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-subject-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">ORGANIZAÇÃO</span><h2 id="edit-subject-title">Editar disciplina</h2></div><button className="icon-button" onClick={close} aria-label="Fechar"><X /></button></div><form onSubmit={submit}><label>Nome da disciplina<input name="name" required maxLength={80} defaultValue={subject.name} autoFocus /></label><fieldset><legend>Cor</legend><div className="color-options">{palette.map(color => <label key={color} style={{ background: color }}><input type="radio" name="color" value={color} defaultChecked={color === subject.color} /><span><Check /></span></label>)}</div></fieldset>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button className="primary" disabled={submitting}>{submitting ? "Salvando…" : "Salvar alterações"}</button></div></form></section></div>;
}

function EditTaskModal({ task, subjects, isDemo, close, saved }: { task: Task; subjects: Subject[]; isDemo: boolean; close: () => void; saved: (task: Task) => void }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setError(""); const data = new FormData(event.currentTarget);
    const subject = subjects.find(item => item.id === String(data.get("subjectId")));
    const local = { ...task, subjectId: String(data.get("subjectId")), subjectName: subject?.name, subjectColor: subject?.color, title: String(data.get("title")), date: String(data.get("date")), type: String(data.get("type")) };
    try {
      if (isDemo) { saved(local); return; }
      const response = await fetch(`${API_URL}/tasks/${task.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(local) });
      if (response.ok) { saved(await response.json()); return; }
      const payload = await response.json(); setError(payload.message ?? "Não foi possível atualizar a tarefa.");
    } catch { setError("O servidor está indisponível."); }
    finally { setSubmitting(false); }
  };
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-task-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">REORGANIZAR</span><h2 id="edit-task-title">Editar tarefa</h2></div><button className="icon-button" onClick={close} aria-label="Fechar"><X /></button></div><form onSubmit={submit}><AppSelect label="Disciplina" name="subjectId" defaultValue={task.subjectId} options={subjects.filter(subject => !subject.archived || subject.id === task.subjectId).map(subject => ({ value: subject.id, label: subject.name }))} /><label>Título da tarefa<input name="title" defaultValue={task.title} required maxLength={120} autoFocus /></label><div className="form-row"><DateField label="Data" name="date" defaultValue={task.date} /><AppSelect label="Tipo" name="type" defaultValue={normalizeTaskType(task.type)} options={[{ value: "FIRST_CONTACT", label: "Primeiro contato" }, { value: "REVIEW", label: "Revisão" }, { value: "EXAM", label: "Prova ou simulado" }, { value: "GENERAL", label: "Geral" }]} /></div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button className="primary" disabled={submitting}>{submitting ? "Salvando…" : "Salvar alterações"}</button></div></form></section></div>;
}

function ConfirmDialog({ title, description, confirmLabel, tone, close, confirm }: { title: string; description: string; confirmLabel: string; tone: "warning" | "danger"; close: () => void; confirm: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={event => event.stopPropagation()}><span className={`confirm-icon ${tone}`}>{tone === "danger" ? <Trash2 /> : <Archive />}</span><h2 id="confirm-title">{title}</h2><p>{description}</p><div className="modal-actions"><button className="secondary" onClick={close}>Cancelar</button><button className={`confirm-button ${tone}`} disabled={submitting} onClick={async () => { setSubmitting(true); await confirm(); setSubmitting(false); }}>{submitting ? "Aguarde…" : confirmLabel}</button></div></section></div>;
}

function Modal({ type, subjects, isDemo, focusMinutes, defaultTaskDate, close, addSubject, addTask, saveSession }: { type: "session" | "focusSession" | "task" | "subject"; subjects: Subject[]; isDemo: boolean; focusMinutes: number; defaultTaskDate: string; close: () => void; addSubject: (subject: Subject) => void; addTask: (task: Task) => void; saveSession: (minutes: number, questions: number, correct: number, scheduledReview?: ReviewSchedule | null) => void }) {
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (type === "subject") {
      const subject = { id: crypto.randomUUID(), name: String(data.get("name")), color: String(data.get("color")), archived: false };
      if (!isDemo) { try { const response = await fetch(`${API_URL}/subjects`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: subject.name, color: subject.color }) }); if (response.ok) return addSubject(await response.json()); const payload = await response.json(); setError(payload.message ?? "Não foi possível criar a disciplina."); return; } catch { setError("O servidor está indisponível."); return; } }
      addSubject(subject);
    } else if (type === "task") {
      let task = { id: crypto.randomUUID(), subjectId: String(data.get("subjectId")), title: String(data.get("title")), date: String(data.get("date")), type: String(data.get("type")), completed: false };
      if (!isDemo) try {
        const response = await fetch(`${API_URL}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId: task.subjectId, title: task.title, date: task.date, type: task.type }) });
        if (response.ok) task = await response.json(); else { const payload = await response.json(); setError(payload.message ?? "Não foi possível criar a tarefa."); return; }
      } catch { setError("O servidor está indisponível."); return; }
      addTask(task);
    } else {
      const questions = Number(data.get("questions") || 0); const correct = Number(data.get("correct") || 0);
      if (correct > questions) { setError("Os acertos não podem superar o total de questões."); return; }
      const minutes = Number(data.get("minutes"));
      let scheduledReview: ReviewSchedule | null = null;
      if (!isDemo) try {
        const response = await fetch(`${API_URL}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId: String(data.get("subjectId")), topic: String(data.get("topic")), durationMinutes: minutes, date: data.get("date"), questions, correctAnswers: correct, type: data.get("sessionType") }) });
        if (!response.ok) { const payload = await response.json(); setError(payload.message ?? "Não foi possível registrar a sessão."); return; }
        scheduledReview = (await response.json()).scheduledReview;
      } catch { setError("O servidor está indisponível."); return; }
      saveSession(minutes, questions, correct, scheduledReview);
    }
  };
  const titles = { subject: "Nova disciplina", task: "Planejar tarefa", session: "Registrar estudo", focusSession: "Concluir sessão de foco" };
  return <div className="modal-backdrop" role="presentation" onMouseDown={close}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">NOVO REGISTRO</span><h2 id="modal-title">{titles[type]}</h2></div><button className="icon-button" onClick={close} aria-label="Fechar"><X /></button></div><form onSubmit={submit}>
    {type === "subject" && <><label>Nome da disciplina<input name="name" required maxLength={80} placeholder="Ex.: Física" autoFocus /></label><fieldset><legend>Cor</legend><div className="color-options">{palette.map((color, index) => <label key={color} style={{ background: color }}><input type="radio" name="color" value={color} defaultChecked={index === 0} /><span><Check /></span></label>)}</div></fieldset></>}
    {type !== "subject" && <AppSelect label="Disciplina" name="subjectId" options={subjects.filter(subject => !subject.archived).map(subject => ({ value: subject.id, label: subject.name }))} />}
    {type === "task" && <><label>Título da tarefa<input name="title" required placeholder="O que você vai estudar?" autoFocus /></label><div className="form-row"><DateField label="Data" name="date" defaultValue={defaultTaskDate} /><AppSelect label="Tipo" name="type" options={[{ value: "FIRST_CONTACT", label: "Primeiro contato" }, { value: "REVIEW", label: "Revisão" }, { value: "EXAM", label: "Prova ou simulado" }, { value: "GENERAL", label: "Geral" }]} /></div></>}
    {(type === "session" || type === "focusSession") && <><label>Assunto estudado<input name="topic" required placeholder="Ex.: Função de segundo grau" autoFocus /></label><div className="form-row"><AppSelect label="Tipo de estudo" name="sessionType" defaultValue="FIRST_CONTACT" options={[{ value: "FIRST_CONTACT", label: "Primeiro contato" }, { value: "REVIEW", label: "Revisão" }, { value: "MOCK_EXAM", label: "Simulado" }, { value: "OTHER", label: "Outro" }]} /><DateField label="Data" name="date" defaultValue={today} max={today} /></div><div className="form-row three"><label>Duração (min)<input name="minutes" type="number" min="1" max="1440" required defaultValue={type === "focusSession" ? focusMinutes : 50} /></label><label>Questões<input name="questions" type="number" min="0" defaultValue="0" /></label><label>Acertos<input name="correct" type="number" min="0" defaultValue="0" /></label></div>{type === "focusSession" && <p className="focus-session-hint"><Clock3 />Tempo líquido recuperado do temporizador. Complete os dados para transformar o foco em progresso.</p>}<p className="review-rule-note"><Sparkles />Com questões respondidas, o assunto volta automaticamente: abaixo de 50% em 1 dia; 50–69% em 3; 70–84% em 7; 85% ou mais em 15 dias.</p></>}
    {error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button className="primary" type="submit">Salvar</button></div>
  </form></section></div>;
}

function OnboardingScreen({ user, onComplete, onLogout }: { user: User; onComplete: (user: User, subjects: Subject[]) => void; onLogout: () => void }) {
  const [selected, setSelected] = useState(["Matemática", "Linguagens", "Redação"]);
  const [timezone, setTimezone] = useState(user.timezone);
  const [customSubject, setCustomSubject] = useState("");
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toggle = (name: string) => setSelected(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]);
  const addCustomSubject = () => {
    const name = customSubject.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (name.length > 80) { setError("O nome da disciplina deve ter no máximo 80 caracteres."); return; }
    const suggestedMatch = suggestedSubjects.find(item => item.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
    const customMatch = customSubjects.find(item => item.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
    const existing = suggestedMatch ?? customMatch;
    if (existing) {
      setSelected(current => current.includes(existing) ? current : [...current, existing]);
      setCustomSubject(""); setError(""); return;
    }
    setCustomSubjects(current => [...current, name]);
    setSelected(current => [...current, name]);
    setCustomSubject(""); setError("");
  };
  const removeCustomSubject = (name: string) => {
    setCustomSubjects(current => current.filter(item => item !== name));
    setSelected(current => current.filter(item => item !== name));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    if (!selected.length) { setError("Escolha pelo menos uma disciplina para começar."); return; }
    const data = new FormData(event.currentTarget);
    if (!data.get("targetExamDate")) { setError("Escolha a data da prova."); return; }
    setSubmitting(true);
    try {
      const profileResponse = await fetch(`${API_URL}/profile`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: user.name, timezone: data.get("timezone"), targetExamName: data.get("targetExamName"), targetExamDate: data.get("targetExamDate") }),
      });
      const profile = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profile.message ?? "Não foi possível salvar seu objetivo.");
      const responses = await Promise.all(selected.map((name, index) => fetch(`${API_URL}/subjects`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color: palette[index % palette.length] }),
      })));
      if (responses.some(response => !response.ok)) throw new Error("Seu objetivo foi salvo, mas houve um problema ao criar as disciplinas.");
      onComplete(profile, await Promise.all(responses.map(response => response.json())));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível concluir a configuração."); }
    finally { setSubmitting(false); }
  };
  return <main className="onboarding-page">
    <header className="onboarding-header"><div className="brand"><span><Zap size={21} fill="currentColor" /></span>StudyFlow</div><button onClick={onLogout}>Sair</button></header>
    <section className="onboarding-card"><div className="onboarding-copy"><span className="eyebrow">CONFIGURAÇÃO INICIAL</span><h1>Vamos transformar sua meta em um plano.</h1><p>Conte qual prova está no horizonte e escolha as primeiras disciplinas. Você poderá mudar tudo depois.</p><div className="onboarding-steps"><span className="done"><Check />Conta criada</span><span><Target />Objetivo e matérias</span><span><Sparkles />Painel personalizado</span></div></div>
      <form onSubmit={submit}><div className="form-section"><div className="section-number">1</div><div><h2>Qual é o seu objetivo?</h2><p>Usaremos a data para mostrar o tempo restante.</p></div></div><label>Nome da prova<input name="targetExamName" required maxLength={120} placeholder="Ex.: ENEM 2026" autoFocus /></label><div className="form-row"><DateField label="Data da prova" name="targetExamDate" min={dateInTimezone(timezone)} /><AppSelect label="Seu fuso horário" name="timezone" value={timezone} onChange={setTimezone} options={[{ value: "America/Sao_Paulo", label: "Brasília" }, { value: "America/Manaus", label: "Manaus" }, { value: "America/Cuiaba", label: "Cuiabá" }, { value: "America/Rio_Branco", label: "Rio Branco" }, { value: "America/Noronha", label: "Fernando de Noronha" }]} /></div>
        <div className="form-section subjects-step"><div className="section-number">2</div><div><h2>O que você vai estudar?</h2><p>Selecione uma ou mais disciplinas para montar seu espaço.</p></div></div><div className="subject-options">{suggestedSubjects.map((name, index) => <button type="button" key={name} className={selected.includes(name) ? "selected" : ""} onClick={() => toggle(name)}><i style={{ background: palette[index % palette.length] }}>{name[0]}</i><span>{name}</span>{selected.includes(name) && <Check />}</button>)}</div>
        <section className="custom-subject-section" aria-labelledby="custom-subject-title"><div><strong id="custom-subject-title">Não encontrou sua disciplina?</strong><small>Adicione matérias de qualquer área, como Direito Penal ou Anatomia.</small></div><div className="custom-subject-entry"><input value={customSubject} onChange={event => setCustomSubject(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustomSubject(); } }} maxLength={80} placeholder="Nome da disciplina" aria-label="Nome da disciplina personalizada" /><button type="button" onClick={addCustomSubject} disabled={!customSubject.trim()}><Plus />Adicionar</button></div>{customSubjects.length > 0 && <div className="custom-subject-list" aria-label="Disciplinas adicionadas manualmente">{customSubjects.map((name, index) => <span key={name}><i style={{ background: palette[(suggestedSubjects.length + index) % palette.length] }}>{name[0]}</i>{name}<button type="button" onClick={() => removeCustomSubject(name)} aria-label={`Remover ${name}`}><X /></button></span>)}</div>}</section>
        {error && <p className="form-error">{error}</p>}<button className="primary onboarding-submit" disabled={submitting}>{submitting ? "Preparando seu painel…" : "Criar meu plano inicial"}<ChevronRight /></button>
      </form>
    </section>
  </main>;
}

function ProfileSettings({ user, preferences, onUpdate, onPreferencesUpdate, onPasswordChanged, showNotice }: { user: User; preferences: AccountPreferences; onUpdate: (user: User) => void; onPreferencesUpdate: (preferences: AccountPreferences) => void; onPasswordChanged: () => Promise<void>; showNotice: (message: string) => void }) {
  const [profileError, setProfileError] = useState("");
  const [preferencesError, setPreferencesError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitting, setSubmitting] = useState("");

  const request = async (path: string, method: string, body: Record<string, unknown>) => {
    const response = await fetch(`${API_URL}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Não foi possível salvar as alterações.");
    return payload;
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting("profile"); setProfileError(""); const data = new FormData(event.currentTarget);
    try { const next = await request("/profile", "PATCH", Object.fromEntries(data)); onUpdate(next); showNotice("Perfil e objetivo atualizados."); }
    catch (caught) { setProfileError(caught instanceof Error ? caught.message : "O servidor está indisponível."); }
    finally { setSubmitting(""); }
  };

  const savePreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting("preferences"); setPreferencesError(""); const data = new FormData(event.currentTarget);
    const body = { focusMinutes: Number(data.get("focusMinutes")), shortBreakMinutes: Number(data.get("shortBreakMinutes")), longBreakMinutes: Number(data.get("longBreakMinutes")), cycles: Number(data.get("cycles")), soundEnabled: data.get("soundEnabled") === "on", browserNotifications: data.get("browserNotifications") === "on", reviewDifficultyDays: Number(data.get("reviewDifficultyDays")), reviewDevelopingDays: Number(data.get("reviewDevelopingDays")), reviewProficientDays: Number(data.get("reviewProficientDays")), reviewMasteredDays: Number(data.get("reviewMasteredDays")) };
    try { const next = await request("/preferences", "PUT", body); onPreferencesUpdate(next); showNotice("Preferências de foco e revisão atualizadas."); }
    catch (caught) { setPreferencesError(caught instanceof Error ? caught.message : "O servidor está indisponível."); }
    finally { setSubmitting(""); }
  };

  const changeEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting("email"); setEmailError(""); const form = event.currentTarget; const data = new FormData(form);
    try { const next = await request("/profile/email", "PUT", Object.fromEntries(data)); onUpdate(next); form.reset(); showNotice("E-mail da conta atualizado."); }
    catch (caught) { setEmailError(caught instanceof Error ? caught.message : "O servidor está indisponível."); }
    finally { setSubmitting(""); }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting("password"); setPasswordError(""); const data = new FormData(event.currentTarget);
    if (data.get("newPassword") !== data.get("confirmPassword")) { setPasswordError("A confirmação da nova senha não confere."); setSubmitting(""); return; }
    try { await request("/profile/password", "PUT", { currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }); showNotice("Senha alterada. Entre novamente para continuar."); await onPasswordChanged(); }
    catch (caught) { setPasswordError(caught instanceof Error ? caught.message : "O servidor está indisponível."); }
    finally { setSubmitting(""); }
  };

  return <div className="page settings-page"><section className="page-title"><div><span className="eyebrow">SUA CONTA</span><h1>Configurações</h1><p>Centralize seu perfil, seu ritmo de foco e a segurança da conta.</p></div></section><div className="settings-grid"><aside className="profile-summary"><div className="avatar large-avatar">{initials(user.name)}</div><h2>{user.name}</h2><p>{user.email}</p><span><Target />{user.targetExamName}</span><div className="settings-nav"><a href="#perfil">Perfil de estudos</a><a href="#foco">Modo foco</a><a href="#seguranca">Segurança</a></div></aside><div className="settings-stack">
    <form id="perfil" className="settings-form" onSubmit={saveProfile}><div className="panel-heading"><div><h2>Perfil de estudos</h2><p>Dados usados para personalizar datas e contagem regressiva.</p></div></div><label>Nome<input name="name" defaultValue={user.name} required maxLength={100} /></label><label>E-mail atual<input value={user.email} disabled aria-label="E-mail atual" /></label><div className="form-row"><label>Prova-alvo<input name="targetExamName" defaultValue={user.targetExamName ?? ""} required maxLength={120} /></label><label>Data da prova<input name="targetExamDate" type="date" min={dateInTimezone(user.timezone)} defaultValue={user.targetExamDate ?? ""} required /></label></div><label>Fuso horário<select name="timezone" defaultValue={user.timezone}><option value="America/Sao_Paulo">Brasília</option><option value="America/Manaus">Manaus</option><option value="America/Cuiaba">Cuiabá</option><option value="America/Rio_Branco">Rio Branco</option><option value="America/Noronha">Fernando de Noronha</option></select></label>{profileError && <p className="form-error">{profileError}</p>}<div className="settings-actions"><button className="primary" disabled={!!submitting}>{submitting === "profile" ? "Salvando…" : "Salvar perfil"}</button></div></form>
    <form id="foco" className="settings-form" onSubmit={savePreferences}><div className="panel-heading"><div><h2>Foco e revisões</h2><p>Seu ritmo será recuperado em qualquer dispositivo conectado à conta.</p></div></div><h3 className="settings-subtitle">Modo foco</h3><div className="form-row"><label>Foco (min)<input name="focusMinutes" type="number" min="1" max="180" defaultValue={preferences.focusMinutes} required /></label><label>Pausa curta (min)<input name="shortBreakMinutes" type="number" min="1" max="60" defaultValue={preferences.shortBreakMinutes} required /></label></div><div className="form-row"><label>Pausa longa (min)<input name="longBreakMinutes" type="number" min="1" max="120" defaultValue={preferences.longBreakMinutes} required /></label><label>Ciclos<input name="cycles" type="number" min="1" max="8" defaultValue={preferences.cycles} required /></label></div><fieldset className="settings-switches"><legend>Avisos de conclusão</legend><label><input name="soundEnabled" type="checkbox" defaultChecked={preferences.soundEnabled} /><span><strong>Som do temporizador</strong><small>Dois toques ao terminar um período.</small></span></label><label><input name="browserNotifications" type="checkbox" defaultChecked={preferences.browserNotifications} /><span><strong>Notificações do navegador</strong><small>Também depende da permissão deste dispositivo.</small></span></label></fieldset><div className="settings-separator" /><div><h3 className="settings-subtitle">Intervalos automáticos</h3><p className="settings-help">Defina em quantos dias cada faixa de aproveitamento deve voltar.</p></div><div className="form-row review-interval-row"><label>Em dificuldade · abaixo de 50%<input name="reviewDifficultyDays" type="number" min="1" max="90" defaultValue={preferences.reviewDifficultyDays} required /></label><label>Em desenvolvimento · 50–69%<input name="reviewDevelopingDays" type="number" min="1" max="90" defaultValue={preferences.reviewDevelopingDays} required /></label></div><div className="form-row review-interval-row"><label>Bom desempenho · 70–84%<input name="reviewProficientDays" type="number" min="1" max="90" defaultValue={preferences.reviewProficientDays} required /></label><label>Dominado · 85% ou mais<input name="reviewMasteredDays" type="number" min="1" max="180" defaultValue={preferences.reviewMasteredDays} required /></label></div>{preferencesError && <p className="form-error">{preferencesError}</p>}<div className="settings-actions"><button className="primary" disabled={!!submitting}>{submitting === "preferences" ? "Salvando…" : "Salvar preferências"}</button></div></form>
    <section id="seguranca" className="settings-form security-settings"><div className="panel-heading"><div><h2>Segurança da conta</h2><p>Confirme sua senha atual antes de alterar dados de acesso.</p></div></div><form onSubmit={changeEmail}><label>Novo e-mail<input name="newEmail" type="email" required maxLength={180} placeholder={user.email} /></label><label>Senha atual<input name="currentPassword" type="password" required autoComplete="current-password" /></label>{emailError && <p className="form-error">{emailError}</p>}<div className="settings-actions"><button className="secondary" disabled={!!submitting}>{submitting === "email" ? "Alterando…" : "Alterar e-mail"}</button></div></form><div className="settings-separator" /><form onSubmit={changePassword}><div className="form-row"><label>Senha atual<input name="currentPassword" type="password" required autoComplete="current-password" /></label><label>Nova senha<input name="newPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label></div><label>Confirmar nova senha<input name="confirmPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>{passwordError && <p className="form-error">{passwordError}</p>}<div className="settings-actions"><button className="primary" disabled={!!submitting}>{submitting === "password" ? "Alterando…" : "Alterar senha"}</button></div></form></section>
  </div></div></div>;
}

function LoadingScreen() {
  return <main className="auth-page"><div className="auth-loading"><span><Zap fill="currentColor" /></span><p>Preparando seu espaço de estudos…</p></div></main>;
}

function AuthScreen({ onAuthenticated, onDemo }: { onAuthenticated: (user: User) => void; onDemo: () => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const restore = window.setTimeout(() => {
      const token = new URLSearchParams(window.location.search).get("resetToken");
      if (token) { setResetToken(token); setMode("reset"); }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setError(""); setSuccess("");
    const data = new FormData(event.currentTarget);
    if (mode === "reset" && data.get("newPassword") !== data.get("confirmPassword")) { setError("A confirmação da nova senha não confere."); setSubmitting(false); return; }
    try {
      const action = mode === "forgot" ? "forgot-password" : mode === "reset" ? "reset-password" : mode;
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "forgot" ? { email: data.get("email") } : mode === "reset" ? { token: resetToken, newPassword: data.get("newPassword") } : { name: data.get("name"), email: data.get("email"), password: data.get("password") }),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.message ?? "Não foi possível entrar."); return; }
      if (mode === "forgot") {
        setSuccess(payload.message);
        if (payload.developmentToken) { setResetToken(payload.developmentToken); setMode("reset"); }
        return;
      }
      if (mode === "reset") {
        window.history.replaceState({}, "", window.location.pathname);
        setMode("login"); setResetToken(""); setSuccess(payload.message); return;
      }
      onAuthenticated(payload.user);
    } catch { setError("O servidor está indisponível. Você ainda pode explorar a demonstração."); }
    finally { setSubmitting(false); }
  };
  const heading = mode === "login" ? "Que bom ter você de volta" : mode === "register" ? "Comece sua jornada" : mode === "forgot" ? "Recupere seu acesso" : "Crie uma nova senha";
  const description = mode === "login" ? "Entre para continuar de onde parou." : mode === "register" ? "Crie sua conta e dê o primeiro passo." : mode === "forgot" ? "Informe seu e-mail para receber as instruções." : "Use uma senha nova com pelo menos 8 caracteres.";
  return <main className="auth-page"><section className="auth-story"><div className="brand auth-brand"><span><Zap size={21} fill="currentColor" /></span>StudyFlow</div><div><span className="eyebrow">SEU RITMO. SEU PROGRESSO.</span><h1>Estudar bem começa por enxergar o caminho.</h1><p>Planeje seus dias, mergulhe no foco e transforme cada sessão em progresso visível.</p><div className="auth-benefits"><span><Check />Rotina em um só lugar</span><span><Check />Indicadores que fazem sentido</span><span><Check />Seu histórico protegido</span></div></div><small>Feito para quem leva o próprio futuro a sério.</small></section><section className="auth-form-side"><div className="auth-card"><span className="auth-icon">{mode === "forgot" || mode === "reset" ? <LockKeyhole /> : <UserRound />}</span><h2>{heading}</h2><p>{description}</p><form onSubmit={submit}>{mode === "register" && <label>Seu nome<div className="input-with-icon"><UserRound /><input name="name" required maxLength={100} placeholder="Como devemos chamar você?" /></div></label>}{mode !== "reset" && <label>E-mail<div className="input-with-icon"><Mail /><input name="email" type="email" required autoComplete="email" placeholder="voce@exemplo.com" /></div></label>}{(mode === "login" || mode === "register") && <label>Senha<div className="input-with-icon"><LockKeyhole /><input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 8 caracteres" /></div></label>}{mode === "reset" && <><label>Nova senha<div className="input-with-icon"><LockKeyhole /><input name="newPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></div></label><label>Confirmar nova senha<div className="input-with-icon"><LockKeyhole /><input name="confirmPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></div></label></>}{mode === "login" && <button type="button" className="forgot-link" onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}>Esqueci minha senha</button>}{success && <p className="form-success">{success}</p>}{error && <p className="form-error">{error}</p>}<button className="primary auth-submit" disabled={submitting}>{submitting ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "register" ? "Criar minha conta" : mode === "forgot" ? "Enviar instruções" : "Redefinir senha"}</button></form><p className="auth-switch">{mode === "login" ? "Ainda não tem conta?" : mode === "register" ? "Já possui uma conta?" : "Lembrou sua senha?"}<button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setSuccess(""); }}>{mode === "login" ? "Cadastre-se" : "Entrar"}</button></p>{mode === "login" && <><div className="auth-divider"><span>ou</span></div><button className="demo-button" onClick={onDemo}>Explorar demonstração <ChevronRight /></button></>}</div></section></main>;
}

function ComingSoon({ title }: { title: string }) {
  return <div className="page"><section className="empty-state"><span><Sparkles /></span><h1>{title}</h1><p>Esta área já está no mapa do produto e será construída na próxima etapa do MVP.</p></section></div>;
}
