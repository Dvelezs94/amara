import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

type AppSection = "workOrders" | "knowledgeBase" | "notifications" | "profile";
type WoStatus = "open" | "in_progress" | "completed" | "cancelled";
type WoPriority = "low" | "medium" | "high" | "urgent";

type WorkOrderListItem = {
  id: string;
  folio?: string | null;
  title: string;
  status: WoStatus;
  priority: WoPriority;
  /** routine = programada; on_demand = bajo demanda (same as web `lib/work-order-kind`) */
  kind?: string | null;
  dueDate: string | null;
  assetName: string | null;
  assetAssetId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatarUrl?: string | null;
  createdAt?: string;
  boardSortOrder?: number;
};

type ChecklistItem = {
  id: string;
  type: "step" | "field";
  label: string;
  completed: boolean | null;
  value: unknown;
  fieldType: string | null;
};

/** All steps done; all fields answered (aligned with web checklist semantics). */
function isChecklistFullyComplete(checklist: ChecklistItem[]): boolean {
  if (checklist.length === 0) return true;
  for (const item of checklist) {
    if (item.type === "step") {
      if (item.completed !== true) return false;
      continue;
    }
    if (item.type === "field") {
      if (item.fieldType === "checkbox") {
        if (typeof item.value !== "boolean") return false;
        continue;
      }
      if (item.value == null) return false;
      if (typeof item.value === "boolean") continue;
      if (typeof item.value === "number" && !Number.isNaN(item.value)) continue;
      const s = String(item.value).trim();
      if (s === "") return false;
      continue;
    }
  }
  return true;
}

type WorkOrderDetail = {
  id: string;
  folio?: string | number | null;
  title: string;
  description: string | null;
  status: WoStatus;
  priority: WoPriority;
  kind?: string | null;
  dueDate: string | null;
  completedAt?: string | null;
  asset: { id: string; name: string; assetId: string } | null;
  assignee?: { id: string; name: string; avatarUrl?: string | null } | null;
  requester?: { id: string; name: string; avatarUrl?: string | null } | null;
  checklist: ChecklistItem[];
  notes: { id: string; body: string; createdAt: string }[];
  attachments?: { id: string; fileUrl: string; filename: string; createdAt: string }[];
};

type KnowledgeItem = {
  id: string;
  filename: string;
  fileUrl: string;
  category?: string | null;
  asset?: { id: string; name: string; assetId: string } | null;
  createdAt?: string;
};

type CurrentUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
  avatarUrl: string | null;
};

type NotificationItem = {
  id: string;
  type: "assignment" | "work_order_update" | "mention";
  title: string;
  body: string | null;
  workOrderId: string | null;
  noteId: string | null;
  readAt: string | null;
  createdAt: string;
};

type UserOption = {
  id: string;
  name: string;
};

const API_HOST = (process.env.EXPO_PUBLIC_API_HOST ?? "").trim().replace(/\/$/, "");
const apiUrl = (path: string) => `${API_HOST}${path}`;

/** Same naming as web (`app/page.tsx` + `components/AppShell.tsx` sidebar). */
const BRAND_MARK = "MSA";
const BRAND_TAGLINE = "Maintenance Software Assistant";

/** Align with web (tailwind + AppShell): light shell, brand orange, primary blue */
const theme = {
  surface: "#F8FAFC",
  pageBg: "#E4E4E7",
  white: "#FFFFFF",
  zinc50: "#FAFAFA",
  zinc100: "#F4F4F5",
  zinc200: "#E4E4E7",
  zinc300: "#D4D4D8",
  zinc400: "#A1A1AA",
  zinc500: "#71717A",
  zinc600: "#52525B",
  zinc700: "#3F3F46",
  zinc800: "#27272A",
  zinc900: "#18181B",
  primary: "#02257D",
  primary50: "#E8ECF7",
  primary100: "#C5D0EB",
  primary200: "#9EB2DB",
  accent: "#F14C03",
  red50: "#FEF2F2",
  red600: "#DC2626",
} as const;

type WorkOrderKind = "routine" | "on_demand";

/** Mirrors `lib/work-order-kind.ts` on the web app */
function parseWorkOrderKind(raw: unknown): WorkOrderKind {
  if (raw === "routine") return "routine";
  return "on_demand";
}

function workOrderKindLabel(kind: WorkOrderKind): string {
  return kind === "routine" ? "Rutinaria" : "Orden de trabajo";
}

function WorkOrderKindBadge({ kindRaw }: { kindRaw: unknown }) {
  const k = parseWorkOrderKind(kindRaw);
  return (
    <View style={[styles.kindBadge, k === "routine" ? styles.kindBadgeRoutine : styles.kindBadgeOnDemand]}>
      <Text style={styles.kindBadgeText}>{workOrderKindLabel(k)}</Text>
    </View>
  );
}

const COMPLETED_INITIAL_VISIBLE = 5;
const COMPLETED_LOAD_MORE_STEP = 5;

const RELATIVE_DUE_MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function calendarDaysFromToday(dueStr: string): number | null {
  const due = new Date(dueStr);
  if (Number.isNaN(due.getTime())) return null;
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startDue = new Date(due);
  startDue.setHours(0, 0, 0, 0);
  return Math.round((startDue.getTime() - startToday.getTime()) / DAY_MS);
}

function formatDueShortDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es", { month: "short", day: "numeric" });
}

/** Spanish relative due copy (same idea as web `WorkOrderList` `formatDueRelative`) */
function formatDueRelative(s: string | null) {
  if (!s) return "—";
  const diff = calendarDaysFromToday(s);
  if (diff === null) return "—";
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  if (diff >= 2 && diff <= RELATIVE_DUE_MAX_DAYS) return `Vence en ${diff} días`;
  if (diff > RELATIVE_DUE_MAX_DAYS) return `Vence el ${formatDueShortDate(s)}`;
  if (diff === -1) return "Venció ayer";
  if (diff <= -2 && diff >= -RELATIVE_DUE_MAX_DAYS) return `Venció hace ${-diff} días`;
  return `Venció el ${formatDueShortDate(s)}`;
}

function formatWoDetailDate(s: string | number | Date | null | undefined) {
  if (s == null) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
}

function WorkOrderPriorityIconRN({ priority }: { priority: WoPriority }) {
  const map: Record<WoPriority, { name: ComponentProps<typeof Ionicons>["name"]; color: string }> = {
    low: { name: "chevron-down", color: "#0065FF" },
    medium: { name: "remove", color: "#E2A100" },
    high: { name: "chevron-up", color: "#FF8B00" },
    urgent: { name: "alert-circle", color: "#BF2600" },
  };
  const p = map[priority] ?? map.medium;
  return <Ionicons name={p.name} size={18} color={p.color} />;
}

