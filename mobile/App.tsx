import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const APP_TIME_ZONE = "America/Monterrey";

type AppSection = "workOrders" | "knowledgeBase" | "notifications" | "profile";
type WoStatus = "pending" | "in_progress" | "completed" | "cancelled";

/** API + DB use `pending`; legacy rows or clients may still send `open`. */
function normalizeWoStatus(raw: unknown): WoStatus {
  if (raw === "open") return "pending";
  if (raw === "pending" || raw === "in_progress" || raw === "completed" || raw === "cancelled") {
    return raw;
  }
  return "pending";
}

function statusLabel(status: WoStatus): string {
  if (status === "pending") return "Pendiente";
  if (status === "in_progress") return "En progreso";
  if (status === "completed") return "Completada";
  return "Cancelada";
}
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
  assigneeAvatarBackgroundColor?: string | null;
  createdAt?: string;
  /** When status is completed; used to sort completed list (newest first). */
  completedAt?: string | null;
  boardSortOrder?: number;
};

type ChecklistItem = {
  id: string;
  type: "step" | "field";
  label: string;
  completed: boolean | null;
  value: unknown;
  fieldType: string | null;
  options?: string[] | null | unknown;
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

function checklistDropdownOptions(item: { options?: unknown }): string[] {
  const raw = item.options;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function parseChecklistDateValue(value: unknown): Date {
  const fallback = new Date();
  fallback.setHours(12, 0, 0, 0);
  if (value == null) return fallback;
  const s = String(value).trim();
  if (s.length >= 10) {
    const iso = s.slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const dt = new Date(y, mo, d);
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  return fallback;
}

function formatDateToChecklistIso(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function formatChecklistDateDisplay(value: unknown): string {
  if (value == null || String(value).trim() === "") return "";
  const d = parseChecklistDateValue(value);
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });
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
  assignee?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    avatarBackgroundColor?: string | null;
  } | null;
  requester?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    avatarBackgroundColor?: string | null;
  } | null;
  checklist: ChecklistItem[];
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
  avatarBackgroundColor?: string | null;
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
  username?: string;
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

const AVATAR_PALETTE = [
  "#02257D",
  "#0D3170",
  "#3355AA",
  "#011A5C",
  "#F14C03",
  "#C43D02",
  "#9E9F9F",
  "#000000",
  "#6FAF6F",
  "#E85A0A",
] as const;
const HEX_BG = /^#[0-9a-fA-F]{6}$/;

function avatarBackgroundFromSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx]!;
}

function resolveAvatarBackgroundColor(
  userId: string | null | undefined,
  name: string,
  stored: string | null | undefined
): string {
  const t = typeof stored === "string" ? stored.trim() : "";
  if (t !== "" && HEX_BG.test(t)) return t;
  const seed = (userId ?? "").trim() || name.trim() || "unknown";
  return avatarBackgroundFromSeed(seed);
}

type WorkOrderKind = "routine" | "on_demand";

/** Main task list: one status bucket at a time. */
type TaskListTab = "pending" | "in_progress" | "completed";

type TaskListKindFilter = "all" | WorkOrderKind;

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
      <Text style={[styles.kindBadgeText, k === "routine" ? styles.kindBadgeTextRoutine : styles.kindBadgeTextOnDemand]}>
        {workOrderKindLabel(k)}
      </Text>
    </View>
  );
}

function WorkOrderStatusBadge({ status }: { status: WoStatus }) {
  const pill =
    status === "pending"
      ? styles.woStatusBadgePending
      : status === "in_progress"
        ? styles.woStatusBadgeInProgress
        : status === "completed"
          ? styles.woStatusBadgeCompleted
          : styles.woStatusBadgeCancelled;
  const pillText =
    status === "pending"
      ? styles.woStatusBadgePendingText
      : status === "in_progress"
        ? styles.woStatusBadgeInProgressText
        : status === "completed"
          ? styles.woStatusBadgeCompletedText
          : styles.woStatusBadgeCancelledText;
  return (
    <View style={[styles.woStatusBadge, pill]} accessibilityRole="text">
      <Text style={[styles.woStatusBadgeLabel, pillText]} numberOfLines={1}>
        {statusLabel(status)}
      </Text>
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
  return d.toLocaleDateString("es-MX", {
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  });
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
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  });
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

function AssigneeInitialsRing({
  name,
  userId,
  avatarBackgroundColor,
}: {
  name: string;
  userId?: string | null;
  avatarBackgroundColor?: string | null;
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
      : (parts[0]?.slice(0, 2).toUpperCase() ?? "?");
  const bg = resolveAvatarBackgroundColor(userId, name, avatarBackgroundColor);
  return (
    <View style={[styles.assigneeRing, { backgroundColor: bg, borderColor: bg }]} accessibilityLabel={name}>
      <Text style={styles.assigneeRingText}>{initials}</Text>
    </View>
  );
}

function absoluteFileUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_HOST}${path}`;
}

function ensureFileScheme(uri: string): string {
  if (uri.startsWith("file://")) return uri;
  if (uri.startsWith("/")) return `file://${uri}`;
  return uri;
}

function looksLikePdf(filename: string | null | undefined, urlOrPath: string): boolean {
  const name = (filename ?? "").trim().toLowerCase();
  if (name.endsWith(".pdf")) return true;
  const pathOnly = urlOrPath.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  return pathOnly.endsWith(".pdf");
}

function looksLikeImageFilename(filename: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(filename.trim());
}

type KnowledgeFileKind = "pdf" | "image" | "other";

function knowledgeFileKind(filename: string, fileUrl: string): KnowledgeFileKind {
  if (looksLikePdf(filename, fileUrl)) return "pdf";
  if (looksLikeImageFilename(filename)) return "image";
  return "other";
}

function kbFileIonIcon(kind: KnowledgeFileKind): ComponentProps<typeof Ionicons>["name"] {
  if (kind === "pdf") return "document-text";
  if (kind === "image") return "image-outline";
  return "document-attach-outline";
}

const KB_CACHE_SUBDIR = "kb-cache";

function kbSafeLocalName(filename: string): string {
  const base = filename.trim() || "archivo";
  return base.replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}

/** Avatar on task list cards: photo when `avatarUrl` exists (same paths as web), else initials ring. */
function TaskCardAssigneeAvatar({
  name,
  userId,
  avatarUrl,
  avatarBackgroundColor,
}: {
  name: string | null | undefined;
  userId?: string | null;
  avatarUrl?: string | null;
  avatarBackgroundColor?: string | null;
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
        <AssigneeInitialsRing
          name={displayName}
          userId={userId}
          avatarBackgroundColor={avatarBackgroundColor}
        />
      </View>
    );
  }
  return null;
}

/** Rail and thumb: larger targets for gloves / factory floor use. */
const SLIDE_TRACK_HEIGHT = 60;
/** Rounded rectangle track (not a stadium / oval). */
const SLIDE_TRACK_RADIUS = 12;
const SLIDE_THUMB_WIDTH = 84;
const SLIDE_THUMB_HEIGHT = 52;
/** Rounded rectangle (not a circle) so the handle reads clearly as a “button”. */
const SLIDE_THUMB_RADIUS = 12;
const SLIDE_RAIL_INSET_X = 6;
const SLIDE_LABEL_GAP = 10;
/** Nudge up ~1dp: drop shadow reads as extra weight below the thumb. */
const SLIDE_THUMB_TOP = (SLIDE_TRACK_HEIGHT - SLIDE_THUMB_HEIGHT) / 2 - 1;

/** Bottom dock chrome — keep `detail` scroll `paddingBottom` in sync with the dock `View`. */
const TASK_SLIDE_DOCK_PADDING_TOP = 14;
const TASK_SLIDE_DOCK_PADDING_X = 14;
const TASK_SLIDE_DOCK_SAFE_MIN = 16;
/** Match `TASK_SLIDE_DOCK_PADDING_TOP` so breathing room below the rail matches above (safe area is extra). */
const TASK_SLIDE_DOCK_BELOW_RAIL = 14;
/** Two-line hint + `taskSlideDockHint` margin below. */
const TASK_SLIDE_DOCK_HINT_SCROLL_EXTRA = 56;

type SlideToConfirmProps = {
  label: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "success";
  /** Change when the underlying task changes so the thumb snaps back to the start. */
  resetKey: string;
};