function formatElapsedClock(createdAt: string | undefined, _refreshToken = 0) {
  void _refreshToken;
  if (!createdAt) return "--:--:--";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Short label for time until due (e.g. 45m, 1.5h, 3d) */
function formatDurationUntilDueShort(dueDate: string | null) {
  if (!dueDate) return "—";
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return "—";
  const ms = due - Date.now();
  if (ms < 0) return "Vencida";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = ms / 3600000;
  if (h < 48) {
    const rounded = Math.round(h * 10) / 10;
    return rounded % 1 === 0 ? `${Math.round(rounded)}h` : `${rounded}h`;
  }
  const d = Math.ceil(ms / (24 * 3600000));
  return `${d}d`;
}

function pendingPriorityBorderColor(priority: WoPriority): string {
  if (priority === "urgent") return "#DC2626";
  if (priority === "high") return theme.primary;
  if (priority === "medium") return "#D97706";
  return theme.zinc300;
}

function pendingPriorityBadgeTheme(priority: WoPriority) {
  if (priority === "urgent") return { bg: "#FEF2F2", fg: "#B91C1C", label: "CRÍTICA" };
  if (priority === "high") return { bg: "#E8ECF7", fg: theme.primary, label: "ALTA" };
  if (priority === "medium") return { bg: "#FFFBEB", fg: "#B45309", label: "MEDIA" };
  return { bg: theme.zinc100, fg: theme.zinc600, label: "BAJA" };
}

function AssigneeInitialsRing({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
      : (parts[0]?.slice(0, 2).toUpperCase() ?? "?");
  return (
    <View style={styles.assigneeRing} accessibilityLabel={name}>
      <Text style={styles.assigneeRingText}>{initials}</Text>
    </View>
  );
}

function absoluteFileUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_HOST}${path}`;
}

function looksLikePdf(filename: string | null | undefined, urlOrPath: string): boolean {
  const name = (filename ?? "").trim().toLowerCase();
  if (name.endsWith(".pdf")) return true;
  const pathOnly = urlOrPath.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  return pathOnly.endsWith(".pdf");
}

/** Avatar on task list cards: photo when `avatarUrl` exists (same paths as web), else initials ring. */
function TaskCardAssigneeAvatar({
  name,
  avatarUrl,
}: {
  name: string | null | undefined;
  avatarUrl?: string | null;
}) {
  const displayName = (name ?? "").trim();
  const label = displayName || "Asignado";
  const raw = avatarUrl != null ? String(avatarUrl).trim() : "";
  const uri = raw !== "" ? absoluteFileUrl(raw) : null;
  if (uri) {
    return (
      <View style={styles.taskCardAvatarWrap} accessibilityLabel={label}>
        <Image source={{ uri }} style={styles.taskCardAvatarImage} resizeMode="cover" />
      </View>
    );
  }
  if (displayName) {
    return (
      <View style={styles.taskCardAvatarWrap} accessibilityLabel={displayName}>
        <AssigneeInitialsRing name={displayName} />
      </View>
    );
  }
  return null;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "API error");
  }
  return data as T;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeSection, setActiveSection] = useState<AppSection>("workOrders");

  const [workOrders, setWorkOrders] = useState<WorkOrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [assigneeFilterInitialized, setAssigneeFilterInitialized] = useState(false);
  const [completedVisibleCount, setCompletedVisibleCount] = useState(COMPLETED_INITIAL_VISIBLE);
  const [pendingSortByPriority, setPendingSortByPriority] = useState(true);
  const [taskListTick, setTaskListTick] = useState(0);

  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");

  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);
  const [kbQuery, setKbQuery] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [inlinePdf, setInlinePdf] = useState<{ uri: string; title: string } | null>(null);

  const canLogin = username.trim().length > 0 && password.trim().length > 0;
  const firstName = useMemo(() => {
    const source = (me?.name ?? username).trim();
    if (!source) return "Operador";
    return source.split(/\s+/)[0] ?? "Operador";
  }, [me?.name, username]);

  const filteredKnowledge = useMemo(() => {
    const q = kbQuery.trim().toLowerCase();
    if (!q) return knowledge;
    return knowledge.filter((item) =>
      `${item.filename ?? ""} ${item.category ?? ""} ${item.asset?.name ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [knowledge, kbQuery]);

  const ongoingTasks = useMemo(
    () => workOrders.filter((w) => w.status === "in_progress"),
    [workOrders]
  );
  const pendingOpenTasks = useMemo(
    () => workOrders.filter((w) => w.status === "open"),
    [workOrders]
  );
  const pendingTasksSorted = useMemo(() => {
    const list = [...pendingOpenTasks];
    if (pendingSortByPriority) {
      const rank: Record<WoPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      list.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
      return list;
    }
    list.sort((a, b) => {
      const o = (a.boardSortOrder ?? 0) - (b.boardSortOrder ?? 0);
      if (o !== 0) return o;
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [pendingOpenTasks, pendingSortByPriority]);

  const completedTasks = useMemo(
    () => workOrders.filter((w) => w.status === "completed"),
    [workOrders]
  );
  const completedTasksVisible = useMemo(
    () => completedTasks.slice(0, completedVisibleCount),
    [completedTasks, completedVisibleCount]
  );

  async function loadWorkOrders() {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const query = selectedAssigneeId
        ? `?assigneeId=${encodeURIComponent(selectedAssigneeId)}`
        : "";
      const data = await apiFetch<WorkOrderListItem[]>(`/api/work-orders${query}`);
      setWorkOrders(Array.isArray(data) ? data : []);
      setCompletedVisibleCount(COMPLETED_INITIAL_VISIBLE);
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "No se pudo cargar las tareas.");
      setWorkOrders([]);
      setCompletedVisibleCount(COMPLETED_INITIAL_VISIBLE);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await apiFetch<UserOption[]>("/api/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  }

  async function loadKnowledge() {
    setKbLoading(true);
    setKbError(null);
    try {
      const data = await apiFetch<KnowledgeItem[]>("/api/knowledge-base");
      setKnowledge(Array.isArray(data) ? data : []);
    } catch (error) {
      setKbError(error instanceof Error ? error.message : "No se pudo cargar base de conocimiento.");
      setKnowledge([]);
    } finally {
      setKbLoading(false);
    }
  }

  function openKnowledgeFile(file: KnowledgeItem) {
    const url = absoluteFileUrl(file.fileUrl);
    if (looksLikePdf(file.filename, file.fileUrl)) {
      setInlinePdf({ uri: url, title: file.filename?.trim() || "PDF" });
    } else {
      void Linking.openURL(url);
    }
  }

  async function downloadKnowledgeFile(file: KnowledgeItem) {
    try {
      const url = absoluteFileUrl(file.fileUrl);
      const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!baseDir) {
        throw new Error("No hay almacenamiento disponible en el dispositivo.");
      }
      const target = `${baseDir}${Date.now()}-${file.filename}`;
      const result = await FileSystem.downloadAsync(url, target);
      if (looksLikePdf(file.filename, file.fileUrl)) {
        setInlinePdf({ uri: result.uri, title: file.filename?.trim() || "PDF" });
      } else {
        await Linking.openURL(result.uri);
      }
    } catch (error) {
      setKbError(error instanceof Error ? error.message : "No se pudo descargar el archivo.");
    }
  }

  function openAttachmentUrl(fileUrl: string, filename: string) {
    const url = absoluteFileUrl(fileUrl);
    if (looksLikePdf(filename, fileUrl)) {
      setInlinePdf({ uri: url, title: filename.trim() || "PDF" });
    } else {
      void Linking.openURL(url);
    }
  }

  async function loadMe() {
    setProfileError(null);
    try {
      const data = await apiFetch<CurrentUser>("/api/users/me");
      setMe(data);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "No se pudo cargar el perfil.");
      setMe(null);
    }
  }

  async function loadNotifications() {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const data = await apiFetch<{ items: NotificationItem[]; unreadCount: number }>(
        "/api/notifications"
      );
      setNotifications(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unreadCount ?? 0));
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : "No se pudo cargar notificaciones."
      );
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotificationsLoading(false);
    }
  }

  const closeTaskDetail = useCallback(() => {
    setSelectedWorkOrderId(null);
    setSelectedWorkOrder(null);
    setDetailError(null);
  }, []);

  async function openWorkOrder(id: string) {
    setSelectedWorkOrderId(id);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await apiFetch<WorkOrderDetail>(`/api/work-orders/${id}`);
      setSelectedWorkOrder(data);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No se pudo cargar detalle.");
      setSelectedWorkOrder(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleLogin() {
    if (!canLogin) return;
    setLoggingIn(true);
    setAuthError(null);
    try {
      await apiFetch<{ ok: true }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setIsLoggedIn(true);
      await Promise.all([loadWorkOrders(), loadKnowledge(), loadMe(), loadNotifications(), loadUsers()]);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Error de autenticacion.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function ensureChecklistCompleteBeforeClose(workOrderId: string): Promise<boolean> {
    try {
      const detail = await apiFetch<WorkOrderDetail>(`/api/work-orders/${workOrderId}`);
      if (detail.checklist.length === 0) return true;
      if (!isChecklistFullyComplete(detail.checklist)) {
        Alert.alert(
          "Checklist incompleto",
          "Marca todos los pasos y completa los campos del checklist antes de cerrar la tarea."
        );
        return false;
      }
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo verificar el checklist.";
      setOrdersError(msg);
      if (selectedWorkOrderId === workOrderId) setDetailError(msg);
      return false;
    }
  }

  async function updateWorkOrderStatusById(id: string, next: WoStatus) {
    setOrdersError(null);
    setDetailError(null);
    try {
      if (next === "completed") {
        const checklistOk = await ensureChecklistCompleteBeforeClose(id);
        if (!checklistOk) return;
      }
      await apiFetch<{ ok: true }>(`/api/work-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await loadWorkOrders();
      if (selectedWorkOrderId === id) {
        await openWorkOrder(id);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo actualizar el estado.";
      setOrdersError(msg);
      if (selectedWorkOrderId === id) setDetailError(msg);
    }
  }

  async function updateStatus(status: WoStatus) {
    if (!selectedWorkOrder) return;
    await updateWorkOrderStatusById(selectedWorkOrder.id, status);
  }

  async function updateChecklist(itemId: string, payload: { completed?: boolean; value?: unknown }) {
    if (!selectedWorkOrder) return;
    try {
      await apiFetch<{ ok: true }>(`/api/work-orders/${selectedWorkOrder.id}/checklist`, {
        method: "PATCH",
        body: JSON.stringify({ itemId, ...payload }),
      });
      await openWorkOrder(selectedWorkOrder.id);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No se pudo actualizar checklist.");
    }
  }

  async function addComment() {
    if (!selectedWorkOrder) return;
    const body = newComment.trim();
    if (!body) return;
    try {
      await apiFetch<{ id: string }>(`/api/work-orders/${selectedWorkOrder.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setNewComment("");
      await openWorkOrder(selectedWorkOrder.id);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No se pudo agregar comentario.");
    }
  }

  async function updateMyPassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg("Completa los tres campos de contrasena.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("La nueva contrasena y su confirmacion no coinciden.");
      return;
    }
    setProfileBusy(true);
    setPasswordMsg(null);
    try {
      await apiFetch<{ ok: true }>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("Contrasena actualizada correctamente.");
    } catch (error) {
      setPasswordMsg(error instanceof Error ? error.message : "No se pudo actualizar la contrasena.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function logout() {
    setProfileBusy(true);
    try {
      await apiFetch<{ ok: true }>("/api/auth/logout-json", { method: "POST" });
    } catch {
      // Even if API logout fails, clear local state.
    } finally {
      setIsLoggedIn(false);
      closeTaskDetail();
      setPassword("");
      setMe(null);
      setSelectedAssigneeId(null);
      setAssigneeFilterInitialized(false);
      setNotifications([]);
      setUnreadCount(0);
      setProfileBusy(false);
    }
  }

  async function markAllNotificationsRead() {
    try {
      await apiFetch<{ ok: true }>("/api/notifications", { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : "No se pudo marcar notificaciones."
      );
    }
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.readAt) {
      try {
        await apiFetch<{ ok: true }>(`/api/notifications/${notification.id}`, {
          method: "PATCH",
        });
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id
              ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
              : item
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Best effort: still allow navigation.
      }
    }
    if (notification.workOrderId) {
      setActiveSection("workOrders");
      await openWorkOrder(notification.workOrderId);
    }
  }

  function statusLabel(status: WoStatus) {
    if (status === "open") return "Abierta";
    if (status === "in_progress") return "En curso";
    if (status === "completed") return "Completada";
    return "Cancelada";
  }

  function priorityLabel(priority: WoPriority) {
    if (priority === "low") return "Baja";
    if (priority === "medium") return "Media";
    if (priority === "high") return "Alta";
    return "Urgente";
  }

  useEffect(() => {
    if (!isLoggedIn) return;
    loadWorkOrders();
  }, [isLoggedIn, selectedAssigneeId]);

  useEffect(() => {
    setCompletedVisibleCount(COMPLETED_INITIAL_VISIBLE);
  }, [selectedAssigneeId, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !me?.id || assigneeFilterInitialized) return;
    setSelectedAssigneeId(me.id);
    setAssigneeFilterInitialized(true);
  }, [isLoggedIn, me?.id, assigneeFilterInitialized]);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadNotifications();
    const timer = setInterval(() => {
      void loadNotifications();
    }, 15000);
    return () => clearInterval(timer);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeSection === "profile" && !me) {
      loadMe();
    }
  }, [activeSection, isLoggedIn, me]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (inlinePdf) {
        setInlinePdf(null);
        return true;
      }
      if (selectedWorkOrderId) {
        closeTaskDetail();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [inlinePdf, selectedWorkOrderId, closeTaskDetail]);

  useEffect(() => {
    if (!isLoggedIn || selectedWorkOrderId) return;
    if (!workOrders.some((w) => w.status === "in_progress")) return;
    const id = setInterval(() => setTaskListTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isLoggedIn, selectedWorkOrderId, workOrders]);

  const detailCanEditChecklist = selectedWorkOrder?.status === "in_progress";
  const detailOrderFinished =
    selectedWorkOrder?.status === "completed" ||
    selectedWorkOrder?.status === "cancelled";

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          style={styles.loginKeyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          <ScrollView
            style={styles.loginScroll}
            contentContainerStyle={styles.loginScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            <View style={styles.loginContainer}>
              <Text style={styles.loginBrandMark}>{BRAND_MARK}</Text>
              <Text style={styles.loginBrandTagline}>{BRAND_TAGLINE}</Text>
              <Text style={styles.loginTitle}>Iniciar sesion</Text>

              <View style={styles.loginFieldBlock}>
                <Text style={styles.loginLabel}>Usuario</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder=""
                  placeholderTextColor={theme.zinc400}
                  autoCapitalize="none"
                  style={styles.loginInput}
                />
              </View>

              <View style={styles.loginFieldBlock}>
                <Text style={styles.loginLabel}>Contrasena</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder=""
                  placeholderTextColor={theme.zinc400}
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.loginInput}
                />
              </View>

              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
              <Pressable
                style={[styles.loginButton, (!canLogin || loggingIn) && styles.primaryButtonDisabled]}
                onPress={handleLogin}
                disabled={!canLogin || loggingIn}
              >
                <Text style={styles.primaryButtonText}>
                  {loggingIn ? "Iniciando sesion..." : "Iniciar sesion"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <View style={styles.headerBrandBlock}>
            <Text style={styles.brandTitle}>{BRAND_MARK}</Text>
            <Text style={styles.headerGreeting}>{firstName}</Text>
          </View>
          <Pressable
            style={styles.headerAlertButton}
            onPress={() => {
              closeTaskDetail();
              setActiveSection("notifications");
            }}
          >
            <Ionicons name="notifications-outline" size={20} color={theme.zinc600} />
            {unreadCount > 0 ? (
              <View style={styles.headerAlertBadge}>
                <Text style={styles.headerAlertBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.contentArea}>
          {activeSection === "workOrders" ? (
            selectedWorkOrderId ? (
              <ScrollView
                contentContainerStyle={styles.detailContent}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              >
                <View style={styles.detailTopBar}>
                  <Pressable style={styles.backIconButton} onPress={closeTaskDetail}>
                    <Ionicons name="arrow-back" size={20} color={theme.zinc600} />
                  </Pressable>
                </View>
                {detailLoading ? (
                  <Text style={[styles.cardMeta, styles.screenPadH]}>Cargando detalle...</Text>
                ) : detailError ? (
                  <Text style={[styles.errorText, styles.screenPadH]}>{detailError}</Text>
                ) : selectedWorkOrder ? (
                  <>
                    <View style={styles.detailBreadcrumb}>
                      <Pressable onPress={closeTaskDetail}>
                        <Text style={styles.detailBreadcrumbLink}>Tareas</Text>
                      </Pressable>
                      <Text style={styles.detailBreadcrumbSep}> / </Text>
                      <Text style={styles.detailBreadcrumbCurrent} numberOfLines={1}>
                        {selectedWorkOrder.folio != null
                          ? `Folio ${selectedWorkOrder.folio}`
                          : `Ref. ${selectedWorkOrder.id.slice(0, 8)}…`}
                      </Text>
                    </View>

                    <Text style={styles.detailPageTitle}>{selectedWorkOrder.title}</Text>

                    <View style={styles.detailPanel}>
                      <Text style={styles.detailPanelKicker}>Estado</Text>
                      <View
                        style={[
                          styles.detailStatusBanner,
                          selectedWorkOrder.status === "open" && styles.detailStatusOpen,
                          selectedWorkOrder.status === "in_progress" && styles.detailStatusInProgress,
                          selectedWorkOrder.status === "completed" && styles.detailStatusCompleted,
                          selectedWorkOrder.status === "cancelled" && styles.detailStatusCancelled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.detailStatusBannerText,
                            selectedWorkOrder.status === "open" && styles.detailStatusOpenText,
                            selectedWorkOrder.status === "in_progress" && styles.detailStatusInProgressText,
                            selectedWorkOrder.status === "completed" && styles.detailStatusCompletedText,
                            selectedWorkOrder.status === "cancelled" && styles.detailStatusCancelledText,
                          ]}
                        >
                          {statusLabel(selectedWorkOrder.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Detalles</Text>
                      <View style={styles.detailSectionBody}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailRowLabel}>Tipo</Text>
                          <View style={styles.detailRowValue}>
                            <WorkOrderKindBadge kindRaw={selectedWorkOrder.kind} />
                          </View>
                        </View>
                        <View style={styles.detailRowDivider} />
                        <View style={styles.detailRow}>
                          <Text style={styles.detailRowLabel}>Prioridad</Text>
                          <View style={[styles.detailRowValue, styles.detailRowInline]}>
                            <WorkOrderPriorityIconRN priority={selectedWorkOrder.priority} />
                            <Text style={styles.detailRowValueText}>
                              {priorityLabel(selectedWorkOrder.priority)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.detailRowDivider} />
                        <View style={styles.detailRow}>
                          <Text style={styles.detailRowLabel}>Asignado</Text>
                          <View style={[styles.detailRowValue, styles.detailRowInline]}>
                            {selectedWorkOrder.assignee?.name ? (
                              <>
                                <AssigneeInitialsRing name={selectedWorkOrder.assignee.name} />
                                <Text style={styles.detailRowValueText} numberOfLines={1}>
                                  {selectedWorkOrder.assignee.name}
                                </Text>
                              </>
                            ) : (
                              <Text style={styles.detailRowMuted}>Sin asignar</Text>
                            )}
                          </View>
                        </View>
                        {selectedWorkOrder.requester ? (
                          <>
                            <View style={styles.detailRowDivider} />
                            <View style={styles.detailRow}>
                              <Text style={styles.detailRowLabel}>Solicitante</Text>
                              <View style={[styles.detailRowValue, styles.detailRowInline]}>
                                <AssigneeInitialsRing name={selectedWorkOrder.requester.name} />
                                <Text style={styles.detailRowValueText} numberOfLines={1}>
                                  {selectedWorkOrder.requester.name}
                                </Text>
                              </View>
                            </View>
                          </>
                        ) : null}
                        {selectedWorkOrder.asset ? (
                          <>
                            <View style={styles.detailRowDivider} />
                            <View style={styles.detailRow}>
                              <Text style={styles.detailRowLabel}>Activo</Text>
                              <View style={styles.detailRowValue}>
                                <Text style={styles.detailRowValueText} numberOfLines={2}>
                                  {selectedWorkOrder.asset.name}
                                </Text>
                                <Text style={styles.detailRowSub}>{selectedWorkOrder.asset.assetId}</Text>
                              </View>
                            </View>
                          </>
                        ) : null}
                        <View style={styles.detailRowDivider} />
                        <View style={styles.detailRow}>
                          <Text style={styles.detailRowLabel}>Vencimiento</Text>
                          <Text style={styles.detailRowValueText}>
                            {formatWoDetailDate(selectedWorkOrder.dueDate)}
                          </Text>
                        </View>
                        {selectedWorkOrder.status === "completed" && selectedWorkOrder.completedAt ? (
                          <>
                            <View style={styles.detailRowDivider} />
                            <View style={styles.detailRow}>
                              <Text style={styles.detailRowLabel}>Completada</Text>
                              <Text style={styles.detailRowValueText}>
                                {formatWoDetailDate(selectedWorkOrder.completedAt)}
                              </Text>
                            </View>
                          </>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Descripción</Text>
                      <View style={styles.detailSectionBody}>
                        {selectedWorkOrder.description ? (
                          <Text style={styles.detailDescriptionText}>{selectedWorkOrder.description}</Text>
                        ) : (
                          <Text style={styles.detailRowMuted}>Sin descripción.</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.actionsRow}>
                      {selectedWorkOrder.status === "open" ? (
                        <Pressable style={styles.secondaryButton} onPress={() => updateStatus("in_progress")}>
                          <Text style={styles.secondaryButtonText}>Iniciar</Text>
                        </Pressable>
                      ) : null}
                      {selectedWorkOrder.status === "in_progress" ? (
                        <Pressable style={styles.secondaryButton} onPress={() => updateStatus("completed")}>
                          <Text style={styles.secondaryButtonText}>Completar</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {(selectedWorkOrder.attachments?.length ?? 0) > 0 ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Adjuntos</Text>
                        <Text style={styles.detailSectionSubtitle}>
                          Fotos y evidencias de la tarea
                        </Text>
                        <View style={styles.detailSectionBody}>
                          <View style={styles.attachmentGrid}>
                            {(selectedWorkOrder.attachments ?? []).map((a) => (
                              <Pressable
                                key={a.id}
                                style={styles.attachmentCell}
                                onPress={() => openAttachmentUrl(a.fileUrl, a.filename)}
                              >
                                {looksLikePdf(a.filename, a.fileUrl) ? (
                                  <View style={[styles.attachmentThumb, styles.attachmentPdfThumb]}>
                                    <Ionicons name="document-text" size={32} color={theme.primary} />
                                  </View>
                                ) : (
                                  <Image
                                    source={{ uri: absoluteFileUrl(a.fileUrl) }}
                                    style={styles.attachmentThumb}
                                    resizeMode="cover"
                                  />
                                )}
                                <Text style={styles.attachmentCaption} numberOfLines={1}>
                                  {a.filename}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      </View>
                    ) : null}

                    {selectedWorkOrder.checklist.length > 0 ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Checklist</Text>
                        <View style={styles.detailSectionBody}>
                          {selectedWorkOrder.status === "open" ? (
                            <Text style={styles.checklistHint}>
                              Cambia el estado a <Text style={styles.checklistHintStrong}>En curso</Text> para
                              editar el checklist.
                            </Text>
                          ) : null}
                          {selectedWorkOrder.checklist.map((item) => (
                            <View key={item.id} style={styles.checklistCard}>
                              <View style={styles.checklistHeader}>
                                <View
                                  style={[
                                    styles.checkBullet,
                                    item.completed ? styles.checkBulletDone : styles.checkBulletTodo,
                                  ]}
                                />
                                <Text style={styles.cardTitle}>{item.label}</Text>
                              </View>
                              {item.type === "step" ? (
                                detailCanEditChecklist ? (
                                  <Pressable
                                    style={styles.ghostButton}
                                    onPress={() =>
                                      updateChecklist(item.id, { completed: !(item.completed ?? false) })
                                    }
                                  >
                                    <Text style={styles.ghostButtonText}>
                                      {item.completed ? "Marcar pendiente" : "Marcar completado"}
                                    </Text>
                                  </Pressable>
                                ) : null
                              ) : detailCanEditChecklist ? (
                                <TextInput
                                  value={item.value != null ? String(item.value) : ""}
                                  placeholder="Escribir valor"
                                  placeholderTextColor={theme.zinc400}
                                  style={styles.input}
                                  onEndEditing={(e) =>
                                    updateChecklist(item.id, { value: e.nativeEvent.text ?? "" })
                                  }
                                />
                              ) : (
                                <Text style={styles.checklistFieldReadOnly}>
                                  {item.value != null && String(item.value).trim() !== ""
                                    ? String(item.value)
                                    : "—"}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Actividad</Text>
                      <Text style={styles.detailSectionSubtitle}>Comentarios</Text>
                      <View style={styles.detailSectionBody}>
                        {detailOrderFinished ? (
                          <Text style={styles.helpText}>
                            Esta tarea está cerrada; no se pueden agregar comentarios.
                          </Text>
                        ) : (
                          <>
                            <Text style={styles.helpText}>
                              Puedes etiquetar con <Text style={styles.checklistHintStrong}>@usuario</Text>.
                            </Text>
                            <TextInput
                              value={newComment}
                              onChangeText={setNewComment}
                              placeholder="Escribe un comentario... (usa @usuario para etiquetar)"
                              placeholderTextColor={theme.zinc400}
                              multiline
                              style={styles.textarea}
                            />
                            <Pressable style={styles.secondaryButton} onPress={addComment}>
                              <Text style={styles.secondaryButtonText}>Agregar comentario</Text>
                            </Pressable>
                          </>
                        )}
                        {selectedWorkOrder.notes.length === 0 ? (
                          <Text style={styles.detailRowMuted}>Aún no hay comentarios.</Text>
                        ) : (
                          selectedWorkOrder.notes.map((note) => (
                            <View key={note.id} style={styles.activityNote}>
                              <Text style={styles.activityNoteBody}>{note.body}</Text>
                              <Text style={styles.activityNoteMeta}>
                                {formatWoDetailDate(note.createdAt)}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    </View>
                  </>
                ) : null}
              </ScrollView>
            ) : (
              <View style={styles.canvasShell}>
                <View style={styles.filterRow}>
                  <Text style={styles.cardMeta}>Asignado:</Text>
                  {selectedAssigneeId ? (
                    <View style={styles.filterTag}>
                      <Text style={styles.filterTagText}>
                        {users.find((u) => u.id === selectedAssigneeId)?.name ?? "Usuario"}
                      </Text>
                      <Pressable onPress={() => setSelectedAssigneeId(null)}>
                        <Text style={styles.filterTagRemove}>Quitar</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.helpText}>Todos</Text>
                  )}
                </View>
                <ScrollView
                  style={styles.filterUsersScroll}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.filterUsersRow}
                >
                  <Pressable
                    style={[
                      styles.userFilterChip,
                      selectedAssigneeId === null && styles.userFilterChipActive,
                    ]}
                    onPress={() => setSelectedAssigneeId(null)}
                  >
                    <Text
                      style={[
                        styles.userFilterChipText,
                        selectedAssigneeId === null && styles.userFilterChipTextActive,
                      ]}
                    >
                      Todos
                    </Text>
                  </Pressable>
                  {users.map((user) => (
                    <Pressable
                      key={user.id}
                      style={[
                        styles.userFilterChip,
                        selectedAssigneeId === user.id && styles.userFilterChipActive,
                      ]}
                      onPress={() => setSelectedAssigneeId(user.id)}
                    >
                      <Text
                        style={[
                          styles.userFilterChipText,
                          selectedAssigneeId === user.id && styles.userFilterChipTextActive,
                        ]}
                      >
                        {user.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {ordersLoading ? (
                  <Text style={[styles.cardMeta, styles.screenPadH]}>Cargando tareas...</Text>
                ) : null}
                {ordersError ? (
                  <Text style={[styles.errorText, styles.screenPadH]}>{ordersError}</Text>
                ) : null}
                <ScrollView
                  style={styles.dashboardScroll}
                  contentContainerStyle={styles.dashboardScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.dashboardSectionHeader}>
                    <Text style={styles.dashboardSectionKicker}>TAREAS EN CURSO</Text>
                    <View style={styles.dashboardActiveBadge}>
                      <Text style={styles.dashboardActiveBadgeText}>
                        {ongoingTasks.length} ACTIVA{ongoingTasks.length === 1 ? "" : "S"}
                      </Text>
                    </View>
                  </View>
                  {ongoingTasks.length === 0 ? (
                    <Text style={styles.dashboardEmpty}>No hay tareas en curso.</Text>
                  ) : (
                    ongoingTasks.map((w) => {
                      const assetKicker =
                        w.assetAssetId != null && String(w.assetAssetId).trim() !== ""
                          ? String(w.assetAssetId).toUpperCase()
                          : w.assetName
                            ? w.assetName.toUpperCase()
                            : "SIN ACTIVO";
                      return (
                        <View key={w.id} style={styles.ongoingHero}>
                          <View style={styles.ongoingHeroTop}>
                            <View style={styles.ongoingHeroTopText}>
                              <Text style={styles.ongoingAssetKicker}>ACTIVO: {assetKicker}</Text>
                              <Pressable onPress={() => openWorkOrder(w.id)}>
                                <Text style={styles.ongoingHeroTitle}>{w.title}</Text>
                              </Pressable>
                            </View>
                            <View style={styles.taskCardAvatarPriorityRow}>
                              <TaskCardAssigneeAvatar
                                name={w.assigneeName}
                                avatarUrl={w.assigneeAvatarUrl}
                              />
                              <WorkOrderPriorityIconRN priority={w.priority} />
                            </View>
                          </View>
                          <View style={styles.ongoingTimerStrip}>
                            <View style={styles.ongoingTimerCol}>
                              <Text style={styles.ongoingTimerDigits}>
                                {formatElapsedClock(w.createdAt, taskListTick)}
                              </Text>
                              <Text style={styles.ongoingTimerHint}>desde registro</Text>
                            </View>
                            <View style={styles.ongoingTimerDivider} />
                            <View style={styles.ongoingTimerCol}>
                              <Text style={styles.ongoingTimerEstLabel}>VENCIMIENTO</Text>
                              <Text style={styles.ongoingTimerEstValue} numberOfLines={2}>
                                {formatDueRelative(w.dueDate)}
                              </Text>
                            </View>
                          </View>
                          <Pressable
                            style={styles.ongoingCompleteMain}
                            onPress={() => updateWorkOrderStatusById(w.id, "completed")}
                          >
                            <Text style={styles.ongoingCompleteMainText}>Completar</Text>
                          </Pressable>
                          <View style={styles.ongoingSecondaryRow}>
                            <Pressable
                              style={styles.ongoingPauseBtn}
                              onPress={() => updateWorkOrderStatusById(w.id, "open")}
                            >
                              <Ionicons name="pause" size={18} color={theme.zinc700} />
                              <Text style={styles.ongoingPauseBtnText}>Pausar</Text>
                            </Pressable>
                            <Pressable style={styles.ongoingMoreBtn} onPress={() => openWorkOrder(w.id)}>
                              <Ionicons name="ellipsis-horizontal" size={22} color={theme.zinc600} />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  )}

                  <View style={[styles.dashboardSectionHeader, styles.dashboardSectionHeaderSpaced]}>
                    <Text style={styles.dashboardSectionKicker}>COLA PENDIENTE</Text>
                    <Pressable onPress={() => setPendingSortByPriority((v) => !v)} hitSlop={8}>
                      <Text style={styles.dashboardSortLink}>
                        {pendingSortByPriority ? "Orden del tablero" : "Ordenar por prioridad"}
                      </Text>
                    </Pressable>
                  </View>
                  {pendingTasksSorted.length === 0 ? (
                    <Text style={styles.dashboardEmpty}>No hay tareas pendientes.</Text>
                  ) : (
                    pendingTasksSorted.map((item) => {
                      const accent = pendingPriorityBorderColor(item.priority);
                      const badge = pendingPriorityBadgeTheme(item.priority);
                      const kind = parseWorkOrderKind(item.kind);
                      const kindLabel = workOrderKindLabel(kind);
                      const kindIcon =
                        kind === "routine" ? ("calendar-outline" as const) : ("construct-outline" as const);
                      const assetLine =
                        item.assetName != null
                          ? `${item.assetName}${item.assetAssetId ? ` · ${item.assetAssetId}` : ""}`
                          : "Sin activo";
                      return (
                        <Pressable
                          key={item.id}
                          style={[styles.pendingCard, { borderLeftColor: accent }]}
                          onPress={() => openWorkOrder(item.id)}
                        >
                          <View style={styles.pendingCardTop}>
                            <View style={[styles.pendingPriorityPill, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.pendingPriorityPillText, { color: badge.fg }]}>
                                {badge.label}
                              </Text>
                            </View>
                            <View style={styles.pendingDurationPill}>
                              <Text style={styles.pendingDurationPillText}>
                                {formatDurationUntilDueShort(item.dueDate)}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.pendingCardTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <View style={styles.pendingMetaRow}>
                            <Ionicons name="business-outline" size={16} color={theme.zinc500} />
                            <Text style={styles.pendingMetaText} numberOfLines={1}>
                              {assetLine}
                            </Text>
                          </View>
                          <View style={styles.pendingMetaRow}>
                            <Ionicons name={kindIcon} size={16} color={theme.zinc500} />
                            <Text style={styles.pendingMetaText} numberOfLines={1}>
                              {kindLabel}
                            </Text>
                          </View>
                          <View style={styles.pendingCardFooter}>
                            <TaskCardAssigneeAvatar
                              name={item.assigneeName}
                              avatarUrl={item.assigneeAvatarUrl}
                            />
                            <WorkOrderPriorityIconRN priority={item.priority} />
                          </View>
                        </Pressable>
                      );
                    })
                  )}

                  <View style={[styles.dashboardSectionHeader, styles.dashboardSectionHeaderSpaced]}>
                    <Text style={styles.dashboardSectionKicker}>TERMINADAS</Text>
                    <Text style={styles.dashboardSectionCount}>{completedTasks.length}</Text>
                  </View>
                  {completedTasks.length === 0 ? (
                    <Text style={styles.dashboardEmpty}>Sin tareas terminadas en esta vista.</Text>
                  ) : (
                    <>
                      {completedTasksVisible.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.completedRowCard}
                          onPress={() => openWorkOrder(item.id)}
                        >
                          <View style={styles.completedRowInner}>
                            <View style={styles.completedRowTextCol}>
                              <Text style={styles.completedRowTitle} numberOfLines={1}>
                                {item.title}
                              </Text>
                              <Text style={styles.completedRowMeta}>
                                {item.folio != null ? `Folio ${item.folio}` : item.id.slice(0, 8)}
                              </Text>
                            </View>
                            <View style={styles.taskCardAvatarPriorityRow}>
                              <TaskCardAssigneeAvatar
                                name={item.assigneeName}
                                avatarUrl={item.assigneeAvatarUrl}
                              />
                              <WorkOrderPriorityIconRN priority={item.priority} />
                            </View>
                          </View>
                        </Pressable>
                      ))}
                      {completedTasks.length > completedVisibleCount ? (
                        <Pressable
                          style={styles.loadMoreButton}
                          onPress={() =>
                            setCompletedVisibleCount((count) =>
                              Math.min(count + COMPLETED_LOAD_MORE_STEP, completedTasks.length)
                            )
                          }
                        >
                          <Text style={styles.loadMoreButtonText}>Cargar más</Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </ScrollView>
              </View>
            )
          ) : activeSection === "knowledgeBase" ? (
            <View style={styles.kbContainer}>
              <View style={[styles.screenPadH, { paddingTop: 12, paddingBottom: 8 }]}>
                <TextInput
                  value={kbQuery}
                  onChangeText={setKbQuery}
                  placeholder="Buscar articulo..."
                  placeholderTextColor={theme.zinc400}
                  style={styles.input}
                />
              </View>
              {kbLoading ? (
                <Text style={[styles.cardMeta, styles.screenPadH]}>Cargando base de conocimiento...</Text>
              ) : null}
              {kbError ? <Text style={[styles.errorText, styles.screenPadH]}>{kbError}</Text> : null}
              <FlatList
                data={filteredKnowledge}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron articulos.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{item.filename ?? "Documento"}</Text>
                    <Text style={styles.cardMeta}>
                      {item.asset ? `${item.asset.name} (${item.asset.assetId})` : "General"}
                    </Text>
                    <Text style={styles.helpText}>{item.category ?? "Archivo"}</Text>
                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => {
                          void openKnowledgeFile(item);
                        }}
                      >
                        <Text style={styles.secondaryButtonText}>Ver</Text>
                      </Pressable>
                      <Pressable
                        style={styles.ghostButton}
                        onPress={() => {
                          void downloadKnowledgeFile(item);
                        }}
                      >
                        <Text style={styles.ghostButtonText}>Descargar</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              />
            </View>
          ) : activeSection === "notifications" ? (
            <View style={styles.kbContainer}>
              <View style={[styles.headerRow, styles.screenPadH, { paddingTop: 12 }]}>
                <Text style={styles.sectionTitle}>Notificaciones</Text>
                {unreadCount > 0 ? (
                  <Pressable style={styles.ghostButton} onPress={markAllNotificationsRead}>
                    <Text style={styles.ghostButtonText}>Marcar todo leido</Text>
                  </Pressable>
                ) : null}
              </View>
              {notificationsLoading ? (
                <Text style={[styles.cardMeta, styles.screenPadH]}>Cargando notificaciones...</Text>
              ) : null}
              {notificationsError ? (
                <Text style={[styles.errorText, styles.screenPadH]}>{notificationsError}</Text>
              ) : null}
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                ListEmptyComponent={<Text style={styles.emptyText}>Sin notificaciones.</Text>}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.card,
                      !item.readAt && styles.notificationUnreadCard,
                    ]}
                    onPress={() => {
                      void openNotification(item);
                    }}
                  >
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.body ? <Text style={styles.cardMeta}>{item.body}</Text> : null}
                    <Text style={styles.helpText}>{new Date(item.createdAt).toLocaleString("es")}</Text>
                  </Pressable>
                )}
              />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.profileContainer}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Text style={[styles.sectionTitle, styles.screenPadH, { paddingTop: 16, paddingBottom: 8 }]}>
                Perfil del Operador
              </Text>
              {profileError ? (
                <Text style={[styles.errorText, styles.screenPadH]}>{profileError}</Text>
              ) : null}
              <View style={styles.section}>
                <Text style={styles.cardMeta}>Nombre: {me?.name ?? "—"}</Text>
                <Text style={styles.cardMeta}>Usuario: {me?.username ?? username}</Text>
                <Text style={styles.cardMeta}>Email: {me?.email ?? "Sin email"}</Text>
                <Text style={styles.cardMeta}>Rol: {me?.role ?? "operator"}</Text>
                <Text style={styles.cardMeta}>API Host: {API_HOST || "No configurado"}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Actualizar contrasena</Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Contrasena actual"
                  placeholderTextColor={theme.zinc400}
                  secureTextEntry
                  style={styles.input}
                />
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Nueva contrasena"
                  placeholderTextColor={theme.zinc400}
                  secureTextEntry
                  style={styles.input}
                />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirmar nueva contrasena"
                  placeholderTextColor={theme.zinc400}
                  secureTextEntry
                  style={styles.input}
                />
                {passwordMsg ? <Text style={styles.helpText}>{passwordMsg}</Text> : null}
                <Pressable style={styles.secondaryButton} disabled={profileBusy} onPress={updateMyPassword}>
                  <Text style={styles.secondaryButtonText}>
                    {profileBusy ? "Guardando..." : "Guardar contrasena"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sesion</Text>
                <Pressable style={styles.logoutButton} disabled={profileBusy} onPress={logout}>
                  <Text style={styles.logoutButtonText}>Cerrar sesion</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>

        <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
          <Pressable
            style={styles.bottomNavItem}
            onPress={() => {
              closeTaskDetail();
              setActiveSection("workOrders");
            }}
          >
            <Ionicons
              name="clipboard-outline"
              size={22}
              color={activeSection === "workOrders" ? theme.accent : theme.zinc500}
            />
            <Text style={[styles.bottomNavText, activeSection === "workOrders" && styles.bottomNavTextActive]}>
              Tareas
            </Text>
          </Pressable>
          <Pressable
            style={styles.bottomNavItem}
            onPress={() => {
              closeTaskDetail();
              setActiveSection("knowledgeBase");
            }}
          >
            <Ionicons
              name="library-outline"
              size={22}
              color={activeSection === "knowledgeBase" ? theme.accent : theme.zinc500}
            />
            <Text style={[styles.bottomNavText, activeSection === "knowledgeBase" && styles.bottomNavTextActive]}>
              Base
            </Text>
          </Pressable>
          <Pressable
            style={styles.bottomNavItem}
            onPress={() => {
              closeTaskDetail();
              setActiveSection("profile");
            }}
          >
            <Ionicons
              name="person-outline"
              size={22}
              color={activeSection === "profile" ? theme.accent : theme.zinc500}
            />
            <Text style={[styles.bottomNavText, activeSection === "profile" && styles.bottomNavTextActive]}>
              Perfil
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={inlinePdf != null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setInlinePdf(null)}
      >
        <View style={[styles.pdfModalRoot, { paddingTop: insets.top }]}>
          <View style={styles.pdfModalToolbar}>
            <Pressable
              onPress={() => setInlinePdf(null)}
              hitSlop={12}
              style={styles.pdfModalClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar documento"
            >
              <Ionicons name="close" size={28} color={theme.zinc700} />
            </Pressable>
            <Text style={styles.pdfModalTitle} numberOfLines={1}>
              {inlinePdf?.title ?? ""}
            </Text>
            <View style={styles.pdfModalClose} />
          </View>
          {inlinePdf ? (
            <WebView
              source={{ uri: inlinePdf.uri }}
              style={styles.pdfModalWeb}
              startInLoadingState
              originWhitelist={["*"]}
              {...(Platform.OS === "android" ? { mixedContentMode: "always" as const } : {})}
              renderLoading={() => (
                <View style={styles.pdfModalLoading}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={styles.pdfModalLoadingText}>Abriendo PDF…</Text>
                </View>
              )}
              onError={() => {
                Alert.alert(
                  "No se pudo mostrar el PDF",
                  "Prueba Descargar desde la base de conocimiento o abre el enlace en el navegador."
                );
              }}
            />
          ) : null}
        </View>
      </Modal>

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.surface },
  container: { flex: 1 },
  loginContainer: {
    justifyContent: "center",
    padding: 20,
    gap: 14,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  loginBrandMark: {
    color: theme.accent,
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  loginBrandTagline: {
    marginTop: 6,
    marginBottom: 20,
    color: theme.zinc600,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  loginTitle: {
    color: theme.zinc900,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  loginFieldBlock: { gap: 8 },
  loginLabel: { color: theme.zinc700, fontSize: 14, fontWeight: "600" },
  loginInput: {
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.zinc300,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.zinc900,
    fontSize: 15,
  },
  loginButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  loginKeyboardAvoid: { flex: 1, backgroundColor: theme.surface },
  loginScroll: { backgroundColor: theme.surface },
  loginScrollContent: { flexGrow: 1, justifyContent: "center" },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.zinc200,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  headerBrandBlock: { flex: 1, marginRight: 8 },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.accent,
    letterSpacing: -0.5,
  },
  headerGreeting: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: theme.zinc500,
  },
  headerAlertButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.zinc200,
    backgroundColor: theme.white,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAlertBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerAlertBadgeText: { color: theme.white, fontSize: 10, fontWeight: "700" },
  backIconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.zinc200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.white,
  },
  title: { fontSize: 22, fontWeight: "700", color: theme.zinc900 },
  subtitle: { fontSize: 14, color: theme.zinc600, marginBottom: 8 },
  logout: { color: theme.primary, fontWeight: "600" },
  input: {
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.zinc300,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.zinc900,
  },
  primaryButton: {
    backgroundColor: theme.accent,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c43d02",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: theme.white, fontSize: 16, fontWeight: "700" },
  errorText: { color: theme.red600, fontSize: 13 },
  contentArea: { flex: 1, paddingHorizontal: 0, paddingTop: 0, backgroundColor: theme.white },
  screenPadH: { paddingHorizontal: 16 },
  profileContainer: { gap: 0, paddingBottom: 26, paddingHorizontal: 0, backgroundColor: theme.white },
  kbContainer: { flex: 1, gap: 0, paddingHorizontal: 0, backgroundColor: theme.white },
  detailContent: { gap: 0, paddingBottom: 28, backgroundColor: theme.white },
  detailTopBar: { marginBottom: 4, paddingHorizontal: 16, paddingTop: 4 },
  detailBreadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  detailBreadcrumbLink: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.accent,
  },
  detailBreadcrumbSep: { fontSize: 14, color: theme.zinc400 },
  detailBreadcrumbCurrent: { fontSize: 14, color: theme.zinc600, flex: 1, minWidth: 0 },
  detailPageTitle: {
    color: theme.zinc900,
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: -0.3,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  detailPanel: { marginBottom: 0 },
  detailPanelKicker: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: theme.zinc500,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  detailStatusBanner: {
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  detailStatusBannerText: { fontSize: 15, fontWeight: "700" },
  detailStatusOpen: { backgroundColor: "#FEF3C7" },
  detailStatusOpenText: { color: "#92400E" },
  detailStatusInProgress: { backgroundColor: "#DBEAFE" },
  detailStatusInProgressText: { color: "#1E40AF" },
  detailStatusCompleted: { backgroundColor: "#D1FAE5" },
  detailStatusCompletedText: { color: "#065F46" },
  detailStatusCancelled: { backgroundColor: theme.zinc100 },
  detailStatusCancelledText: { color: theme.zinc600 },
  detailSection: {
    marginTop: 4,
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.zinc200,
    backgroundColor: theme.white,
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: theme.zinc500,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  detailSectionSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.zinc400,
    paddingHorizontal: 16,
    marginTop: -4,
    marginBottom: 10,
  },
  detailSectionBody: { paddingHorizontal: 16, gap: 0 },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  detailRowLabel: {
    width: "38%",
    maxWidth: 140,
    fontSize: 14,
    color: theme.zinc500,
  },
  detailRowValue: { flex: 1, minWidth: 0 },
  detailRowInline: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailRowValueText: { fontSize: 14, fontWeight: "600", color: theme.zinc900 },
  detailRowSub: { fontSize: 12, fontWeight: "400", color: theme.zinc500, marginTop: 2 },
  detailRowMuted: { fontSize: 14, color: theme.zinc400 },
  detailRowDivider: { height: 1, backgroundColor: theme.zinc100, marginLeft: 0 },
  detailDescriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.zinc800,
  },
  checklistHint: { fontSize: 12, color: "#B45309", marginBottom: 12 },
  checklistHintStrong: { fontWeight: "700" },
  attachmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  attachmentCell: {
    width: "32%",
    flexGrow: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.zinc200,
    overflow: "hidden",
    backgroundColor: theme.zinc50,
  },
  attachmentThumb: { width: "100%", aspectRatio: 1, backgroundColor: theme.zinc100 },
  attachmentPdfThumb: { alignItems: "center", justifyContent: "center" },
  attachmentCaption: { fontSize: 11, color: theme.zinc500, paddingHorizontal: 6, paddingVertical: 4 },
  activityNote: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginTop: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.zinc100,
  },
  activityNoteBody: { fontSize: 14, color: theme.zinc900 },
  activityNoteMeta: { marginTop: 6, fontSize: 12, color: theme.zinc400 },
  dashboardScroll: { flex: 1 },
  dashboardScrollContent: { paddingBottom: 24, flexGrow: 1, paddingHorizontal: 0 },
  dashboardSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  dashboardSectionHeaderSpaced: { marginTop: 16 },
  dashboardSectionKicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: theme.zinc500,
  },
  dashboardSectionCount: { fontSize: 13, fontWeight: "700", color: theme.zinc600 },
  dashboardActiveBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dashboardActiveBadgeText: { fontSize: 11, fontWeight: "800", color: "#1E40AF" },
  dashboardSortLink: { fontSize: 13, fontWeight: "700", color: theme.primary },
  dashboardEmpty: { fontSize: 14, color: theme.zinc500, marginBottom: 12, paddingHorizontal: 16 },
  ongoingHero: {
    backgroundColor: theme.white,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.zinc200,
  },
  ongoingHeroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  ongoingHeroTopText: { flex: 1, minWidth: 0 },
  taskCardAvatarPriorityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  taskCardAvatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.zinc100,
    borderWidth: 1,
    borderColor: theme.zinc200,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCardAvatarImage: { width: 28, height: 28 },
  ongoingAssetKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: theme.zinc400,
    marginBottom: 6,
  },
  ongoingHeroTitle: { fontSize: 18, fontWeight: "700", color: theme.zinc900, lineHeight: 24 },
  ongoingTimerStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: theme.zinc100,
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  ongoingTimerCol: { flex: 1, justifyContent: "center" },
  ongoingTimerDigits: { fontSize: 26, fontWeight: "800", color: theme.zinc900 },
  ongoingTimerHint: { fontSize: 11, color: theme.zinc500, marginTop: 2 },
  ongoingTimerDivider: { width: 1, backgroundColor: theme.zinc300, marginHorizontal: 10 },
  ongoingTimerEstLabel: { fontSize: 10, fontWeight: "700", color: theme.zinc400, letterSpacing: 0.5 },
  ongoingTimerEstValue: { fontSize: 13, fontWeight: "700", color: theme.zinc800, marginTop: 4 },
  ongoingCompleteMain: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  ongoingCompleteMainText: { color: theme.white, fontSize: 16, fontWeight: "700" },
  ongoingSecondaryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  ongoingPauseBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.zinc300,
    backgroundColor: theme.white,
  },
  ongoingPauseBtnText: { fontSize: 15, fontWeight: "700", color: theme.zinc700 },
  ongoingMoreBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.zinc300,
    backgroundColor: theme.white,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingCard: {
    backgroundColor: theme.white,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.zinc200,
    borderLeftWidth: 4,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  pendingCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  pendingPriorityPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pendingPriorityPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  pendingDurationPill: {
    backgroundColor: theme.zinc100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pendingDurationPillText: { fontSize: 12, fontWeight: "700", color: theme.zinc600 },
  pendingCardTitle: { fontSize: 16, fontWeight: "700", color: theme.zinc900, marginBottom: 10 },
  pendingMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  pendingMetaText: { flex: 1, fontSize: 13, color: theme.zinc600 },
  pendingCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
  },
  completedRowCard: {
    backgroundColor: theme.white,
    borderRadius: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.zinc200,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 0,
  },
  completedRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  completedRowTextCol: { flex: 1, minWidth: 0 },
  completedRowTitle: { fontSize: 14, fontWeight: "600", color: theme.zinc800 },
  completedRowMeta: { fontSize: 12, color: theme.zinc500, marginTop: 4 },
  assigneeRing: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: theme.zinc200,
    borderWidth: 1,
    borderColor: theme.zinc200,
    alignItems: "center",
    justifyContent: "center",
  },
  assigneeRingText: { fontSize: 9, fontWeight: "800", color: theme.zinc700 },
  kindBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  kindBadgeRoutine: {
    backgroundColor: theme.primary,
    borderWidth: 1,
    borderColor: "#011752",
  },
  kindBadgeOnDemand: {
    backgroundColor: theme.accent,
    borderWidth: 1,
    borderColor: "#c43d06",
  },
  kindBadgeText: {
    color: theme.white,
    fontSize: 11,
    fontWeight: "700",
  },
  section: {
    gap: 10,
    marginTop: 0,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: theme.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.zinc200,
  },
  sectionTitle: { color: theme.zinc900, fontSize: 16, fontWeight: "700" },
  helpText: { color: theme.zinc500, fontSize: 12 },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: { color: theme.white, fontWeight: "700" },
  ghostButton: {
    borderWidth: 1,
    borderColor: theme.zinc300,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    backgroundColor: theme.white,
  },
  ghostButtonText: { color: theme.primary, fontWeight: "600" },
  logoutButton: {
    backgroundColor: theme.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.zinc300,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  logoutButtonText: { color: theme.zinc700, fontWeight: "700" },
  checklistCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.zinc100,
    gap: 8,
    marginBottom: 0,
  },
  checklistHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  checklistFieldReadOnly: {
    fontSize: 15,
    color: theme.zinc700,
    paddingVertical: 4,
  },
  checkBullet: { width: 12, height: 12, borderRadius: 999 },
  checkBulletDone: { backgroundColor: "#6FAF6F" },
  checkBulletTodo: { backgroundColor: theme.accent },
  textarea: {
    minHeight: 90,
    textAlignVertical: "top",
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.zinc300,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.zinc900,
  },
  canvasShell: {
    flex: 1,
    backgroundColor: theme.white,
    borderRadius: 0,
    borderWidth: 0,
    paddingTop: 10,
    paddingBottom: 0,
    paddingHorizontal: 0,
    gap: 6,
    marginBottom: 0,
  },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  filterTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.primary50,
    borderWidth: 1,
    borderColor: theme.primary200,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterTagText: { color: theme.zinc900, fontWeight: "600", fontSize: 12 },
  filterTagRemove: { color: theme.accent, fontWeight: "700", fontSize: 12 },
  filterUsersScroll: { flexGrow: 0, maxHeight: 44 },
  filterUsersRow: { gap: 8, alignItems: "center", paddingRight: 16, paddingLeft: 16 },
  userFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.zinc300,
    backgroundColor: theme.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "center",
  },
  userFilterChipActive: {
    backgroundColor: theme.primary,
    borderColor: "#1E4A96",
  },
  userFilterChipText: { color: theme.zinc700, fontSize: 12, fontWeight: "600" },
  userFilterChipTextActive: { color: theme.white },
  bottomNav: {
    flexDirection: "row",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: theme.zinc200,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 8,
    backgroundColor: theme.white,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 6,
    backgroundColor: "transparent",
  },
  bottomNavText: {
    color: theme.zinc500,
    fontWeight: "600",
    fontSize: 11,
  },
  bottomNavTextActive: {
    color: theme.accent,
  },
  listContent: { gap: 0, paddingBottom: 24 },
  card: {
    backgroundColor: theme.white,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.zinc200,
    gap: 6,
  },
  notificationUnreadCard: {
    backgroundColor: theme.primary50,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: theme.zinc900, marginBottom: 4 },
  cardMeta: { color: theme.zinc600, fontSize: 13 },
  emptyText: { color: theme.zinc500, textAlign: "center", marginTop: 12 },
  loadMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 0,
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.zinc200,
    backgroundColor: theme.zinc50,
    paddingVertical: 14,
    marginHorizontal: 0,
    marginTop: 4,
  },
  loadMoreButtonText: {
    color: theme.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  pdfModalRoot: { flex: 1, backgroundColor: theme.white },
  pdfModalToolbar: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.zinc200,
    backgroundColor: theme.white,
  },
  pdfModalClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfModalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: theme.zinc900,
    textAlign: "center",
    marginHorizontal: 4,
  },
  pdfModalWeb: { flex: 1, backgroundColor: theme.zinc100 },
  pdfModalLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.white,
  },
  pdfModalLoadingText: { marginTop: 14, fontSize: 14, color: theme.zinc500 },
});