/** Horizontal slide-to-confirm control (iPhone-style unlock rail). */
function SlideToConfirm({ label, onConfirm, disabled, variant = "primary", resetKey }: SlideToConfirmProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const dragOrigin = useRef(0);
  const lastSetX = useRef(0);
  const maxDragRef = useRef(0);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const disabledRef = useRef(!!disabled);
  disabledRef.current = !!disabled;
  const [trackWidth, setTrackWidth] = useState(0);
  const maxDrag = Math.max(0, trackWidth - SLIDE_THUMB_WIDTH - SLIDE_RAIL_INSET_X * 2);
  maxDragRef.current = maxDrag;

  useEffect(() => {
    translateX.setValue(0);
    lastSetX.current = 0;
    dragOrigin.current = 0;
  }, [resetKey, translateX]);

  useEffect(() => {
    if (maxDrag <= 0) return;
    if (lastSetX.current > maxDrag) {
      const clamped = maxDrag;
      lastSetX.current = clamped;
      translateX.setValue(clamped);
    }
  }, [maxDrag, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: (_, g) => {
          if (disabledRef.current) return false;
          return Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy) + 1;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragOrigin.current = lastSetX.current;
        },
        onPanResponderMove: (_, g) => {
          const m = maxDragRef.current;
          if (disabledRef.current || m <= 0) return;
          const nx = Math.min(m, Math.max(0, dragOrigin.current + g.dx));
          lastSetX.current = nx;
          translateX.setValue(nx);
        },
        onPanResponderRelease: (_, g) => {
          const m = maxDragRef.current;
          const vx = Number.isFinite(g.vx) ? g.vx : 0;
          if (disabledRef.current || m <= 0) {
            Animated.spring(translateX, {
              toValue: 0,
              friction: 7,
              tension: 520,
              velocity: vx,
              useNativeDriver: true,
            }).start(() => {
              lastSetX.current = 0;
            });
            return;
          }
          const nx = lastSetX.current;
          const ratio = nx / m;
          if (ratio >= 0.78) {
            void Promise.resolve(onConfirmRef.current());
            Animated.spring(translateX, {
              toValue: m,
              friction: 7,
              tension: 380,
              velocity: vx,
              restDisplacementThreshold: 0.5,
              restSpeedThreshold: 0.5,
              useNativeDriver: true,
            }).start(() => {
              translateX.setValue(0);
              lastSetX.current = 0;
            });
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              friction: 7,
              tension: 520,
              velocity: vx,
              restDisplacementThreshold: 0.5,
              restSpeedThreshold: 0.5,
              useNativeDriver: true,
            }).start(() => {
              lastSetX.current = 0;
            });
          }
        },
      }),
    [translateX]
  );

  const trackStyles = [
    styles.slideTrack,
    variant === "primary" ? styles.slideTrackPrimary : styles.slideTrackSuccess,
    disabled ? styles.slideTrackDisabled : null,
  ];

  return (
    <View style={styles.slideToConfirmRoot}>
      <View
        style={trackStyles}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.slideTrackLabelSlot} pointerEvents="none">
          <Text
            style={[
              styles.slideTrackLabel,
              variant === "primary" && !disabled && styles.slideTrackLabelPrimary,
              disabled && styles.slideTrackLabelDisabled,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
        <Animated.View
          style={[
            styles.slideThumb,
            variant === "primary" ? styles.slideThumbPrimary : styles.slideThumbSuccess,
            disabled && styles.slideThumbDisabled,
            { transform: [{ translateX }] },
          ]}
          {...(disabled ? {} : panResponder.panHandlers)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: !!disabled }}
        >
          <Ionicons
            name="chevron-forward"
            size={28}
            color={disabled ? "#713F12" : variant === "primary" ? theme.primary : "#047857"}
          />
        </Animated.View>
      </View>
    </View>
  );
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

type WorkOrderAttachmentUploadResponse = {
  id: string;
  fileUrl: string;
  filename: string;
  createdAt: string;
};

function sanitizeUploadFilename(name: string): string {
  const n = name.trim().replace(/[/\\?%*:|"<>]/g, "_").replace(/^\.+/, "").slice(0, 120);
  return n || "foto.jpg";
}

/**
 * ImagePicker often returns `content://` (Android) or non-file URIs that React Native's
 * `fetch`+FormData cannot read — that surfaces as "Network request failed". Copy to a
 * real `file://` path first; then use expo-file-system multipart upload (reliable on device).
 */
async function prepareImageFileForUpload(fileUri: string, filename: string): Promise<{
  localUri: string;
  removeAfter: boolean;
}> {
  const safeName = sanitizeUploadFilename(filename);
  if (fileUri.startsWith("file://")) {
    return { localUri: fileUri, removeAfter: false };
  }
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) {
    throw new Error("No hay carpeta temporal para preparar la foto.");
  }
  const dest = `${base}wo-upload-${Date.now()}-${safeName}`;
  await FileSystem.copyAsync({ from: fileUri, to: dest });
  return { localUri: dest, removeAfter: true };
}

async function apiUploadWorkOrderImage(
  workOrderId: string,
  fileUri: string,
  filename: string,
  mimeType: string
): Promise<WorkOrderAttachmentUploadResponse> {
  const safeName = sanitizeUploadFilename(filename);
  const mime = mimeType?.trim() || "image/jpeg";
  const url = apiUrl(`/api/work-orders/${workOrderId}/attachments`);

  const { localUri, removeAfter } = await prepareImageFileForUpload(fileUri, safeName);
  try {
    const form = new FormData();
    form.append(
      "file",
      { uri: localUri, name: safeName, type: mime } as unknown as Blob
    );
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data?.error === "string" ? data.error : "No se pudo subir la imagen"
      );
    }
    return data as WorkOrderAttachmentUploadResponse;
  } finally {
    if (removeAfter) {
      await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    }
  }
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
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeSection, setActiveSection] = useState<AppSection>("workOrders");

  const [workOrders, setWorkOrders] = useState<WorkOrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [taskListTab, setTaskListTab] = useState<TaskListTab>("pending");
  const [taskFilterModalVisible, setTaskFilterModalVisible] = useState(false);
  const taskFilterSheetTranslateY = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;
  const taskFilterBackdropOpacity = useRef(new Animated.Value(0)).current;
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<TaskListKindFilter>("all");
  const [completedVisibleCount, setCompletedVisibleCount] = useState(COMPLETED_INITIAL_VISIBLE);
  const [taskListTick, setTaskListTick] = useState(0);

  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [workOrdersRefreshing, setWorkOrdersRefreshing] = useState(false);
  const [detailRefreshing, setDetailRefreshing] = useState(false);
  /** Task "Detalles" card: collapsed by default. */
  const [detailDetailsExpanded, setDetailDetailsExpanded] = useState(false);
  const [notificationsRefreshing, setNotificationsRefreshing] = useState(false);
  /** Draft strings for number fields while editing (allows "12." before blur). */
  const [checklistNumberDraft, setChecklistNumberDraft] = useState<Record<string, string>>({});
  const [checklistDropdownModal, setChecklistDropdownModal] = useState<{
    itemId: string;
    label: string;
    options: string[];
  } | null>(null);
  const [checklistPhotoUploadingId, setChecklistPhotoUploadingId] = useState<string | null>(null);
  const [checklistDatePicker, setChecklistDatePicker] = useState<{
    itemId: string;
    draft: Date;
  } | null>(null);

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
  const [inlineImage, setInlineImage] = useState<{ uri: string; title: string } | null>(null);
  const [kbOpeningId, setKbOpeningId] = useState<string | null>(null);
  /** After login, default assignee filter to current user once per session. */
  const assigneeFilterDefaultAppliedRef = useRef(false);

  const canLogin = username.trim().length > 0 && password.trim().length > 0;
  const firstName = useMemo(() => {
    const source = (me?.name ?? username).trim();
    if (!source) return "Operador";
    return source.split(/\s+/)[0] ?? "Operador";
  }, [me?.name, username]);

  const closeTaskFilterModal = useCallback(() => {
    const h = Dimensions.get("window").height;
    Animated.parallel([
      Animated.timing(taskFilterSheetTranslateY, {
        toValue: h,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(taskFilterBackdropOpacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start((r) => {
      if (r.finished) setTaskFilterModalVisible(false);
    });
  }, [taskFilterSheetTranslateY, taskFilterBackdropOpacity]);

  useLayoutEffect(() => {
    const h = Dimensions.get("window").height;
    if (!taskFilterModalVisible) {
      taskFilterSheetTranslateY.setValue(h);
      taskFilterBackdropOpacity.setValue(0);
      return;
    }
    taskFilterSheetTranslateY.setValue(h);
    taskFilterBackdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(taskFilterSheetTranslateY, {
        toValue: 0,
        friction: 12,
        tension: 68,
        useNativeDriver: true,
      }),
      Animated.timing(taskFilterBackdropOpacity, {
        toValue: 0.45,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [taskFilterModalVisible, taskFilterSheetTranslateY, taskFilterBackdropOpacity]);

  const filteredKnowledge = useMemo(() => {
    const q = kbQuery.trim().toLowerCase();
    if (!q) return knowledge;
    return knowledge.filter((item) =>
      `${item.filename ?? ""} ${item.category ?? ""} ${item.asset?.name ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [knowledge, kbQuery]);

  const workOrdersFiltered = useMemo(() => {
    let list = workOrders;
    if (filterAssigneeId != null) {
      list = list.filter((w) => w.assigneeId === filterAssigneeId);
    }
    if (filterKind !== "all") {
      list = list.filter((w) => parseWorkOrderKind(w.kind) === filterKind);
    }
    return list;
  }, [workOrders, filterAssigneeId, filterKind]);

  const ongoingTasksCountMine = useMemo(() => {
    if (me == null) return 0;
    return workOrders.filter(
      (w) => w.status === "in_progress" && w.assigneeId === me.id
    ).length;
  }, [workOrders, me]);

  const ongoingTasks = useMemo(
    () => workOrdersFiltered.filter((w) => w.status === "in_progress"),
    [workOrdersFiltered]
  );
  const pendingQueueTasks = useMemo(
    () => workOrdersFiltered.filter((w) => w.status === "pending"),
    [workOrdersFiltered]
  );
  const pendingTasksSorted = useMemo(() => {
    const list = [...pendingQueueTasks];
    const rank: Record<WoPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    list.sort((a, b) => {
      const pr = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
      if (pr !== 0) return pr;
      const o = (a.boardSortOrder ?? 0) - (b.boardSortOrder ?? 0);
      if (o !== 0) return o;
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [pendingQueueTasks]);

  const completedTasks = useMemo(() => {
    const list = workOrdersFiltered.filter((w) => w.status === "completed");
    function sortTime(w: WorkOrderListItem): number {
      if (w.completedAt) {
        const t = new Date(w.completedAt).getTime();
        if (!Number.isNaN(t)) return t;
      }
      if (w.createdAt) {
        const t = new Date(w.createdAt).getTime();
        if (!Number.isNaN(t)) return t;
      }
      return 0;
    }
    return [...list].sort((a, b) => sortTime(b) - sortTime(a));
  }, [workOrdersFiltered]);
  const completedTasksVisible = useMemo(
    () => completedTasks.slice(0, completedVisibleCount),
    [completedTasks, completedVisibleCount]
  );

  /** Badge: non-default assignee (incl. "Todos") or type filter. Default = current user only. */
  const taskFiltersActive =
    filterKind !== "all" || (me != null && filterAssigneeId !== me.id);

  async function loadWorkOrders() {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const data = await apiFetch<WorkOrderListItem[]>(`/api/work-orders`);
      const rows = Array.isArray(data) ? data : [];
      setWorkOrders(
        rows.map((w) => ({
          ...w,
          status: normalizeWoStatus(w.status),
        }))
      );
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
      setKbError(error instanceof Error ? error.message : "No se pudo cargar la biblioteca.");
      setKnowledge([]);
    } finally {
      setKbLoading(false);
    }
  }

  async function openKnowledgeItem(item: KnowledgeItem) {
    setKbError(null);
    setKbOpeningId(item.id);
    try {
      const remoteUrl = absoluteFileUrl(item.fileUrl);
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error("No hay almacenamiento disponible en el dispositivo.");
      }
      const dir = `${baseDir}${KB_CACHE_SUBDIR}/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
      const localPath = `${dir}${item.id}_${kbSafeLocalName(item.filename)}`;
      const info = await FileSystem.getInfoAsync(localPath);
      let localUri = ensureFileScheme(localPath);
      if (!info.exists) {
        const result = await FileSystem.downloadAsync(remoteUrl, localPath);
        localUri = ensureFileScheme(result.uri);
      }
      const kind = knowledgeFileKind(item.filename, item.fileUrl);
      const title = item.filename?.trim() || "Documento";
      if (kind === "image") {
        setInlineImage({ uri: localUri, title });
      } else {
        setInlinePdf({ uri: localUri, title });
      }
    } catch (error) {
      setKbError(error instanceof Error ? error.message : "No se pudo abrir el archivo.");
    } finally {
      setKbOpeningId(null);
    }
  }

  function openWorkOrderImageLightbox(fileUrl: string, title: string) {
    setInlineImage({
      uri: absoluteFileUrl(fileUrl),
      title: title.trim() || "Imagen",
    });
  }

  function openAttachmentUrl(fileUrl: string, filename: string) {
    const url = absoluteFileUrl(fileUrl);
    if (looksLikePdf(filename, fileUrl)) {
      setInlinePdf({ uri: url, title: filename.trim() || "PDF" });
    } else if (looksLikeImageFilename(filename) || /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(fileUrl)) {
      openWorkOrderImageLightbox(fileUrl, filename);
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

  async function loadInitialData() {
    await Promise.all([loadWorkOrders(), loadKnowledge(), loadMe(), loadNotifications(), loadUsers()]);
  }

  async function refreshWorkOrdersFeed() {
    setWorkOrdersRefreshing(true);
    try {
      await Promise.all([loadWorkOrders(), loadUsers()]);
    } finally {
      setWorkOrdersRefreshing(false);
    }
  }

  async function refreshSelectedWorkOrderDetail() {
    if (!selectedWorkOrderId) return;
    setDetailRefreshing(true);
    try {
      await openWorkOrder(selectedWorkOrderId);
    } finally {
      setDetailRefreshing(false);
    }
  }

  async function refreshNotificationsFeed() {
    setNotificationsRefreshing(true);
    try {
      await loadNotifications();
    } finally {
      setNotificationsRefreshing(false);
    }
  }

  const closeTaskDetail = useCallback(() => {
    setSelectedWorkOrderId(null);
    setSelectedWorkOrder(null);
    setDetailError(null);
  }, []);

  async function openWorkOrder(id: string, opts?: { silent?: boolean }) {
    const silent = opts?.silent === true;
    setSelectedWorkOrderId(id);
    if (!silent) {
      setDetailLoading(true);
      setDetailError(null);
    }
    try {
      const data = await apiFetch<WorkOrderDetail>(`/api/work-orders/${id}`);
      setSelectedWorkOrder({ ...data, status: normalizeWoStatus(data.status) });
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No se pudo cargar detalle.");
      if (!silent) {
        setSelectedWorkOrder(null);
      }
    } finally {
      if (!silent) {
        setDetailLoading(false);
      }
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
      await loadInitialData();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Error de autenticacion.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function ensureChecklistCompleteBeforeClose(workOrderId: string): Promise<boolean> {
    if (selectedWorkOrderId === workOrderId && selectedWorkOrder != null) {
      if (selectedWorkOrder.checklist.length === 0) return true;
      if (!isChecklistFullyComplete(selectedWorkOrder.checklist)) {
        Alert.alert(
          "Checklist incompleto",
          "Marca todos los pasos y completa los campos del checklist antes de cerrar la tarea."
        );
        return false;
      }
      return true;
    }
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
    const detailSnapshot =
      selectedWorkOrderId === id && selectedWorkOrder != null ? selectedWorkOrder : null;
    try {
      if (next === "completed") {
        const checklistOk = await ensureChecklistCompleteBeforeClose(id);
        if (!checklistOk) return;
      }
      if (detailSnapshot != null) {
        setSelectedWorkOrder((wo) => {
          if (!wo || wo.id !== id) return wo;
          if (next === "completed") {
            return { ...wo, status: "completed", completedAt: new Date().toISOString() };
          }
          if (next === "in_progress") {
            return { ...wo, status: "in_progress" };
          }
          if (next === "pending") {
            return { ...wo, status: "pending" };
          }
          return wo;
        });
      }
      await apiFetch<{ ok: true }>(`/api/work-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      void loadWorkOrders();
      if (selectedWorkOrderId === id) {
        void openWorkOrder(id, { silent: true });
      }
    } catch (error) {
      if (detailSnapshot != null) {
        setSelectedWorkOrder(detailSnapshot);
      }
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
    const woId = selectedWorkOrder.id;
    const snapshot = selectedWorkOrder;
    setSelectedWorkOrder((wo) => {
      if (!wo) return wo;
      return {
        ...wo,
        checklist: wo.checklist.map((i) => {
          if (i.id !== itemId) return i;
          return {
            ...i,
            ...(payload.completed !== undefined ? { completed: payload.completed } : {}),
            ...(payload.value !== undefined ? { value: payload.value } : {}),
          };
        }),
      };
    });
    try {
      await apiFetch<{ ok: true }>(`/api/work-orders/${woId}/checklist`, {
        method: "PATCH",
        body: JSON.stringify({ itemId, ...payload }),
      });
    } catch (error) {
      setSelectedWorkOrder(snapshot);
      setDetailError(error instanceof Error ? error.message : "No se pudo actualizar checklist.");
    }
  }

  async function finalizeChecklistPhotoFromPicker(
    itemId: string,
    result: ImagePicker.ImagePickerResult
  ) {
    if (result.canceled || !result.assets?.[0]) return;
    const wo = selectedWorkOrder;
    if (!wo) return;
    const asset = result.assets[0];
    setChecklistPhotoUploadingId(itemId);
    setDetailError(null);
    try {
      const mime = asset.mimeType ?? "image/jpeg";
      let filename =
        asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120) ?? "";
      if (!filename) {
        const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
        filename = `evidencia${ext}`;
      }
      const uploaded = await apiUploadWorkOrderImage(wo.id, asset.uri, filename, mime);
      await updateChecklist(itemId, { value: uploaded.fileUrl });
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No se pudo subir la foto.");
    } finally {
      setChecklistPhotoUploadingId(null);
    }
  }

  async function pickChecklistPhotoFromCamera(itemId: string) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso", "Se necesita acceso a la camara para tomar la foto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    await finalizeChecklistPhotoFromPicker(itemId, result);
  }

  async function pickChecklistPhotoFromLibrary(itemId: string) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso", "Se necesita acceso a la galeria para elegir una foto.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    await finalizeChecklistPhotoFromPicker(itemId, result);
  }

  function openChecklistPhotoSourcePicker(itemId: string) {
    Alert.alert("Evidencia", "Elige el origen de la foto", [
      { text: "Cancelar", style: "cancel" },
      { text: "Camara", onPress: () => void pickChecklistPhotoFromCamera(itemId) },
      { text: "Galeria", onPress: () => void pickChecklistPhotoFromLibrary(itemId) },
    ]);
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
      assigneeFilterDefaultAppliedRef.current = false;
      setMe(null);
      setFilterAssigneeId(null);
      setFilterKind("all");
      setTaskListTab("pending");
      setTaskFilterModalVisible(false);
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

  function priorityLabel(priority: WoPriority) {
    if (priority === "low") return "Baja";
    if (priority === "medium") return "Media";
    if (priority === "high") return "Alta";
    return "Urgente";
  }

  useEffect(() => {
    let cancelled = false;
    async function bootstrapAuth() {
      try {
        await apiFetch<CurrentUser>("/api/users/me");
        if (cancelled) return;
        setIsLoggedIn(true);
        await loadInitialData();
      } catch {
        if (cancelled) return;
        setIsLoggedIn(false);
      } finally {
        if (!cancelled) setAuthBootstrapping(false);
      }
    }
    void bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !me?.id || assigneeFilterDefaultAppliedRef.current) return;
    assigneeFilterDefaultAppliedRef.current = true;
    setFilterAssigneeId(me.id);
  }, [isLoggedIn, me?.id]);

  useEffect(() => {
    setCompletedVisibleCount(COMPLETED_INITIAL_VISIBLE);
  }, [isLoggedIn, taskListTab, filterAssigneeId, filterKind]);

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
      if (inlineImage) {
        setInlineImage(null);
        return true;
      }
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
  }, [inlineImage, inlinePdf, selectedWorkOrderId, closeTaskDetail]);

  useEffect(() => {
    if (!isLoggedIn || selectedWorkOrderId) return;
    if (!workOrders.some((w) => w.status === "in_progress")) return;
    const id = setInterval(() => setTaskListTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isLoggedIn, selectedWorkOrderId, workOrders]);

  useEffect(() => {
    setChecklistNumberDraft({});
  }, [selectedWorkOrderId]);

  useEffect(() => {
    setChecklistDropdownModal(null);
    setChecklistPhotoUploadingId(null);
    setChecklistDatePicker(null);
    setDetailDetailsExpanded(false);
  }, [selectedWorkOrderId]);

  const detailCanEditChecklist = selectedWorkOrder?.status === "in_progress";

  const detailSlideDockVisible =
    selectedWorkOrder != null &&
    !detailLoading &&
    !detailError &&
    (selectedWorkOrder.status === "pending" || selectedWorkOrder.status === "in_progress");

  const detailSlideCompleteNeedsHint =
    selectedWorkOrder != null &&
    !detailLoading &&
    !detailError &&
    selectedWorkOrder.status === "in_progress" &&
    selectedWorkOrder.checklist.length > 0 &&
    !isChecklistFullyComplete(selectedWorkOrder.checklist);

  const detailSlideCompleteDisabled = detailSlideCompleteNeedsHint;

  if (authBootstrapping) {
    return (
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.authLoadingRoot}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.authLoadingText}>Verificando sesion...</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

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
          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.headerAlertButton,
                activeSection === "notifications" ? styles.headerAlertButtonActive : null,
              ]}
              onPress={() => {
                closeTaskDetail();
                setActiveSection("notifications");
              }}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={activeSection === "notifications" ? theme.accent : theme.zinc600}
              />
              {unreadCount > 0 ? (
                <View style={styles.headerAlertBadge}>
                  <Text style={styles.headerAlertBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={[
                styles.headerAlertButton,
                activeSection === "profile" ? styles.headerAlertButtonActive : null,
              ]}
              onPress={() => {
                closeTaskDetail();
                setActiveSection("profile");
              }}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={activeSection === "profile" ? theme.accent : theme.zinc600}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.contentArea}>
          {activeSection === "workOrders" ? (
            selectedWorkOrderId ? (
              <View style={styles.detailKeyboardAvoid}>
                <ScrollView
                  style={styles.detailScroll}
                  contentContainerStyle={[
                    styles.detailContent,
                    detailSlideDockVisible
                      ? {
                          paddingBottom:
                            48 +
                            TASK_SLIDE_DOCK_PADDING_TOP +
                            SLIDE_TRACK_HEIGHT +
                            TASK_SLIDE_DOCK_BELOW_RAIL +
                            Math.max(insets.bottom, TASK_SLIDE_DOCK_SAFE_MIN) +
                            (detailSlideCompleteNeedsHint
                              ? TASK_SLIDE_DOCK_HINT_SCROLL_EXTRA
                              : 0),
                        }
                      : null,
                  ]}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  refreshControl={
                    <RefreshControl
                      refreshing={detailRefreshing}
                      onRefresh={() => {
                        void refreshSelectedWorkOrderDetail();
                      }}
                    />
                  }
                >
                <View style={styles.detailBreadcrumb}>
                  <Pressable
                    style={styles.detailBreadcrumbBackTap}
                    onPress={closeTaskDetail}
                    accessibilityRole="button"
                    accessibilityLabel="Volver a tareas"
                  >
                    <Ionicons name="arrow-back" size={18} color={theme.accent} />
                    <Text style={styles.detailBreadcrumbLink}>Tareas</Text>
                  </Pressable>
                  <Text style={styles.detailBreadcrumbSep}> / </Text>
                  <Text style={styles.detailBreadcrumbCurrent} numberOfLines={1}>
                    {detailError && selectedWorkOrder == null
                      ? "—"
                      : detailLoading ||
                          selectedWorkOrder == null ||
                          selectedWorkOrder.id !== selectedWorkOrderId
                        ? "…"
                        : selectedWorkOrder.folio != null
                          ? `Folio ${selectedWorkOrder.folio}`
                          : `Ref. ${selectedWorkOrder.id.slice(0, 8)}…`}
                  </Text>
                </View>
                {detailLoading ? (
                  <Text style={styles.cardMeta}>Cargando detalle...</Text>
                ) : detailError ? (
                  <Text style={styles.errorText}>{detailError}</Text>
                ) : selectedWorkOrder ? (
                  <>
                    <Text style={styles.detailPageTitle}>{selectedWorkOrder.title}</Text>

                    <View style={styles.detailCard}>
                      <Pressable
                        onPress={() => setDetailDetailsExpanded((v) => !v)}
                        style={({ pressed }) => [
                          styles.detailCardHeader,
                          !detailDetailsExpanded && styles.detailCardHeaderCollapsed,
                          pressed && styles.detailCardHeaderPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          detailDetailsExpanded ? "Ocultar detalles de la tarea" : "Mostrar detalles de la tarea"
                        }
                        accessibilityState={{ expanded: detailDetailsExpanded }}
                      >
                        <View style={styles.detailCardHeaderRow}>
                          <Ionicons
                            name={detailDetailsExpanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={theme.zinc600}
                            style={styles.detailCardHeaderChevron}
                          />
                          <Text style={[styles.detailCardHeaderTitle, styles.detailCardHeaderTitleFlex]}>
                            Detalles
                          </Text>
                          <WorkOrderStatusBadge status={selectedWorkOrder.status} />
                        </View>
                      </Pressable>
                      {detailDetailsExpanded ? (
                      <View style={styles.detailCardBody}>
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
                      ) : null}
                    </View>

                    <View style={styles.detailCard}>
                      <View style={styles.detailCardHeader}>
                        <Text style={styles.detailCardHeaderTitle}>Descripción</Text>
                      </View>
                      <View style={styles.detailCardBody}>
                        {selectedWorkOrder.description ? (
                          <Text style={styles.detailDescriptionText}>{selectedWorkOrder.description}</Text>
                        ) : (
                          <Text style={styles.detailRowMuted}>Sin descripción.</Text>
                        )}
                      </View>
                    </View>

                    {(selectedWorkOrder.attachments?.length ?? 0) > 0 ? (
                      <View style={styles.detailCard}>
                        <View style={styles.detailCardHeader}>
                          <Text style={styles.detailCardHeaderTitle}>Adjuntos</Text>
                          <Text style={styles.detailCardHeaderSub}>
                            Fotos y evidencias de la tarea
                          </Text>
                        </View>
                        <View style={styles.detailCardBody}>
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
                      <View style={styles.detailCard}>
                        <View style={styles.detailCardHeader}>
                          <Text style={styles.detailCardHeaderTitle}>Checklist</Text>
                        </View>
                        <View style={styles.detailCardBody}>
                          {selectedWorkOrder.status === "pending" ? (
                            <Text style={styles.checklistHint}>
                              Cambia el estado a <Text style={styles.checklistHintStrong}>En progreso</Text> para
                              editar el checklist.
                            </Text>
                          ) : null}
                          {selectedWorkOrder.checklist.map((item) =>
                            item.type === "step" ? (
                              <Pressable
                                key={item.id}
                                style={[
                                  styles.checklistCard,
                                  !detailCanEditChecklist && styles.checklistCardDisabled,
                                ]}
                                onPress={() =>
                                  detailCanEditChecklist &&
                                  void updateChecklist(item.id, {
                                    completed: !(item.completed ?? false),
                                  })
                                }
                                disabled={!detailCanEditChecklist}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: item.completed === true, disabled: !detailCanEditChecklist }}
                                accessibilityLabel={item.label}
                              >
                                <View style={styles.checklistStepRow}>
                                  <View
                                    style={[
                                      styles.checklistStepBox,
                                      item.completed ? styles.checklistStepBoxOn : styles.checklistStepBoxOff,
                                    ]}
                                  >
                                    {item.completed ? (
                                      <Ionicons name="checkmark" size={16} color={theme.white} />
                                    ) : null}
                                  </View>
                                  <Text
                                    style={[
                                      styles.checklistStepLabel,
                                      item.completed ? styles.checklistStepLabelDone : null,
                                    ]}
                                  >
                                    {item.label}
                                  </Text>
                                </View>
                              </Pressable>
                            ) : (
                              <View key={item.id} style={styles.checklistCard}>
                                <Text style={styles.checklistFieldLabel}>{item.label}</Text>
                                {!detailCanEditChecklist ? (
                                  item.fieldType === "photo" &&
                                  typeof item.value === "string" &&
                                  item.value.startsWith("/") ? (
                                    <Pressable
                                      onPress={() =>
                                        openWorkOrderImageLightbox(item.value as string, item.label)
                                      }
                                      accessibilityRole="button"
                                      accessibilityLabel={`Ampliar foto: ${item.label}`}
                                    >
                                      <Image
                                        source={{ uri: absoluteFileUrl(item.value) }}
                                        style={styles.checklistPhotoPreview}
                                        resizeMode="cover"
                                      />
                                    </Pressable>
                                  ) : (
                                    <Text style={styles.checklistFieldReadOnly}>
                                      {item.fieldType === "checkbox"
                                        ? item.value === true
                                          ? "Sí"
                                          : "No"
                                        : item.value != null && String(item.value).trim() !== ""
                                          ? String(item.value)
                                          : "—"}
                                    </Text>
                                  )
                                ) : item.fieldType === "checkbox" ? (
                                  <View style={styles.checklistCheckboxRow}>
                                    <Switch
                                      value={item.value === true}
                                      onValueChange={(v) => void updateChecklist(item.id, { value: v })}
                                      trackColor={{ false: theme.zinc200, true: theme.primary100 }}
                                      thumbColor={item.value === true ? theme.primary : theme.zinc400}
                                    />
                                    <Text style={styles.checklistCheckboxHint}>Marcar si aplica</Text>
                                  </View>
                                ) : item.fieldType === "number" ? (
                                  <TextInput
                                    value={
                                      checklistNumberDraft[item.id] !== undefined
                                        ? checklistNumberDraft[item.id]!
                                        : item.value != null && item.value !== ""
                                          ? String(item.value)
                                          : ""
                                    }
                                    onFocus={() =>
                                      setChecklistNumberDraft((d) => ({
                                        ...d,
                                        [item.id]:
                                          item.value != null && item.value !== ""
                                            ? String(item.value)
                                            : "",
                                      }))
                                    }
                                    onChangeText={(text) => {
                                      setChecklistNumberDraft((d) => ({ ...d, [item.id]: text }));
                                    }}
                                    onBlur={() => {
                                      const text = checklistNumberDraft[item.id] ?? "";
                                      setChecklistNumberDraft((d) => {
                                        const next = { ...d };
                                        delete next[item.id];
                                        return next;
                                      });
                                      const trimmed = text.trim();
                                      if (trimmed === "") {
                                        void updateChecklist(item.id, { value: null });
                                        return;
                                      }
                                      const n = Number(trimmed.replace(",", "."));
                                      void updateChecklist(item.id, {
                                        value: Number.isFinite(n) ? n : null,
                                      });
                                    }}
                                    placeholder="Número"
                                    placeholderTextColor={theme.zinc400}
                                    keyboardType="decimal-pad"
                                    style={styles.input}
                                  />
                                ) : item.fieldType === "date" ? (
                                  <Pressable
                                    style={styles.checklistDropdownTrigger}
                                    onPress={() =>
                                      setChecklistDatePicker({
                                        itemId: item.id,
                                        draft: parseChecklistDateValue(item.value),
                                      })
                                    }
                                  >
                                    <Ionicons name="calendar-outline" size={22} color={theme.zinc600} />
                                    <Text
                                      style={[
                                        styles.checklistDropdownTriggerText,
                                        (!item.value || String(item.value).trim() === "") && {
                                          color: theme.zinc400,
                                        },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {formatChecklistDateDisplay(item.value) || "Seleccionar fecha"}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color={theme.zinc600} />
                                  </Pressable>
                                ) : item.fieldType === "dropdown" ? (
                                  checklistDropdownOptions(item).length === 0 ? (
                                    <Text style={styles.detailRowMuted}>Sin opciones configuradas.</Text>
                                  ) : (
                                    <Pressable
                                      style={styles.checklistDropdownTrigger}
                                      onPress={() =>
                                        setChecklistDropdownModal({
                                          itemId: item.id,
                                          label: item.label,
                                          options: checklistDropdownOptions(item),
                                        })
                                      }
                                    >
                                      <Text
                                        style={styles.checklistDropdownTriggerText}
                                        numberOfLines={1}
                                      >
                                        {item.value != null && String(item.value).trim() !== ""
                                          ? String(item.value)
                                          : "Seleccionar…"}
                                      </Text>
                                      <Ionicons name="chevron-down" size={22} color={theme.zinc600} />
                                    </Pressable>
                                  )
                                ) : item.fieldType === "photo" ? (
                                  <View style={styles.checklistPhotoEditor}>
                                    {checklistPhotoUploadingId === item.id ? (
                                      <View style={styles.checklistPhotoUploading}>
                                        <ActivityIndicator color={theme.primary} />
                                        <Text style={styles.helpText}>Subiendo…</Text>
                                      </View>
                                    ) : (
                                      <>
                                        {typeof item.value === "string" &&
                                        item.value.startsWith("/") ? (
                                          <Pressable
                                            onPress={() =>
                                              openWorkOrderImageLightbox(item.value as string, item.label)
                                            }
                                            accessibilityRole="button"
                                            accessibilityLabel={`Ampliar foto: ${item.label}`}
                                          >
                                            <Image
                                              source={{ uri: absoluteFileUrl(item.value) }}
                                              style={styles.checklistPhotoPreview}
                                              resizeMode="cover"
                                            />
                                          </Pressable>
                                        ) : null}
                                        <Pressable
                                          style={styles.checklistPhotoActionBtn}
                                          onPress={() => openChecklistPhotoSourcePicker(item.id)}
                                        >
                                          <Ionicons name="camera-outline" size={20} color={theme.primary} />
                                          <Text style={styles.checklistPhotoActionText}>
                                            {typeof item.value === "string" && item.value.startsWith("/")
                                              ? "Cambiar foto (camara o galeria)"
                                              : "Tomar o elegir foto"}
                                          </Text>
                                        </Pressable>
                                      </>
                                    )}
                                  </View>
                                ) : (
                                  <TextInput
                                    value={item.value != null ? String(item.value) : ""}
                                    onChangeText={(text) =>
                                      void updateChecklist(item.id, { value: text })
                                    }
                                    placeholder="Escribir valor"
                                    placeholderTextColor={theme.zinc400}
                                    style={styles.input}
                                  />
                                )}
                              </View>
                            )
                          )}
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : null}
                </ScrollView>

                {detailSlideDockVisible && selectedWorkOrder ? (
                  <View
                    style={[
                      styles.taskSlideDock,
                      {
                        paddingBottom:
                          TASK_SLIDE_DOCK_BELOW_RAIL +
                          Math.max(insets.bottom, TASK_SLIDE_DOCK_SAFE_MIN),
                      },
                    ]}
                  >
                    {selectedWorkOrder.status === "in_progress" && detailSlideCompleteNeedsHint ? (
                      <Text style={styles.taskSlideDockHint} numberOfLines={2}>
                        Completa el checklist para cerrar la tarea.
                      </Text>
                    ) : null}
                    {selectedWorkOrder.status === "pending" ? (
                      <SlideToConfirm
                        resetKey={`${selectedWorkOrder.id}-pending`}
                        label="Desliza para iniciar"
                        variant="primary"
                        onConfirm={() => void updateStatus("in_progress")}
                      />
                    ) : (
                      <SlideToConfirm
                        resetKey={`${selectedWorkOrder.id}-done-${isChecklistFullyComplete(selectedWorkOrder.checklist) ? "1" : "0"}`}
                        label="Desliza para completar"
                        variant="success"
                        disabled={detailSlideCompleteDisabled}
                        onConfirm={() => void updateStatus("completed")}
                      />
                    )}
                  </View>
                ) : null}

                <Modal
                  visible={checklistDropdownModal != null}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setChecklistDropdownModal(null)}
                >
                  <View style={styles.checklistDropdownModalRoot}>
                    <Pressable
                      style={styles.checklistDropdownBackdrop}
                      onPress={() => setChecklistDropdownModal(null)}
                    />
                    <View
                      style={[
                        styles.checklistDropdownSheet,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                      ]}
                    >
                      <Text style={styles.checklistDropdownSheetTitle} numberOfLines={2}>
                        {checklistDropdownModal?.label ?? ""}
                      </Text>
                      <ScrollView
                        style={styles.checklistDropdownScroll}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                      >
                        {checklistDropdownModal ? (
                          <>
                            <Pressable
                              style={styles.checklistDropdownOption}
                              onPress={() => {
                                void updateChecklist(checklistDropdownModal.itemId, { value: null });
                                setChecklistDropdownModal(null);
                              }}
                            >
                              <Text style={styles.checklistDropdownOptionTextMuted}>
                                (Sin seleccion)
                              </Text>
                            </Pressable>
                            {checklistDropdownModal.options.map((opt) => {
                              const m = selectedWorkOrder?.checklist.find(
                                (i) => i.id === checklistDropdownModal.itemId
                              );
                              const selected = String(m?.value ?? "") === opt;
                              return (
                                <Pressable
                                  key={opt}
                                  style={[
                                    styles.checklistDropdownOption,
                                    selected && styles.checklistDropdownOptionSelected,
                                  ]}
                                  onPress={() => {
                                    void updateChecklist(checklistDropdownModal.itemId, {
                                      value: opt,
                                    });
                                    setChecklistDropdownModal(null);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.checklistDropdownOptionText,
                                      selected && styles.checklistDropdownOptionTextSelected,
                                    ]}
                                    numberOfLines={3}
                                  >
                                    {opt}
                                  </Text>
                                  {selected ? (
                                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                                  ) : null}
                                </Pressable>
                              );
                            })}
                          </>
                        ) : null}
                      </ScrollView>
                      <Pressable
                        style={styles.checklistDropdownCloseBtn}
                        onPress={() => setChecklistDropdownModal(null)}
                      >
                        <Text style={styles.checklistDropdownCloseBtnText}>Cerrar</Text>
                      </Pressable>
                    </View>
                  </View>
                </Modal>

                {checklistDatePicker != null && Platform.OS === "android" ? (
                  <DateTimePicker
                    value={checklistDatePicker.draft}
                    mode="date"
                    display="calendar"
                    onChange={(event, date) => {
                      const snap = checklistDatePicker;
                      setChecklistDatePicker(null);
                      if (event.type === "dismissed" || !snap) return;
                      if (event.type === "set" && date) {
                        void updateChecklist(snap.itemId, {
                          value: formatDateToChecklistIso(date),
                        });
                      }
                    }}
                  />
                ) : null}

                <Modal
                  visible={checklistDatePicker != null && Platform.OS === "ios"}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setChecklistDatePicker(null)}
                >
                  <View style={styles.checklistDropdownModalRoot}>
                    <Pressable
                      style={styles.checklistDropdownBackdrop}
                      onPress={() => setChecklistDatePicker(null)}
                    />
                    <View
                      style={[
                        styles.checklistDropdownSheet,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                      ]}
                    >
                      <View style={styles.checklistDateModalToolbar}>
                        <Pressable onPress={() => setChecklistDatePicker(null)}>
                          <Text style={styles.checklistDateModalToolbarBtn}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            const snap = checklistDatePicker;
                            setChecklistDatePicker(null);
                            if (snap) void updateChecklist(snap.itemId, { value: null });
                          }}
                        >
                          <Text style={styles.checklistDateModalToolbarBtnMuted}>Quitar</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            const snap = checklistDatePicker;
                            setChecklistDatePicker(null);
                            if (snap) {
                              void updateChecklist(snap.itemId, {
                                value: formatDateToChecklistIso(snap.draft),
                              });
                            }
                          }}
                        >
                          <Text style={styles.checklistDateModalToolbarBtnPrimary}>Guardar</Text>
                        </Pressable>
                      </View>
                      {checklistDatePicker ? (
                        <DateTimePicker
                          value={checklistDatePicker.draft}
                          mode="date"
                          display="inline"
                          locale="es-ES"
                          themeVariant="light"
                          onChange={(_, d) => {
                            if (d) {
                              setChecklistDatePicker((prev) =>
                                prev ? { ...prev, draft: d } : null
                              );
                            }
                          }}
                        />
                      ) : null}
                    </View>
                  </View>
                </Modal>
              </View>
            ) : (
              <View style={styles.canvasShell}>
                <View style={styles.taskListToolbar}>
                  <View style={styles.taskTabRow}>
                    <Pressable
                      style={[styles.taskTab, taskListTab === "pending" && styles.taskTabActive]}
                      onPress={() => setTaskListTab("pending")}
                    >
                      <Text
                        style={[styles.taskTabText, taskListTab === "pending" && styles.taskTabTextActive]}
                        numberOfLines={1}
                      >
                        Pendientes
                      </Text>
                      <Text
                        style={[styles.taskTabCount, taskListTab === "pending" && styles.taskTabCountActive]}
                      >
                        {pendingQueueTasks.length}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.taskTab,
                        taskListTab === "in_progress" && styles.taskTabActiveInProgress,
                      ]}
                      onPress={() => setTaskListTab("in_progress")}
                    >
                      <Text
                        style={[styles.taskTabText, taskListTab === "in_progress" && styles.taskTabTextActive]}
                        numberOfLines={1}
                      >
                        En progreso
                      </Text>
                      <Text
                        style={[
                          styles.taskTabCount,
                          taskListTab === "in_progress" && styles.taskTabCountActive,
                        ]}
                      >
                        {ongoingTasks.length}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.taskTab, taskListTab === "completed" && styles.taskTabActive]}
                      onPress={() => setTaskListTab("completed")}
                    >
                      <Text
                        style={[styles.taskTabText, taskListTab === "completed" && styles.taskTabTextActive]}
                        numberOfLines={1}
                      >
                        Completadas
                      </Text>
                      <Text
                        style={[styles.taskTabCount, taskListTab === "completed" && styles.taskTabCountActive]}
                      >
                        {completedTasks.length}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    style={styles.taskFilterIconBtn}
                    onPress={() => setTaskFilterModalVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Filtros"
                  >
                    <Ionicons name="options-outline" size={22} color={theme.zinc700} />
                    {taskFiltersActive ? <View style={styles.taskFilterBadgeDot} /> : null}
                  </Pressable>
                </View>
                {ongoingTasksCountMine > 0 && taskListTab !== "in_progress" ? (
                  <Pressable
                    style={styles.ongoingTasksNotice}
                    onPress={() => setTaskListTab("in_progress")}
                    accessibilityRole="button"
                    accessibilityLabel={
                      ongoingTasksCountMine === 1
                        ? "Tienes 1 tarea en progreso. Ver lista."
                        : `Tienes ${ongoingTasksCountMine} tareas en progreso. Ver lista.`
                    }
                  >
                    <Ionicons name="flash-outline" size={18} color={theme.primary} />
                    <Text style={styles.ongoingTasksNoticeText}>
                      {ongoingTasksCountMine === 1
                        ? "Tienes 1 tarea en progreso."
                        : `Tienes ${ongoingTasksCountMine} tareas en progreso.`}{" "}
                      <Text style={styles.ongoingTasksNoticeLink}>Ver en progreso</Text>
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.primary} />
                  </Pressable>
                ) : null}
                {ordersLoading ? <Text style={styles.cardMeta}>Cargando tareas...</Text> : null}
                {ordersError ? <Text style={styles.errorText}>{ordersError}</Text> : null}
                <ScrollView
                  style={styles.dashboardScroll}
                  contentContainerStyle={styles.dashboardScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  refreshControl={
                    <RefreshControl
                      refreshing={workOrdersRefreshing}
                      onRefresh={() => {
                        void refreshWorkOrdersFeed();
                      }}
                    />
                  }
                >
                  {taskListTab === "in_progress" ? (
                    <>
                      <View style={styles.dashboardSectionHeader}>
                        <Text style={styles.dashboardSectionKicker}>TAREAS EN PROGRESO</Text>
                        <View style={styles.dashboardActiveBadge}>
                          <Text style={styles.dashboardActiveBadgeText}>
                            {ongoingTasks.length} ACTIVA{ongoingTasks.length === 1 ? "" : "S"}
                          </Text>
                        </View>
                      </View>
                      {ongoingTasks.length === 0 ? (
                        <Text style={styles.dashboardEmpty}>No hay tareas en progreso.</Text>
                      ) : (
                        ongoingTasks.map((w) => {
                          const assetKicker =
                            w.assetAssetId != null && String(w.assetAssetId).trim() !== ""
                              ? String(w.assetAssetId).toUpperCase()
                              : w.assetName
                                ? w.assetName.toUpperCase()
                                : "SIN ACTIVO";
                          return (
                            <View key={w.id} style={[styles.surfaceCard, styles.ongoingHero]}>
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
                                    userId={w.assigneeId}
                                    avatarUrl={w.assigneeAvatarUrl}
                                    avatarBackgroundColor={w.assigneeAvatarBackgroundColor}
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
                                  onPress={() => updateWorkOrderStatusById(w.id, "pending")}
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
                    </>
                  ) : null}

                  {taskListTab === "pending" ? (
                    <>
                  <View style={styles.dashboardSectionHeader}>
                    <Text style={styles.dashboardSectionKicker}>COLA PENDIENTE</Text>
                    <Text style={styles.dashboardSectionCount}>{pendingTasksSorted.length}</Text>
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
                          style={[styles.surfaceCard, styles.pendingCard, { borderLeftColor: accent }]}
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
                              userId={item.assigneeId}
                              avatarUrl={item.assigneeAvatarUrl}
                              avatarBackgroundColor={item.assigneeAvatarBackgroundColor}
                            />
                            <WorkOrderPriorityIconRN priority={item.priority} />
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                    </>
                  ) : null}

                  {taskListTab === "completed" ? (
                    <>
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
                          style={[styles.surfaceCard, styles.completedRowCard]}
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
                                userId={item.assigneeId}
                                avatarUrl={item.assigneeAvatarUrl}
                                avatarBackgroundColor={item.assigneeAvatarBackgroundColor}
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
                    </>
                  ) : null}
                </ScrollView>
                <Modal
                  visible={taskFilterModalVisible}
                  transparent
                  animationType="none"
                  onRequestClose={closeTaskFilterModal}
                >
                  <View style={styles.taskFilterModalRoot}>
                    <Animated.View
                      pointerEvents="box-none"
                      style={[
                        styles.taskFilterModalBackdropWrap,
                        { opacity: taskFilterBackdropOpacity },
                      ]}
                    >
                      <Pressable
                        style={StyleSheet.absoluteFillObject}
                        onPress={closeTaskFilterModal}
                        accessibilityLabel="Cerrar filtros"
                      />
                    </Animated.View>
                    <Animated.View
                      style={[
                        styles.taskFilterModalSheet,
                        { paddingBottom: Math.max(insets.bottom, 20) },
                        { transform: [{ translateY: taskFilterSheetTranslateY }] },
                      ]}
                    >
                      <Text style={styles.taskFilterModalTitle}>Filtros</Text>
                      <Text style={styles.taskFilterModalSection}>Asignado</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.taskFilterModalChipsRow}
                      >
                        <Pressable
                          style={[
                            styles.userFilterChip,
                            filterAssigneeId === null && styles.userFilterChipActive,
                          ]}
                          onPress={() => setFilterAssigneeId(null)}
                        >
                          <Text
                            style={[
                              styles.userFilterChipText,
                              filterAssigneeId === null && styles.userFilterChipTextActive,
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
                              filterAssigneeId === user.id && styles.userFilterChipActive,
                            ]}
                            onPress={() => setFilterAssigneeId(user.id)}
                          >
                            <Text
                              style={[
                                styles.userFilterChipText,
                                filterAssigneeId === user.id && styles.userFilterChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {user.name}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <Text style={[styles.taskFilterModalSection, styles.taskFilterModalSectionSpaced]}>
                        Tipo
                      </Text>
                      <View style={styles.taskFilterKindRow}>
                        <Pressable
                          style={[styles.userFilterChip, filterKind === "all" && styles.userFilterChipActive]}
                          onPress={() => setFilterKind("all")}
                        >
                          <Text
                            style={[
                              styles.userFilterChipText,
                              filterKind === "all" && styles.userFilterChipTextActive,
                            ]}
                          >
                            Todos
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.userFilterChip,
                            filterKind === "routine" && styles.userFilterChipActive,
                          ]}
                          onPress={() => setFilterKind("routine")}
                        >
                          <Text
                            style={[
                              styles.userFilterChipText,
                              filterKind === "routine" && styles.userFilterChipTextActive,
                            ]}
                          >
                            {workOrderKindLabel("routine")}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.userFilterChip,
                            filterKind === "on_demand" && styles.userFilterChipActive,
                          ]}
                          onPress={() => setFilterKind("on_demand")}
                        >
                          <Text
                            style={[
                              styles.userFilterChipText,
                              filterKind === "on_demand" && styles.userFilterChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {workOrderKindLabel("on_demand")}
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.taskFilterModalFooter}>
                        {taskFiltersActive ? (
                          <Pressable
                            style={styles.taskFilterModalClearBtn}
                            onPress={() => {
                              setFilterAssigneeId(null);
                              setFilterKind("all");
                            }}
                          >
                            <Text style={styles.taskFilterModalClearBtnText}>Limpiar</Text>
                          </Pressable>
                        ) : (
                          <View style={styles.taskFilterModalFooterSpacer} />
                        )}
                        <Pressable
                          style={styles.taskFilterModalDoneBtn}
                          onPress={closeTaskFilterModal}
                        >
                          <Text style={styles.taskFilterModalDoneBtnText}>Listo</Text>
                        </Pressable>
                      </View>
                    </Animated.View>
                  </View>
                </Modal>
              </View>
            )
          ) : activeSection === "knowledgeBase" ? (
            <View style={styles.kbContainer}>
              <TextInput
                value={kbQuery}
                onChangeText={setKbQuery}
                placeholder="Buscar en biblioteca..."
                placeholderTextColor={theme.zinc400}
                style={styles.input}
              />
              {kbLoading ? <Text style={styles.cardMeta}>Cargando biblioteca...</Text> : null}
              {kbError ? <Text style={styles.errorText}>{kbError}</Text> : null}
              <FlatList
                data={filteredKnowledge}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                ListEmptyComponent={<Text style={styles.emptyText}>No hay documentos.</Text>}
                renderItem={({ item }) => {
                  const kind = knowledgeFileKind(item.filename, item.fileUrl);
                  const opening = kbOpeningId === item.id;
                  return (
                    <Pressable
                      style={[styles.surfaceCard, styles.kbFileCard]}
                      onPress={() => void openKnowledgeItem(item)}
                      disabled={opening}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${item.filename ?? "documento"}`}
                    >
                      <View style={styles.kbFileCardRow}>
                        <View style={styles.kbFileIconWrap}>
                          <Ionicons name={kbFileIonIcon(kind)} size={26} color={theme.primary} />
                        </View>
                        <View style={styles.kbFileTextCol}>
                          <Text style={styles.cardTitle} numberOfLines={2}>
                            {item.filename ?? "Documento"}
                          </Text>
                          <Text style={styles.cardMeta}>
                            {item.asset ? `${item.asset.name} (${item.asset.assetId})` : "General"}
                          </Text>
                          <Text style={styles.helpText}>{item.category ?? "Archivo"}</Text>
                        </View>
                        {opening ? (
                          <ActivityIndicator size="small" color={theme.primary} />
                        ) : (
                          <Ionicons name="chevron-forward" size={20} color={theme.zinc400} />
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            </View>
          ) : activeSection === "notifications" ? (
            <View style={styles.kbContainer}>
              <View style={[styles.headerRow, { paddingTop: 4 }]}>
                <Text style={styles.sectionTitle}>Notificaciones</Text>
                {unreadCount > 0 ? (
                  <Pressable style={styles.ghostButton} onPress={markAllNotificationsRead}>
                    <Text style={styles.ghostButtonText}>Marcar todo leido</Text>
                  </Pressable>
                ) : null}
              </View>
              {notificationsLoading ? (
                <Text style={styles.cardMeta}>Cargando notificaciones...</Text>
              ) : null}
              {notificationsError ? <Text style={styles.errorText}>{notificationsError}</Text> : null}
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                refreshing={notificationsRefreshing}
                onRefresh={() => {
                  void refreshNotificationsFeed();
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>Sin notificaciones.</Text>}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.surfaceCard,
                      !item.readAt && styles.notificationUnreadCard,
                    ]}
                    onPress={() => {
                      void openNotification(item);
                    }}
                  >
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.body ? <Text style={styles.cardMeta}>{item.body}</Text> : null}
                    <Text style={styles.helpText}>
                      {new Date(item.createdAt).toLocaleString("es-MX", {
                        timeZone: APP_TIME_ZONE,
                      })}
                    </Text>
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
              <Text style={[styles.sectionTitle, { paddingTop: 8, paddingBottom: 8 }]}>
                Perfil del Operador
              </Text>
              {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
              <View style={[styles.surfaceCard, styles.sectionBlock, styles.sectionFirst]}>
                <Text style={styles.cardMeta}>Nombre: {me?.name ?? "—"}</Text>
                <Text style={styles.cardMeta}>Usuario: {me?.username ?? username}</Text>
                <Text style={styles.cardMeta}>Email: {me?.email ?? "Sin email"}</Text>
                <Text style={styles.cardMeta}>Rol: {me?.role ?? "operator"}</Text>
              </View>

              <View style={[styles.surfaceCard, styles.sectionBlock]}>
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

              <View style={[styles.surfaceCard, styles.sectionBlock]}>
                <Text style={styles.sectionTitle}>Sesion</Text>
                <Pressable style={styles.logoutButton} disabled={profileBusy} onPress={logout}>
                  <Text style={styles.logoutButtonText}>Cerrar sesion</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>

        {!selectedWorkOrderId ? (
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
              Biblioteca
            </Text>
          </Pressable>
        </View>
        ) : null}
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
              {...(Platform.OS === "android"
                ? {
                    mixedContentMode: "always" as const,
                    allowFileAccess: true,
                    allowFileAccessFromFileURLs: true,
                    allowUniversalAccessFromFileURLs: true,
                  }
                : {})}
              {...(Platform.OS === "ios"
                ? { allowingReadAccessToURL: ensureFileScheme(FileSystem.documentDirectory ?? "file:///") }
                : {})}
              renderLoading={() => (
                <View style={styles.pdfModalLoading}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={styles.pdfModalLoadingText}>Abriendo PDF…</Text>
                </View>
              )}
              onError={() => {
                Alert.alert(
                  "No se pudo mostrar el archivo",
                  "El formato podría no ser compatible con el visor integrado."
                );
              }}
            />
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={inlineImage != null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setInlineImage(null)}
      >
        <View style={[styles.pdfModalRoot, { paddingTop: insets.top }]}>
          <View style={styles.pdfModalToolbar}>
            <Pressable
              onPress={() => setInlineImage(null)}
              hitSlop={12}
              style={styles.pdfModalClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar imagen"
            >
              <Ionicons name="close" size={28} color={theme.zinc700} />
            </Pressable>
            <Text style={styles.pdfModalTitle} numberOfLines={1}>
              {inlineImage?.title ?? ""}
            </Text>
            <View style={styles.pdfModalClose} />
          </View>
          {inlineImage ? (
            <Pressable
              style={styles.imageModalBody}
              onPress={() => setInlineImage(null)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Image
                source={{ uri: inlineImage.uri }}
                style={styles.imageModalImage}
                resizeMode="contain"
                accessibilityLabel={inlineImage.title}
              />
            </Pressable>
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
  authLoadingRoot: {
    flex: 1,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  authLoadingText: { color: theme.zinc600, fontWeight: "600" },
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  headerAlertButtonActive: {
    borderColor: theme.accent,
    backgroundColor: "#FFF7ED",
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
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.pageBg,
  },
  profileContainer: { gap: 0, paddingBottom: 26, backgroundColor: "transparent" },
  kbContainer: { flex: 1, gap: 10, backgroundColor: "transparent" },
  detailKeyboardAvoid: { flex: 1, minHeight: 0, position: "relative" },
  detailScroll: { flex: 1, minHeight: 0 },
  detailContent: { gap: 0, paddingBottom: 48, flexGrow: 1, backgroundColor: "transparent" },
  taskSlideDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    backgroundColor: theme.pageBg,
    /** Bleed into `contentArea` horizontal padding so the rail is wider on screen. */
    marginHorizontal: -16,
    paddingTop: TASK_SLIDE_DOCK_PADDING_TOP,
    paddingHorizontal: TASK_SLIDE_DOCK_PADDING_X,
  },
  taskSlideDockHint: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.zinc600,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 0,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  slideToConfirmRoot: {
    width: "100%",
  },
  slideTrack: {
    height: SLIDE_TRACK_HEIGHT,
    borderRadius: SLIDE_TRACK_RADIUS,
    overflow: "hidden",
    position: "relative",
  },
  slideTrackPrimary: {
    backgroundColor: theme.primary50,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  slideTrackSuccess: {
    backgroundColor: "#d1fae5",
    borderWidth: 1,
    borderColor: "#6ee7b7",
  },
  slideTrackDisabled: {
    backgroundColor: "#FEF08A",
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  slideTrackLabelSlot: {
    position: "absolute",
    left: SLIDE_RAIL_INSET_X + SLIDE_THUMB_WIDTH + SLIDE_LABEL_GAP,
    right: SLIDE_RAIL_INSET_X,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  slideTrackLabel: {
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: theme.zinc600,
    letterSpacing: -0.2,
    width: "100%",
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  slideTrackLabelPrimary: {
    color: theme.primary,
  },
  slideTrackLabelDisabled: {
    color: "#713F12",
  },
  slideThumb: {
    position: "absolute",
    left: SLIDE_RAIL_INSET_X,
    top: SLIDE_THUMB_TOP,
    width: SLIDE_THUMB_WIDTH,
    height: SLIDE_THUMB_HEIGHT,
    borderRadius: SLIDE_THUMB_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 4,
  },
  slideThumbPrimary: {
    backgroundColor: theme.white,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  slideThumbSuccess: {
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  slideThumbDisabled: {
    backgroundColor: "#FDE047",
    borderWidth: 1,
    borderColor: "#CA8A04",
  },
  detailBreadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 4,
    marginBottom: 8,
    width: "100%",
  },
  detailBreadcrumbBackTap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
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
  },
  /** One rounded card per block (header + content share the same card — no inner “body” card). */
  detailCard: {
    backgroundColor: theme.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.zinc200,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  detailCardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: theme.zinc100,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailCardHeaderCollapsed: {
    borderBottomWidth: 0,
  },
  detailCardHeaderPressed: {
    backgroundColor: theme.zinc50,
  },
  detailCardHeaderChevron: {
    marginRight: 4,
  },
  detailCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  detailCardHeaderTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: theme.zinc500,
    textTransform: "uppercase",
  },
  detailCardHeaderTitleFlex: {
    flex: 1,
    minWidth: 0,
  },
  woStatusBadge: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  woStatusBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  woStatusBadgePending: {
    backgroundColor: "#FEF08A",
    borderColor: "#EAB308",
  },
  woStatusBadgePendingText: { color: "#713F12" },
  woStatusBadgeInProgress: {
    backgroundColor: "#DBEAFE",
    borderColor: theme.primary,
  },
  woStatusBadgeInProgressText: { color: "#1E3A8A" },
  woStatusBadgeCompleted: {
    backgroundColor: "#BBF7D0",
    borderColor: "#22C55E",
  },
  woStatusBadgeCompletedText: { color: "#14532D" },
  woStatusBadgeCancelled: {
    backgroundColor: theme.zinc200,
    borderColor: theme.zinc300,
  },
  woStatusBadgeCancelledText: { color: theme.zinc600 },
  detailCardHeaderSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "500",
    color: theme.zinc400,
  },
  detailCardBody: { paddingHorizontal: 16, paddingVertical: 14, gap: 0 },
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.zinc200,
    overflow: "hidden",
    backgroundColor: theme.zinc50,
  },
  attachmentThumb: { width: "100%", aspectRatio: 1, backgroundColor: theme.zinc100 },
  attachmentPdfThumb: { alignItems: "center", justifyContent: "center" },
  attachmentCaption: { fontSize: 11, color: theme.zinc500, paddingHorizontal: 6, paddingVertical: 4 },
  dashboardScroll: { flex: 1 },
  dashboardScrollContent: { paddingBottom: 24, flexGrow: 1 },
  dashboardSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 8,
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
  dashboardEmpty: { fontSize: 14, color: theme.zinc500, marginBottom: 12 },
  ongoingHero: {
    padding: 16,
    marginBottom: 12,
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
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
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
    padding: 12,
    marginBottom: 8,
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
  assigneeRingText: { fontSize: 9, fontWeight: "800", color: theme.white },
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
    backgroundColor: "#FFEDD5",
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  kindBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  kindBadgeTextRoutine: {
    color: theme.white,
  },
  kindBadgeTextOnDemand: {
    color: "#9A3412",
  },
  sectionBlock: {
    gap: 10,
    marginTop: 12,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  sectionFirst: { marginTop: 0 },
  sectionTitle: { color: theme.zinc900, fontSize: 16, fontWeight: "700" },
  helpText: { color: theme.zinc500, fontSize: 12 },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 10,
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
    backgroundColor: theme.zinc50,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.zinc200,
    gap: 8,
    marginBottom: 10,
  },
  checklistCardDisabled: { opacity: 0.92 },
  checklistStepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checklistStepBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistStepBoxOn: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  checklistStepBoxOff: {
    borderColor: theme.zinc400,
    backgroundColor: theme.white,
  },
  checklistStepLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: theme.zinc900,
  },
  checklistStepLabelDone: {
    color: theme.zinc500,
    textDecorationLine: "line-through",
  },
  checklistFieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.zinc700,
    marginBottom: 4,
  },
  checklistCheckboxRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checklistCheckboxHint: { flex: 1, fontSize: 14, color: theme.zinc600 },
  checklistDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.zinc300,
    backgroundColor: theme.white,
  },
  checklistDropdownTriggerText: {
    flex: 1,
    fontSize: 15,
    color: theme.zinc900,
  },
  checklistDateModalToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  checklistDateModalToolbarBtn: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.zinc700,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checklistDateModalToolbarBtnMuted: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.zinc500,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checklistDateModalToolbarBtnPrimary: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.primary,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checklistDropdownModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  checklistDropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  checklistDropdownSheet: {
    backgroundColor: theme.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "72%",
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  checklistDropdownSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.zinc900,
    marginBottom: 12,
  },
  checklistDropdownScroll: { maxHeight: 320 },
  checklistDropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.zinc200,
    marginBottom: 8,
    backgroundColor: theme.zinc50,
  },
  checklistDropdownOptionSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.primary50,
  },
  checklistDropdownOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: theme.zinc900,
  },
  checklistDropdownOptionTextSelected: { color: theme.primary },
  checklistDropdownOptionTextMuted: {
    fontSize: 15,
    color: theme.zinc500,
    fontStyle: "italic",
  },
  checklistDropdownCloseBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: theme.zinc100,
  },
  checklistDropdownCloseBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.zinc700,
  },
  checklistPhotoEditor: { gap: 12, marginTop: 4 },
  checklistPhotoPreview: {
    width: "100%",
    maxWidth: 280,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.zinc200,
    backgroundColor: theme.zinc100,
    alignSelf: "flex-start",
  },
  checklistPhotoUploading: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  checklistPhotoActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.primary50,
  },
  checklistPhotoActionText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.primary,
  },
  checklistFieldReadOnly: {
    fontSize: 15,
    color: theme.zinc700,
    paddingVertical: 4,
  },
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
    backgroundColor: "transparent",
    paddingTop: 4,
    paddingBottom: 0,
    gap: 6,
  },
  taskListToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  taskTabRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 6,
    minWidth: 0,
  },
  taskTab: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.zinc200,
    backgroundColor: theme.white,
  },
  taskTabActive: {
    backgroundColor: theme.primary50,
    borderColor: theme.primary200,
  },
  taskTabActiveInProgress: {
    backgroundColor: "#DBEAFE",
    borderColor: theme.primary,
    borderWidth: 1,
  },
  taskTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.zinc600,
    textAlign: "center",
  },
  taskTabTextActive: {
    color: theme.primary,
  },
  taskTabCount: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.zinc400,
    marginTop: 2,
  },
  taskTabCountActive: {
    color: theme.primary,
  },
  ongoingTasksNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    marginBottom: 2,
  },
  ongoingTasksNoticeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: theme.zinc800,
  },
  ongoingTasksNoticeLink: {
    fontWeight: "700",
    color: theme.primary,
  },
  taskFilterIconBtn: {
    position: "relative",
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.zinc200,
    backgroundColor: theme.white,
    alignItems: "center",
    justifyContent: "center",
  },
  taskFilterBadgeDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  taskFilterModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  taskFilterModalBackdropWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  taskFilterModalSheet: {
    backgroundColor: theme.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 16,
    maxHeight: "78%",
  },
  taskFilterModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.zinc900,
    marginBottom: 16,
  },
  taskFilterModalSection: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: theme.zinc500,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  taskFilterModalSectionSpaced: {
    marginTop: 18,
  },
  taskFilterModalChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    paddingBottom: 4,
  },
  taskFilterKindRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  taskFilterModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.zinc200,
  },
  taskFilterModalFooterSpacer: {
    flex: 1,
  },
  taskFilterModalClearBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.zinc300,
    backgroundColor: theme.white,
  },
  taskFilterModalClearBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.zinc700,
  },
  taskFilterModalDoneBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: theme.primary,
  },
  taskFilterModalDoneBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.white,
  },
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
  listContent: { gap: 10, paddingBottom: 24 },
  surfaceCard: {
    backgroundColor: theme.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.zinc200,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  kbFileCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  kbFileCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kbFileIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.primary50,
    borderWidth: 1,
    borderColor: theme.primary200,
    alignItems: "center",
    justifyContent: "center",
  },
  kbFileTextCol: { flex: 1, minWidth: 0, gap: 2 },
  notificationUnreadCard: {
    borderColor: theme.primary200,
    backgroundColor: theme.primary50,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: theme.zinc900, marginBottom: 4 },
  cardMeta: { color: theme.zinc600, fontSize: 13 },
  emptyText: { color: theme.zinc500, textAlign: "center", marginTop: 12 },
  loadMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.zinc300,
    backgroundColor: theme.white,
    paddingVertical: 12,
    marginTop: 8,
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
  imageModalBody: {
    flex: 1,
    backgroundColor: theme.zinc100,
    justifyContent: "center",
  },
  imageModalImage: {
    width: "100%",
    flex: 1,
    minHeight: 200,
  },
});
