import { StatusBar } from "expo-status-bar";
import {
  CHECKLIST_REVISION_REVIEW_TITLE,
  checklistRevisionNotificationHref,
  parseChecklistRevisionNotificationBody,
} from "./lib/checklist-notification-parse";
import {
  checklistItemDepth,
  flattenChecklistTreeForDisplay,
  groupFlattenedChecklistBySection,
} from "./lib/checklist-item-tree";
import { workOrderChecklistIsCompleteForClosure } from "./lib/checklist-completion";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  useCallback,
  useEffect,
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

function activeTaskRowBorderColor(status: WoStatus): string {
  if (status === "in_progress") return theme.primary;
  return "#EAB308";
}

function activeTaskListMeta(item: WorkOrderListItem): string {
  const asset =
    item.assetName != null
      ? `${item.assetName}${item.assetAssetId ? ` · ${item.assetAssetId}` : ""}`
      : "Sin activo";
  if (item.status === "in_progress") {
    return asset;
  }
  if (item.dueDate) {
    return `${formatDurationUntilDueShort(item.dueDate)} · ${asset}`;
  }
  return asset;
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
  assigneeIds?: string[];
  assignees?: Array<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    avatarBackgroundColor?: string | null;
  }>;
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
  parentItemId?: string | null;
  sortOrder?: number;
  type: string;
  label: string;
  completed: boolean | null;
  value: unknown;
  fieldType: string | null;
  options?: string[] | null | unknown;
  isOptional?: boolean;
};

/** All steps done; required fields answered (optional fields may be blank). */
function isChecklistFullyComplete(checklist: ChecklistItem[]): boolean {
  return workOrderChecklistIsCompleteForClosure(checklist);
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
  startedAt?: string | null;
  countsMachineDowntime?: boolean;
  manualDowntimeMinutes?: number;
  asset: { id: string; name: string; assetId: string; tracksMachineDowntime?: boolean } | null;
  assigneeIds?: string[];
  assignees?: Array<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    avatarBackgroundColor?: string | null;
  }>;
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

function formatMinutesShort(mins: number): string {
  const m = Math.max(0, Math.floor(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

const MAX_MANUAL_DOWNTIME_MINUTES_MOBILE = 525_600;

function workOrderAutomaticDowntimeMinutesMobile(wo: WorkOrderDetail): number {
  if (wo.status !== "completed" || !wo.countsMachineDowntime) return 0;
  if (!wo.startedAt || !wo.completedAt) return 0;
  const a = Date.parse(wo.startedAt);
  const b = Date.parse(wo.completedAt);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor(Math.max(0, b - a) / 60000);
}

/** Vista previa del intervalo automático (en curso → ahora, o en curso → terminada si ya cerró). */
function workOrderAutoDowntimePreviewMinutesMobile(wo: WorkOrderDetail): number {
  if (!wo.countsMachineDowntime) return 0;
  if (wo.status === "completed") {
    return workOrderAutomaticDowntimeMinutesMobile(wo);
  }
  if (wo.status === "in_progress" && wo.startedAt) {
    const a = Date.parse(wo.startedAt);
    if (Number.isNaN(a)) return 0;
    return Math.floor(Math.max(0, Date.now() - a) / 60000);
  }
  return 0;
}

type WorkOrderComment = {
  id: string;
  body: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    avatarBackgroundColor?: string | null;
  } | null;
};

type PendingCommentFile = {
  uri: string;
  filename: string;
  mimeType: string;
};

function mapImagePickerAssetsToPendingCommentFiles(
  assets: ImagePicker.ImagePickerAsset[]
): PendingCommentFile[] {
  return assets.map((asset, idx) => {
    const mime = asset.mimeType?.trim() || "image/jpeg";
    const fallbackExt = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
    const filename =
      asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120) ||
      `imagen-${Date.now()}-${idx}${fallbackExt}`;
    return {
      uri: asset.uri,
      filename,
      mimeType: mime,
    };
  });
}

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

type AndroidAppUpdateManifest = {
  versionName: string;
  versionCode?: number;
  required?: boolean;
  apkUrl: string;
  notes?: string;
  sha256?: string;
};

const API_HOST = (process.env.EXPO_PUBLIC_API_HOST ?? "").trim().replace(/\/$/, "");
const apiUrl = (path: string) => `${API_HOST}${path}`;
const APP_UPDATE_MANIFEST_PATH = "/downloads/android/version.json";
const APP_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function resolveRemoteUrl(urlOrPath: string): string {
  const value = urlOrPath.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (!API_HOST) return "";
  return `${API_HOST}${value.startsWith("/") ? "" : "/"}${value}`;
}

function normalizeVersionCode(raw: unknown): number | null {
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 0) return null;
  return num;
}

function parseVersionNameParts(raw: string): number[] {
  return raw
    .trim()
    .split(".")
    .map((part) => Number.parseInt(part.replace(/[^\d].*$/, ""), 10))
    .map((part) => (Number.isFinite(part) && part >= 0 ? part : 0));
}

function compareVersionNames(a: string, b: string): number {
  const aa = parseVersionNameParts(a);
  const bb = parseVersionNameParts(b);
  const length = Math.max(aa.length, bb.length);
  for (let idx = 0; idx < length; idx += 1) {
    const left = aa[idx] ?? 0;
    const right = bb[idx] ?? 0;
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
}

function isRemoteVersionNewer(
  localVersionName: string,
  localVersionCode: number | null,
  remote: AndroidAppUpdateManifest
): boolean {
  const remoteCode = normalizeVersionCode(remote.versionCode);
  if (localVersionCode != null && remoteCode != null && remoteCode !== localVersionCode) {
    return remoteCode > localVersionCode;
  }
  return compareVersionNames(remote.versionName, localVersionName) > 0;
}

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

function SectionLoadingState({ label }: { label: string }) {
  return (
    <View style={styles.sectionLoadingState}>
      <ActivityIndicator color={theme.primary} size="large" />
      <Text style={styles.sectionLoadingText}>{label}</Text>
    </View>
  );
}

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

function checklistPhotoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) {
    return absoluteFileUrl(raw);
  }
  return null;
}

function checklistPhotoUrls(value: unknown): string[] {
  const urls = new Set<string>();
  const visit = (input: unknown) => {
    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }
    if (typeof input === "string") {
      const raw = input.trim();
      if (!raw) return;
      if (
        (raw.startsWith("[") && raw.endsWith("]")) ||
        (raw.startsWith("{") && raw.endsWith("}"))
      ) {
        try {
          visit(JSON.parse(raw));
          return;
        } catch {
          // treat as plain string if not JSON
        }
      }
      const normalized = checklistPhotoUrl(raw);
      if (normalized) urls.add(normalized);
      return;
    }
    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;
      visit(obj.fileUrl);
      visit(obj.url);
      visit(obj.src);
      visit(obj.value);
      visit(obj.values);
      visit(obj.photos);
      visit(obj.attachments);
    }
  };
  visit(value);
  return Array.from(urls);
}

function mobileImageSource(uri: string): { uri: string; headers?: Record<string, string> } {
  if (isLikelyInternalApiUrl(uri) && sessionCookieHeader) {
    return { uri, headers: { Cookie: sessionCookieHeader } };
  }
  return { uri };
}

async function resolveInternalAttachmentUrl(url: string): Promise<string> {
  const endpoint = url.includes("?") ? `${url}&format=json` : `${url}?format=json`;
  const res = await fetch(endpoint, {
    method: "GET",
    credentials: "include",
    headers: sessionCookieHeader ? { Cookie: sessionCookieHeader } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.url !== "string" || data.url.trim() === "") {
    throw new Error(typeof data?.error === "string" ? data.error : "No se pudo resolver la URL firmada.");
  }
  return data.url;
}

function ensureFileScheme(uri: string): string {
  if (uri.startsWith("file://")) return uri;
  if (uri.startsWith("/")) return `file://${uri}`;
  return uri;
}

function inlinePdfWebViewUri(uri: string): string {
  if (Platform.OS === "android" && (uri.startsWith("http://") || uri.startsWith("https://"))) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(uri)}`;
  }
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

function isLikelyInternalDownloadUrl(urlOrPath: string): boolean {
  if (urlOrPath.startsWith("/api/work-orders/") || urlOrPath.startsWith("/api/asset-files/")) {
    return true;
  }
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    try {
      const parsed = new URL(urlOrPath);
      return (
        parsed.pathname.startsWith("/api/work-orders/") ||
        parsed.pathname.startsWith("/api/asset-files/")
      );
    } catch {
      return false;
    }
  }
  return false;
}

function isLikelyInternalApiUrl(urlOrPath: string): boolean {
  if (urlOrPath.startsWith("/api/")) return true;
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    try {
      const parsed = new URL(urlOrPath);
      return parsed.pathname.startsWith("/api/");
    } catch {
      return false;
    }
  }
  return false;
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
let onAuthExpired: (() => void) | null = null;
let sessionCookieHeader: string | null = null;
const SESSION_STORAGE_FILE = `${FileSystem.documentDirectory ?? ""}mobile-session.json`;

function extractSessionCookieHeader(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = setCookie.match(/(?:^|,\s*)(session=[^;,\s]+)/i);
  return match?.[1]?.trim() ?? null;
}

async function persistSessionCookieHeader(next: string | null): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  if (next == null) {
    await FileSystem.deleteAsync(SESSION_STORAGE_FILE, { idempotent: true }).catch(() => undefined);
    return;
  }
  await FileSystem.writeAsStringAsync(
    SESSION_STORAGE_FILE,
    JSON.stringify({ sessionCookieHeader: next }),
    { encoding: FileSystem.EncodingType.UTF8 }
  );
}

async function loadPersistedSessionCookieHeader(): Promise<string | null> {
  if (!FileSystem.documentDirectory) return null;
  const info = await FileSystem.getInfoAsync(SESSION_STORAGE_FILE);
  if (!info.exists) return null;
  const raw = await FileSystem.readAsStringAsync(SESSION_STORAGE_FILE, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const parsed = JSON.parse(raw) as { sessionCookieHeader?: unknown };
  const value = parsed.sessionCookieHeader;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function kbSafeLocalName(filename: string): string {
  const base = filename.trim() || "archivo";
  return base.replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}

function knowledgeMimeType(filename: string, fileUrl: string): string {
  const kind = knowledgeFileKind(filename, fileUrl);
  if (kind === "pdf") return "application/pdf";
  if (kind === "image") {
    const n = filename.trim().toLowerCase();
    if (n.endsWith(".png")) return "image/png";
    if (n.endsWith(".webp")) return "image/webp";
    if (n.endsWith(".gif")) return "image/gif";
    if (n.endsWith(".bmp")) return "image/bmp";
    return "image/jpeg";
  }
  return "application/octet-stream";
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

function workOrderInvolvesUser(
  w: Pick<WorkOrderListItem, "assigneeId" | "assigneeIds">,
  userId: string
): boolean {
  const ids = w.assigneeIds;
  if (ids && ids.length > 0) return ids.includes(userId);
  return w.assigneeId === userId;
}

/** Stacked avatars when several assignees; falls back to legacy single assignee fields. */
function TaskCardAssigneesRow({ item }: { item: WorkOrderListItem }) {
  const stack =
    item.assignees && item.assignees.length > 0
      ? item.assignees
      : item.assigneeId && item.assigneeName
        ? [
            {
              id: item.assigneeId,
              name: item.assigneeName,
              avatarUrl: item.assigneeAvatarUrl ?? null,
              avatarBackgroundColor: item.assigneeAvatarBackgroundColor ?? null,
            },
          ]
        : [];
  if (stack.length === 0) return null;
  const shown = stack.slice(0, 3);
  const extra = stack.length - shown.length;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map((a, i) => (
        <View
          key={a.id}
          style={i === 0 ? undefined : { marginLeft: -10, zIndex: shown.length - i }}
        >
          <TaskCardAssigneeAvatar
            name={a.name}
            userId={a.id}
            avatarUrl={a.avatarUrl}
            avatarBackgroundColor={a.avatarBackgroundColor}
          />
        </View>
      ))}
      {extra > 0 ? (
        <View style={{ marginLeft: -10, zIndex: 0 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: theme.zinc200,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: theme.white,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "800", color: theme.zinc700 }}>
              +{extra}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function HeaderProfileAvatar({
  name,
  userId,
  avatarUrl,
  avatarBackgroundColor,
}: {
  name: string;
  userId?: string | null;
  avatarUrl?: string | null;
  avatarBackgroundColor?: string | null;
}) {
  const displayName = name.trim() || "Técnico";
  const raw = avatarUrl != null ? String(avatarUrl).trim() : "";
  const uri = raw !== "" ? absoluteFileUrl(raw) : null;
  if (uri) {
    return <Image source={{ uri }} style={styles.headerProfileAvatarImage} resizeMode="cover" />;
  }
  const parts = displayName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
      : (parts[0]?.slice(0, 2).toUpperCase() ?? "OP");
  const bg = resolveAvatarBackgroundColor(userId, displayName, avatarBackgroundColor);
  return (
    <View style={[styles.headerProfileAvatarFallback, { backgroundColor: bg, borderColor: bg }]}>
      <Text style={styles.headerProfileAvatarFallbackText}>{initials}</Text>
    </View>
  );
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
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (sessionCookieHeader && !headers.has("Cookie")) {
    headers.set("Cookie", sessionCookieHeader);
  }
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
  const setCookie = res.headers.get("set-cookie");
  const session = extractSessionCookieHeader(setCookie);
  if (session) {
    sessionCookieHeader = session;
    await persistSessionCookieHeader(session);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    onAuthExpired?.();
    throw new Error("Sesion expirada. Inicia sesion.");
  }
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

function buildCommentAttachmentToken(filename: string, fileUrl: string): string {
  return `[[file:${encodeURIComponent(filename)}|${fileUrl}]]`;
}

const COMMENT_ATTACHMENT_REGEX = /\[\[file:([^|\]]+)\|([^\]]+)\]\]/g;

function parseCommentBodyWithAttachments(body: string): {
  text: string;
  attachments: { filename: string; fileUrl: string }[];
} {
  const attachments: { filename: string; fileUrl: string }[] = [];
  const text = body.replace(COMMENT_ATTACHMENT_REGEX, (_full, encodedName: string, fileUrl: string) => {
    const filename = decodeURIComponent(encodedName);
    attachments.push({ filename, fileUrl });
    return "";
  });
  return { text: text.trim(), attachments };
}

/**
 * ImagePicker often returns `content://` (Android) or non-file URIs that React Native's
 * `fetch`+FormData cannot read — that surfaces as "Network request failed". Copy to a
 * real `file://` path first; then use expo-file-system multipart upload (reliable on device).
 */
async function prepareFileForUpload(fileUri: string, filename: string): Promise<{
  localUri: string;
  removeAfter: boolean;
}> {
  const safeName = sanitizeUploadFilename(filename);
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) {
    throw new Error("No hay carpeta temporal para preparar la foto.");
  }
  const dest = `${base}wo-upload-${Date.now()}-${safeName}`;
  await FileSystem.copyAsync({ from: fileUri, to: dest });
  return { localUri: dest, removeAfter: true };
}

async function apiUploadWorkOrderFile(
  workOrderId: string,
  fileUri: string,
  filename: string,
  mimeType: string
): Promise<WorkOrderAttachmentUploadResponse> {
  const safeName = sanitizeUploadFilename(filename);
  const mime = mimeType?.trim() || "application/octet-stream";
  const url = apiUrl(`/api/work-orders/${workOrderId}/attachments`);

  const { localUri, removeAfter } = await prepareFileForUpload(fileUri, safeName);
  try {
    const form = new FormData();
    form.append(
      "file",
      { uri: localUri, name: safeName, type: mime } as unknown as Blob
    );
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: sessionCookieHeader ? { Cookie: sessionCookieHeader } : undefined,
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
  const appVersionName = (Constants.expoConfig?.version ?? "0.0.0").trim();
  const appVersionCode = normalizeVersionCode(Constants.expoConfig?.android?.versionCode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authHydrating, setAuthHydrating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeSection, setActiveSection] = useState<AppSection>("workOrders");

  const [workOrders, setWorkOrders] = useState<WorkOrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | null>(null);

  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderDetail | null>(null);
  const selectedWorkOrderRef = useRef<WorkOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [workOrdersRefreshing, setWorkOrdersRefreshing] = useState(false);
  const [detailRefreshing, setDetailRefreshing] = useState(false);
  /** Task "Detalles" card: collapsed by default. */
  const [detailDetailsExpanded, setDetailDetailsExpanded] = useState(false);
  const [notificationsRefreshing, setNotificationsRefreshing] = useState(false);
  const [knowledgeRefreshing, setKnowledgeRefreshing] = useState(false);
  /** Draft strings for number fields while editing (allows "12." before blur). */
  const [checklistNumberDraft, setChecklistNumberDraft] = useState<Record<string, string>>({});
  const [checklistDropdownModal, setChecklistDropdownModal] = useState<{
    itemId: string;
    label: string;
    options: string[];
  } | null>(null);
  const [checklistPhotoUploadingId, setChecklistPhotoUploadingId] = useState<string | null>(null);
  const [checklistPhotoPreviewUrls, setChecklistPhotoPreviewUrls] = useState<Record<string, string>>(
    {}
  );
  const [detailComments, setDetailComments] = useState<WorkOrderComment[]>([]);
  const [detailCommentsLoading, setDetailCommentsLoading] = useState(false);
  const [detailCommentsError, setDetailCommentsError] = useState<string | null>(null);
  const [detailCommentDraft, setDetailCommentDraft] = useState("");
  const [detailCommentFiles, setDetailCommentFiles] = useState<PendingCommentFile[]>([]);
  const [detailCommentSaving, setDetailCommentSaving] = useState(false);
  const [downtimeSaving, setDowntimeSaving] = useState(false);
  const [downtimeError, setDowntimeError] = useState<string | null>(null);
  const [manualDowntimeDraft, setManualDowntimeDraft] = useState("");
  const [manualDowntimeUnit, setManualDowntimeUnit] = useState<"min" | "h">("min");
  const [downtimePreviewTick, setDowntimePreviewTick] = useState(0);
  const [checklistDatePicker, setChecklistDatePicker] = useState<{
    itemId: string;
    draft: Date;
  } | null>(null);
  const [machines, setMachines] = useState<
    Array<{ id: string; name: string; assetId: string; tracksMachineDowntime?: boolean }>
  >([]);
  const [machinesLoading, setMachinesLoading] = useState(false);
  const [machinePickerVisible, setMachinePickerVisible] = useState(false);
  const [machineSaving, setMachineSaving] = useState(false);
  /** Per work-order section expand state; missing key = expanded. */
  const [checklistSectionExpanded, setChecklistSectionExpanded] = useState<
    Record<string, boolean>
  >({});

  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);
  const [kbQuery, setKbQuery] = useState("");
  const [kbStorageDirUri, setKbStorageDirUri] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
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
  const shownUpdateVersionRef = useRef<string | null>(null);
  const [updateDownloading, setUpdateDownloading] = useState(false);

  const canLogin = username.trim().length > 0 && password.trim().length > 0;
  const firstName = useMemo(() => {
    const source = (me?.name ?? username).trim();
    if (!source) return "Técnico";
    return source.split(/\s+/)[0] ?? "Técnico";
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

  const workOrdersFiltered = useMemo(() => {
    let list = workOrders;
    if (filterAssigneeId != null) {
      list = list.filter((w) => workOrderInvolvesUser(w, filterAssigneeId));
    }
    return list;
  }, [workOrders, filterAssigneeId]);

  const activeTasks = useMemo(
    () =>
      workOrdersFiltered.filter(
        (w) => w.status === "pending" || w.status === "in_progress"
      ),
    [workOrdersFiltered]
  );
  const activeTasksSorted = useMemo(() => {
    const list = [...activeTasks];
    const rank: Record<WoPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const statusRank = (s: WoStatus) => (s === "in_progress" ? 0 : 1);
    list.sort((a, b) => {
      const sr = statusRank(a.status) - statusRank(b.status);
      if (sr !== 0) return sr;
      const pr = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
      if (pr !== 0) return pr;
      const o = (a.boardSortOrder ?? 0) - (b.boardSortOrder ?? 0);
      if (o !== 0) return o;
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [activeTasks]);

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
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "No se pudo cargar las tareas.");
      setWorkOrders([]);
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

  async function loadMachines() {
    setMachinesLoading(true);
    try {
      const data = await apiFetch<
        Array<{ id: string; name: string; assetId: string; tracksMachineDowntime?: boolean }>
      >("/api/assets");
      setMachines(Array.isArray(data) ? data : []);
    } catch {
      setMachines([]);
    } finally {
      setMachinesLoading(false);
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
      const name = item.filename?.trim() || "Documento";
      await openAttachmentUrl(item.fileUrl, name);
    } catch (error) {
      setKbError(error instanceof Error ? error.message : "No se pudo abrir el archivo.");
    } finally {
      setKbOpeningId(null);
    }
  }

  async function openWorkOrderImageLightbox(fileUrl: string, title: string) {
    const url = absoluteFileUrl(fileUrl);
    let previewUrl = url;
    if (isLikelyInternalDownloadUrl(url)) {
      try {
        previewUrl = await resolveInternalAttachmentUrl(url);
      } catch {
        previewUrl = url;
      }
    }
    setInlineImage({
      uri: previewUrl,
      title: title.trim() || "Imagen",
    });
  }

  async function openAttachmentUrl(fileUrl: string, filename: string) {
    const url = absoluteFileUrl(fileUrl);
    if (looksLikePdf(filename, fileUrl)) {
      let previewUrl = url;
      if (isLikelyInternalDownloadUrl(url)) {
        try {
          previewUrl = await resolveInternalAttachmentUrl(url);
        } catch {
          previewUrl = url;
        }
      }
      setInlinePdf({ uri: previewUrl, title: filename.trim() || "PDF" });
    } else if (looksLikeImageFilename(filename) || /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(fileUrl)) {
      void openWorkOrderImageLightbox(fileUrl, filename);
    } else {
      void Linking.openURL(url);
    }
  }

  async function loadMe() {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await apiFetch<CurrentUser>("/api/users/me");
      setMe(data);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "No se pudo cargar el perfil.");
      setMe(null);
    } finally {
      setProfileLoading(false);
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
    await Promise.all([
      loadWorkOrders(),
      loadKnowledge(),
      loadMe(),
      loadNotifications(),
      loadUsers(),
      loadMachines(),
    ]);
  }

  async function refreshWorkOrdersFeed() {
    setWorkOrdersRefreshing(true);
    try {
      await Promise.all([loadWorkOrders(), loadUsers(), loadMachines()]);
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

  async function refreshKnowledgeFeed() {
    setKnowledgeRefreshing(true);
    try {
      await loadKnowledge();
    } finally {
      setKnowledgeRefreshing(false);
    }
  }

  const closeTaskDetail = useCallback(() => {
    setSelectedWorkOrderId(null);
    setSelectedWorkOrder(null);
    setDetailError(null);
    setDetailComments([]);
    setDetailCommentsError(null);
    setDetailCommentDraft("");
    setDetailCommentFiles([]);
  }, []);

  const clearClientSession = useCallback(
    (authMessage?: string) => {
      sessionCookieHeader = null;
      void persistSessionCookieHeader(null);
      setIsLoggedIn(false);
      closeTaskDetail();
      setPassword("");
      assigneeFilterDefaultAppliedRef.current = false;
      setMe(null);
      setFilterAssigneeId(null);
      setNotifications([]);
      setUnreadCount(0);
      setOrdersError(null);
      setDetailError(null);
      setKbError(null);
      setNotificationsError(null);
      setActiveSection("workOrders");
      if (authMessage) setAuthError(authMessage);
    },
    [closeTaskDetail]
  );

  async function openWorkOrder(id: string, opts?: { silent?: boolean }) {
    const silent = opts?.silent === true;
    setSelectedWorkOrderId(id);
    if (!silent) {
      setDetailLoading(true);
      setDetailError(null);
    }
    setDetailCommentsLoading(true);
    setDetailCommentsError(null);
    try {
      const [data, notes] = await Promise.all([
        apiFetch<WorkOrderDetail>(`/api/work-orders/${id}`),
        apiFetch<WorkOrderComment[]>(`/api/work-orders/${id}/notes`),
      ]);
      setSelectedWorkOrder({ ...data, status: normalizeWoStatus(data.status) });
      setDetailComments(Array.isArray(notes) ? notes : []);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No se pudo cargar detalle.");
      setDetailCommentsError(
        error instanceof Error ? error.message : "No se pudieron cargar comentarios."
      );
      if (!silent) {
        setSelectedWorkOrder(null);
      }
    } finally {
      setDetailCommentsLoading(false);
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

  function parseChecklistNumberDraftValue(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  async function flushChecklistNumberDrafts(workOrderId: string): Promise<void> {
    if (selectedWorkOrderId !== workOrderId || selectedWorkOrder == null) return;
    const pending = Object.entries(checklistNumberDraft);
    if (pending.length === 0) return;

    setChecklistNumberDraft({});
    await Promise.all(
      pending.map(([itemId, text]) =>
        updateChecklist(itemId, {
          value: parseChecklistNumberDraftValue(text),
        })
      )
    );
  }

  async function updateWorkOrderStatusById(id: string, next: WoStatus) {
    setOrdersError(null);
    setDetailError(null);
    const detailSnapshot =
      selectedWorkOrderId === id && selectedWorkOrder != null ? selectedWorkOrder : null;
    if (next === "in_progress" && me != null) {
      const woForStart =
        detailSnapshot ?? workOrders.find((w) => w.id === id) ?? null;
      if (woForStart != null && !workOrderInvolvesUser(woForStart, me.id)) {
        const msg = "Solo el técnico asignado puede iniciar esta tarea.";
        setOrdersError(msg);
        if (selectedWorkOrderId === id) setDetailError(msg);
        return;
      }
    }
    try {
      if (next === "completed") {
        await flushChecklistNumberDrafts(id);
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

  async function patchWorkOrderDowntimeFields(patch: {
    countsMachineDowntime?: boolean;
    manualDowntimeMinutes?: number;
  }) {
    if (!selectedWorkOrder) return;
    const woId = selectedWorkOrder.id;
    setDowntimeSaving(true);
    setDowntimeError(null);
    const snapshot = selectedWorkOrder;
    setSelectedWorkOrder((wo) => {
      if (!wo || wo.id !== woId) return wo;
      return {
        ...wo,
        ...(patch.countsMachineDowntime !== undefined
          ? { countsMachineDowntime: patch.countsMachineDowntime }
          : {}),
        ...(patch.manualDowntimeMinutes !== undefined
          ? { manualDowntimeMinutes: patch.manualDowntimeMinutes }
          : {}),
      };
    });
    try {
      await apiFetch<{ ok: true }>(`/api/work-orders/${woId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      void openWorkOrder(woId, { silent: true });
    } catch (error) {
      setSelectedWorkOrder(snapshot);
      setDowntimeError(error instanceof Error ? error.message : "No se pudo guardar el paro.");
    } finally {
      setDowntimeSaving(false);
    }
  }

  async function patchWorkOrderAsset(assetId: string | null) {
    if (!selectedWorkOrder) return;
    const woId = selectedWorkOrder.id;
    if (selectedWorkOrder.status === "completed" || selectedWorkOrder.status === "cancelled") {
      return;
    }
    const nextId = assetId?.trim() ? assetId.trim() : null;
    if ((selectedWorkOrder.asset?.id ?? null) === nextId) {
      setMachinePickerVisible(false);
      return;
    }
    setMachineSaving(true);
    setDetailError(null);
    const snapshot = selectedWorkOrder;
    const picked = nextId ? machines.find((m) => m.id === nextId) : null;
    setSelectedWorkOrder((wo) => {
      if (!wo || wo.id !== woId) return wo;
      return {
        ...wo,
        asset: picked
          ? {
              id: picked.id,
              name: picked.name,
              assetId: picked.assetId,
              tracksMachineDowntime: picked.tracksMachineDowntime,
            }
          : null,
        ...(picked?.tracksMachineDowntime === false ? { countsMachineDowntime: false } : {}),
      };
    });
    setMachinePickerVisible(false);
    try {
      await apiFetch<{ ok: true }>(`/api/work-orders/${woId}`, {
        method: "PATCH",
        body: JSON.stringify({ assetId: nextId }),
      });
      void loadWorkOrders();
      void openWorkOrder(woId, { silent: true });
    } catch (error) {
      setSelectedWorkOrder(snapshot);
      setDetailError(error instanceof Error ? error.message : "No se pudo asignar la máquina.");
    } finally {
      setMachineSaving(false);
    }
  }

  async function saveManualDowntimeFromDraft() {
    if (!selectedWorkOrder) return;
    if (selectedWorkOrder.asset?.tracksMachineDowntime === false) return;
    const raw = manualDowntimeDraft.trim();
    let minutes = 0;
    if (raw !== "") {
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        setDowntimeError("Cantidad inválida");
        return;
      }
      minutes = manualDowntimeUnit === "h" ? Math.round(n * 60) : Math.round(n);
    }
    if (minutes > MAX_MANUAL_DOWNTIME_MINUTES_MOBILE) {
      setDowntimeError("Paro manual demasiado grande (máx. 525600 minutos).");
      return;
    }
    await patchWorkOrderDowntimeFields({ manualDowntimeMinutes: minutes });
  }

  async function finalizeChecklistPhotoFromPicker(
    workOrderId: string,
    itemId: string,
    workOrderSnapshot: WorkOrderDetail,
    result: ImagePicker.ImagePickerResult
  ) {
    if (result.canceled || !result.assets?.[0]) return;
    const existing = checklistPhotoUrls(
      workOrderSnapshot.checklist.find((i) => i.id === itemId)?.value
    );
    setChecklistPhotoUploadingId(itemId);
    setDetailError(null);
    try {
      const uploadedUrls: string[] = [];
      for (const asset of result.assets) {
        const mime = asset.mimeType ?? "image/jpeg";
        let filename =
          asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120) ?? "";
        if (!filename) {
          const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
          filename = `evidencia-${Date.now()}${ext}`;
        }
        const uploaded = await apiUploadWorkOrderFile(workOrderId, asset.uri, filename, mime);
        uploadedUrls.push(uploaded.fileUrl);
      }
      const nextValue = Array.from(new Set([...existing, ...uploadedUrls]));
      const liveWo = selectedWorkOrderRef.current;
      if (liveWo?.id === workOrderId) {
        setSelectedWorkOrder((wo) => {
          if (!wo || wo.id !== workOrderId) return wo;
          return {
            ...wo,
            checklist: wo.checklist.map((i) =>
              i.id === itemId ? { ...i, value: nextValue } : i
            ),
          };
        });
      }
      await apiFetch<{ ok: true }>(`/api/work-orders/${workOrderId}/checklist`, {
        method: "PATCH",
        body: JSON.stringify({ itemId, value: nextValue }),
      });
    } catch (error) {
      if (selectedWorkOrderRef.current?.id === workOrderId) {
        setSelectedWorkOrder(workOrderSnapshot);
      }
      setDetailError(error instanceof Error ? error.message : "No se pudo subir la foto.");
    } finally {
      setChecklistPhotoUploadingId(null);
    }
  }

  async function pickChecklistPhotoFromCamera(workOrderId: string, itemId: string) {
    const workOrderSnapshot = selectedWorkOrderRef.current;
    if (!workOrderSnapshot || workOrderSnapshot.id !== workOrderId) {
      setDetailError("Vuelve a abrir la tarea e intenta de nuevo.");
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso", "Se necesita acceso a la camara para tomar la foto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    await finalizeChecklistPhotoFromPicker(workOrderId, itemId, workOrderSnapshot, result);
  }

  async function pickChecklistPhotoFromLibrary(workOrderId: string, itemId: string) {
    const workOrderSnapshot = selectedWorkOrderRef.current;
    if (!workOrderSnapshot || workOrderSnapshot.id !== workOrderId) {
      setDetailError("Vuelve a abrir la tarea e intenta de nuevo.");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso", "Se necesita acceso a la galeria para elegir una foto.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    await finalizeChecklistPhotoFromPicker(workOrderId, itemId, workOrderSnapshot, result);
  }

  function openChecklistPhotoSourcePicker(workOrderId: string, itemId: string) {
    Alert.alert("Evidencia", "Elige el origen de la foto", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Camara",
        onPress: () => {
          setTimeout(() => {
            void pickChecklistPhotoFromCamera(workOrderId, itemId);
          }, 250);
        },
      },
      {
        text: "Galeria",
        onPress: () => {
          setTimeout(() => {
            void pickChecklistPhotoFromLibrary(workOrderId, itemId);
          }, 100);
        },
      },
    ]);
  }

  async function removeChecklistPhoto(itemId: string, photoUrl: string) {
    if (!selectedWorkOrder) return;
    const current = checklistPhotoUrls(selectedWorkOrder.checklist.find((i) => i.id === itemId)?.value);
    const next = current.filter((url) => url !== photoUrl);
    await updateChecklist(itemId, { value: next });
  }

  async function refreshChecklistPhotoPreviewUrl(itemId: string, originalUrl: string) {
    const cacheKey = `${itemId}|${originalUrl}`;
    const candidate = absoluteFileUrl(originalUrl);
    if (!isLikelyInternalDownloadUrl(candidate)) return;
    try {
      const signed = await resolveInternalAttachmentUrl(candidate);
      setChecklistPhotoPreviewUrls((prev) => ({ ...prev, [cacheKey]: signed }));
    } catch {
      // Keep current URL if refresh fails.
    }
  }

  async function pickCommentImagesFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso", "Se necesita acceso a la galería para elegir imágenes.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    setDetailCommentFiles((prev) => [
      ...prev,
      ...mapImagePickerAssetsToPendingCommentFiles(result.assets),
    ]);
  }

  async function pickCommentImagesFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso", "Se necesita acceso a la camara para tomar la foto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    setDetailCommentFiles((prev) => [
      ...prev,
      ...mapImagePickerAssetsToPendingCommentFiles(result.assets),
    ]);
  }

  function openCommentAttachmentPicker() {
    Alert.alert("Adjuntar en comentario", "Elige el origen de la imagen", [
      { text: "Cancelar", style: "cancel" },
      { text: "Camara", onPress: () => void pickCommentImagesFromCamera() },
      { text: "Galeria", onPress: () => void pickCommentImagesFromLibrary() },
    ]);
  }

  async function submitDetailComment() {
    if (!selectedWorkOrder || detailCommentSaving) return;
    const bodyText = detailCommentDraft.trim();
    if (!bodyText && detailCommentFiles.length === 0) return;
    setDetailCommentSaving(true);
    setDetailCommentsError(null);
    setDetailError(null);
    try {
      const uploadedTokens: string[] = [];
      for (const file of detailCommentFiles) {
        const uploaded = await apiUploadWorkOrderFile(
          selectedWorkOrder.id,
          file.uri,
          file.filename,
          file.mimeType
        );
        uploadedTokens.push(buildCommentAttachmentToken(uploaded.filename, uploaded.fileUrl));
      }
      const composedBody = [bodyText, ...uploadedTokens].filter((x) => x.trim() !== "").join("\n");
      const created = await apiFetch<WorkOrderComment>(`/api/work-orders/${selectedWorkOrder.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: composedBody }),
      });
      setDetailComments((prev) => [created, ...prev]);
      setDetailCommentDraft("");
      setDetailCommentFiles([]);
      void openWorkOrder(selectedWorkOrder.id, { silent: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo enviar el comentario.";
      setDetailCommentsError(msg);
      setDetailError(msg);
    } finally {
      setDetailCommentSaving(false);
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
      clearClientSession();
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
    const checklistParsed = parseChecklistRevisionNotificationBody(notification.body);
    if (
      notification.title === CHECKLIST_REVISION_REVIEW_TITLE &&
      API_HOST &&
      checklistParsed?.checklistId
    ) {
      const path = checklistRevisionNotificationHref(checklistParsed);
      const url = apiUrl(path);
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (canOpen) {
        await Linking.openURL(url);
      }
      return;
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

  const startAndroidAppUpdate = useCallback(async (remote: AndroidAppUpdateManifest) => {
    const apkUrl = resolveRemoteUrl(remote.apkUrl);
    if (!apkUrl) {
      Alert.alert("Actualizacion", "No se encontro una URL valida para descargar la actualizacion.");
      return;
    }
    setUpdateDownloading(true);
    try {
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        await Linking.openURL(apkUrl);
        return;
      }
      const fileName = `msa-update-${Date.now()}.apk`;
      const localUri = `${baseDir}${fileName}`;
      const download = await FileSystem.downloadAsync(apkUrl, localUri);
      const canOpen = await Linking.canOpenURL(download.uri).catch(() => false);
      if (canOpen) {
        await Linking.openURL(download.uri);
      } else {
        await Linking.openURL(apkUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo descargar la actualizacion.";
      Alert.alert("Actualizacion", message);
    } finally {
      setUpdateDownloading(false);
    }
  }, []);

  const checkAndroidAppUpdate = useCallback(async () => {
    if (Platform.OS !== "android") return;
    const manifestUrl = resolveRemoteUrl(APP_UPDATE_MANIFEST_PATH);
    if (!manifestUrl) return;
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) return;
      const data = (await response.json()) as Partial<AndroidAppUpdateManifest>;
      const remoteVersionName =
        typeof data.versionName === "string" ? data.versionName.trim() : "";
      const remoteApkUrl = typeof data.apkUrl === "string" ? data.apkUrl.trim() : "";
      if (!remoteVersionName || !remoteApkUrl) return;
      const remote: AndroidAppUpdateManifest = {
        versionName: remoteVersionName,
        apkUrl: remoteApkUrl,
        versionCode: normalizeVersionCode(data.versionCode) ?? undefined,
        required: data.required === true,
        notes: typeof data.notes === "string" ? data.notes.trim() : undefined,
        sha256: typeof data.sha256 === "string" ? data.sha256.trim() : undefined,
      };
      if (!isRemoteVersionNewer(appVersionName, appVersionCode, remote)) return;
      const alertKey = `${remote.versionName}:${remote.versionCode ?? "na"}`;
      if (shownUpdateVersionRef.current === alertKey || updateDownloading) return;
      shownUpdateVersionRef.current = alertKey;
      const body = remote.notes
        ? `Version ${remote.versionName} disponible.\n\n${remote.notes}`
        : `Version ${remote.versionName} disponible.`;
      Alert.alert("Actualizacion disponible", body, [
        ...(remote.required ? [] : [{ text: "Despues", style: "cancel" as const }]),
        {
          text: "Actualizar",
          onPress: () => {
            void startAndroidAppUpdate(remote);
          },
        },
      ]);
    } catch {
      // Ignore updater errors to avoid noisy UX when offline.
    }
  }, [appVersionCode, appVersionName, startAndroidAppUpdate, updateDownloading]);

  useEffect(() => {
    onAuthExpired = () => {
      clearClientSession("Tu sesion expiro. Inicia sesion nuevamente.");
    };
    return () => {
      if (onAuthExpired) onAuthExpired = null;
    };
  }, [clearClientSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const persistedCookie = await loadPersistedSessionCookieHeader();
        if (!persistedCookie) return;
        sessionCookieHeader = persistedCookie;
        const meData = await apiFetch<CurrentUser>("/api/users/me");
        if (cancelled) return;
        setIsLoggedIn(true);
        setMe(meData);
        await Promise.all([loadWorkOrders(), loadKnowledge(), loadNotifications(), loadUsers()]);
      } catch {
        sessionCookieHeader = null;
        await persistSessionCookieHeader(null).catch(() => undefined);
      } finally {
        if (!cancelled) setAuthHydrating(false);
      }
    })();
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
    if (Platform.OS !== "android") return;
    void checkAndroidAppUpdate();
    const timer = setInterval(() => {
      void checkAndroidAppUpdate();
    }, APP_UPDATE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [checkAndroidAppUpdate]);

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
      if (activeSection === "knowledgeBase" || activeSection === "notifications") {
        setActiveSection("workOrders");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [inlineImage, inlinePdf, selectedWorkOrderId, closeTaskDetail, activeSection]);

  useEffect(() => {
    setChecklistNumberDraft({});
  }, [selectedWorkOrderId]);

  useEffect(() => {
    setChecklistDropdownModal(null);
    setChecklistPhotoUploadingId(null);
    setChecklistDatePicker(null);
    setDetailDetailsExpanded(false);
    setChecklistPhotoPreviewUrls({});
  }, [selectedWorkOrderId]);

  useEffect(() => {
    selectedWorkOrderRef.current = selectedWorkOrder;
  }, [selectedWorkOrder]);

  useEffect(() => {
    setDowntimeError(null);
    if (!selectedWorkOrder) {
      setManualDowntimeDraft("");
      setManualDowntimeUnit("min");
      return;
    }
    setManualDowntimeDraft(
      String(Math.max(0, Math.floor(Number(selectedWorkOrder.manualDowntimeMinutes ?? 0))))
    );
    setManualDowntimeUnit("min");
  }, [selectedWorkOrderId, selectedWorkOrder?.id, selectedWorkOrder?.manualDowntimeMinutes]);

  useEffect(() => {
    if (!selectedWorkOrderId || !selectedWorkOrder) return;
    if (selectedWorkOrder.status !== "in_progress" || !selectedWorkOrder.countsMachineDowntime) {
      return;
    }
    const id = setInterval(() => {
      setDowntimePreviewTick((t) => t + 1);
    }, 60_000);
    return () => clearInterval(id);
  }, [
    selectedWorkOrderId,
    selectedWorkOrder?.id,
    selectedWorkOrder?.status,
    selectedWorkOrder?.countsMachineDowntime,
    selectedWorkOrder?.startedAt,
  ]);

  useEffect(() => {
    let cancelled = false;
    const wo = selectedWorkOrder;
    if (!wo) return;
    const photoEntries = wo.checklist
      .filter((item) => item.fieldType === "photo")
      .flatMap((item) =>
        checklistPhotoUrls(item.value).map((uri) => ({
          cacheKey: `${item.id}|${uri}`,
          uri,
        }))
      );

    for (const entry of photoEntries) {
      if (!isLikelyInternalDownloadUrl(entry.uri)) {
        setChecklistPhotoPreviewUrls((prev) =>
          prev[entry.cacheKey] === entry.uri ? prev : { ...prev, [entry.cacheKey]: entry.uri }
        );
        continue;
      }
      if (checklistPhotoPreviewUrls[entry.cacheKey]) continue;
      void resolveInternalAttachmentUrl(entry.uri)
        .then((signed) => {
          if (cancelled) return;
          setChecklistPhotoPreviewUrls((prev) => ({ ...prev, [entry.cacheKey]: signed }));
        })
        .catch(() => {
          if (cancelled) return;
          setChecklistPhotoPreviewUrls((prev) =>
            prev[entry.cacheKey] === entry.uri ? prev : { ...prev, [entry.cacheKey]: entry.uri }
          );
        });
    }
    return () => {
      cancelled = true;
    };
  }, [selectedWorkOrder, checklistPhotoPreviewUrls]);

  const detailCanEditChecklist = selectedWorkOrder?.status === "in_progress";

  const displayChecklist = useMemo(() => {
    const list = selectedWorkOrder?.checklist;
    if (!list?.length) return [];
    return flattenChecklistTreeForDisplay(list);
  }, [selectedWorkOrder?.id, selectedWorkOrder?.checklist]);

  const displayChecklistGroups = useMemo(() => {
    const list = selectedWorkOrder?.checklist;
    if (!list?.length || !displayChecklist.length) return [];
    return groupFlattenedChecklistBySection(displayChecklist, list);
  }, [selectedWorkOrder?.checklist, displayChecklist]);

  const checklistSectionExpandKey = useCallback(
    (sectionId: string) =>
      selectedWorkOrderId ? `${selectedWorkOrderId}:${sectionId}` : sectionId,
    [selectedWorkOrderId]
  );

  const isChecklistSectionExpanded = useCallback(
    (sectionId: string) => checklistSectionExpanded[checklistSectionExpandKey(sectionId)] !== false,
    [checklistSectionExpanded, checklistSectionExpandKey]
  );

  const toggleChecklistSectionExpanded = useCallback((sectionId: string) => {
    const key = checklistSectionExpandKey(sectionId);
    setChecklistSectionExpanded((prev) => ({
      ...prev,
      [key]: prev[key] === false,
    }));
  }, [checklistSectionExpandKey]);

  const detailCanStartSelectedWorkOrder =
    me != null &&
    selectedWorkOrder != null &&
    workOrderInvolvesUser(selectedWorkOrder, me.id);

  const detailSlideDockVisible =
    selectedWorkOrder != null &&
    !detailLoading &&
    !detailError &&
    (selectedWorkOrder.status === "in_progress" ||
      (selectedWorkOrder.status === "pending" && detailCanStartSelectedWorkOrder));

  const detailSlideCompleteNeedsHint =
    selectedWorkOrder != null &&
    !detailLoading &&
    !detailError &&
    selectedWorkOrder.status === "in_progress" &&
    selectedWorkOrder.checklist.length > 0 &&
    !isChecklistFullyComplete(selectedWorkOrder.checklist);

  const detailSlideCompleteDisabled = detailSlideCompleteNeedsHint;

  if (authHydrating) {
    return (
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.loginHydrationState}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.loginHydrationText}>Cargando...</Text>
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
              <HeaderProfileAvatar
                name={(me?.name ?? username).trim() || "Técnico"}
                userId={me?.id}
                avatarUrl={me?.avatarUrl ?? null}
                avatarBackgroundColor={me?.avatarBackgroundColor ?? null}
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
                    <View style={styles.detailPageTitleRow}>
                      <Text style={[styles.detailPageTitle, styles.detailPageTitleFlex]} numberOfLines={3}>
                        {selectedWorkOrder.title}
                      </Text>
                      {selectedWorkOrder.status === "in_progress" ? (
                        <Pressable
                          style={styles.detailPagePauseBtn}
                          onPress={() => void updateStatus("pending")}
                          accessibilityRole="button"
                          accessibilityLabel="Pausar tarea"
                        >
                          <Ionicons name="pause" size={18} color={theme.zinc700} />
                          <Text style={styles.detailPagePauseBtnText}>Pausar</Text>
                        </Pressable>
                      ) : null}
                    </View>

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
                            {selectedWorkOrder.assignees &&
                            selectedWorkOrder.assignees.length > 0 ? (
                              <View style={{ gap: 10 }}>
                                {selectedWorkOrder.assignees.map((a) => (
                                  <View
                                    key={a.id}
                                    style={[styles.detailRowInline, { gap: 8 }]}
                                  >
                                    <AssigneeInitialsRing
                                      name={a.name}
                                      userId={a.id}
                                      avatarBackgroundColor={a.avatarBackgroundColor}
                                    />
                                    <Text
                                      style={styles.detailRowValueText}
                                      numberOfLines={2}
                                    >
                                      {a.name}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ) : selectedWorkOrder.assignee?.name ? (
                              <>
                                <AssigneeInitialsRing
                                  name={selectedWorkOrder.assignee.name}
                                  userId={selectedWorkOrder.assignee.id}
                                  avatarBackgroundColor={
                                    selectedWorkOrder.assignee.avatarBackgroundColor
                                  }
                                />
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
                        <View style={styles.detailRowDivider} />
                        <View style={styles.detailRow}>
                          <Text style={styles.detailRowLabel}>Máquina</Text>
                          <View style={styles.detailRowValue}>
                            {selectedWorkOrder.status === "completed" ||
                            selectedWorkOrder.status === "cancelled" ? (
                              selectedWorkOrder.asset ? (
                                <>
                                  <Text style={styles.detailRowValueText} numberOfLines={2}>
                                    {selectedWorkOrder.asset.name}
                                  </Text>
                                  <Text style={styles.detailRowSub}>
                                    {selectedWorkOrder.asset.assetId}
                                  </Text>
                                </>
                              ) : (
                                <Text style={styles.detailRowMuted}>Sin máquina</Text>
                              )
                            ) : (
                              <Pressable
                                style={styles.machinePickerTrigger}
                                onPress={() => setMachinePickerVisible(true)}
                                disabled={machineSaving || machinesLoading}
                                accessibilityRole="button"
                                accessibilityLabel="Seleccionar máquina"
                              >
                                {machineSaving ? (
                                  <ActivityIndicator size="small" color={theme.primary} />
                                ) : selectedWorkOrder.asset ? (
                                  <>
                                    <Text style={styles.detailRowValueText} numberOfLines={2}>
                                      {selectedWorkOrder.asset.name}
                                    </Text>
                                    <Text style={styles.detailRowSub}>
                                      {selectedWorkOrder.asset.assetId}
                                    </Text>
                                  </>
                                ) : (
                                  <Text style={styles.detailRowMuted}>
                                    {machinesLoading ? "Cargando…" : "Seleccionar máquina…"}
                                  </Text>
                                )}
                                <Ionicons name="chevron-down" size={18} color={theme.zinc500} />
                              </Pressable>
                            )}
                          </View>
                        </View>
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

                    {selectedWorkOrder.status !== "cancelled" && selectedWorkOrder.asset ? (
                      <View style={styles.detailCard}>
                        <View style={styles.detailCardHeader}>
                          <Text style={styles.detailCardHeaderTitle}>Paro de máquina</Text>
                        </View>
                        <View style={styles.detailCardBody}>
                          {selectedWorkOrder.asset.tracksMachineDowntime === false ? (
                            <Text style={styles.detailRowMuted}>
                              El seguimiento de paro está desactivado para esta máquina. Un administrador
                              puede activarlo desde la app web (editar máquina).
                            </Text>
                          ) : null}
                          <View style={styles.downtimeSwitchRow}>
                            <Text style={styles.downtimeSwitchLabel}>
                              Contar el tiempo por lo que dure esta tarea en progreso como paro de
                              máquina
                            </Text>
                            <Switch
                              value={selectedWorkOrder.countsMachineDowntime === true}
                              onValueChange={(v) => void patchWorkOrderDowntimeFields({ countsMachineDowntime: v })}
                              disabled={
                                downtimeSaving ||
                                selectedWorkOrder.asset?.tracksMachineDowntime === false
                              }
                              trackColor={{ false: theme.zinc300, true: "#FDBA74" }}
                              thumbColor={
                                selectedWorkOrder.countsMachineDowntime === true
                                  ? theme.accent
                                  : "#f4f3f4"
                              }
                            />
                          </View>
                          {selectedWorkOrder.countsMachineDowntime ? (
                            <Text style={styles.downtimePreviewLine}>
                              Paro automático (vista previa):{" "}
                              <Text style={styles.detailRowValueText}>
                                {formatMinutesShort(
                                  workOrderAutoDowntimePreviewMinutesMobile(selectedWorkOrder) +
                                    downtimePreviewTick * 0
                                )}
                              </Text>
                              {selectedWorkOrder.status === "in_progress" ? (
                                <Text style={styles.detailRowSub}> · se actualiza cada minuto</Text>
                              ) : null}
                            </Text>
                          ) : null}
                          {selectedWorkOrder.status === "completed" &&
                          selectedWorkOrder.countsMachineDowntime ? (
                            <Text style={styles.downtimeCompletedHint}>
                              Al cerrar la tarea, este intervalo se sumó al total de la máquina (si estaba
                              vinculada).
                            </Text>
                          ) : null}

                          <View style={styles.downtimeManualBlock}>
                            <Text style={styles.downtimeManualTitle}>Paro manual adicional</Text>
                            <Text style={styles.downtimeManualSub}>
                              Por ejemplo paro sin checklist o no cubierto por el tiempo en curso.
                            </Text>
                            <View style={styles.downtimeManualInputs}>
                              <TextInput
                                value={manualDowntimeDraft}
                                onChangeText={setManualDowntimeDraft}
                                editable={
                                  !downtimeSaving &&
                                  selectedWorkOrder.asset?.tracksMachineDowntime !== false
                                }
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={theme.zinc400}
                                style={styles.downtimeManualField}
                              />
                              <View style={styles.downtimeUnitRow}>
                                <Pressable
                                  onPress={() => setManualDowntimeUnit("min")}
                                  disabled={
                                    downtimeSaving ||
                                    selectedWorkOrder.asset?.tracksMachineDowntime === false
                                  }
                                  style={({ pressed }) => [
                                    styles.downtimeUnitChip,
                                    manualDowntimeUnit === "min"
                                      ? styles.downtimeUnitChipOn
                                      : styles.downtimeUnitChipOff,
                                    pressed && styles.downtimeUnitChipPressed,
                                  ]}
                                >
                                  <Text
                                    style={
                                      manualDowntimeUnit === "min"
                                        ? styles.downtimeUnitChipTextOn
                                        : styles.downtimeUnitChipTextOff
                                    }
                                  >
                                    Min
                                  </Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => setManualDowntimeUnit("h")}
                                  disabled={
                                    downtimeSaving ||
                                    selectedWorkOrder.asset?.tracksMachineDowntime === false
                                  }
                                  style={({ pressed }) => [
                                    styles.downtimeUnitChip,
                                    manualDowntimeUnit === "h"
                                      ? styles.downtimeUnitChipOn
                                      : styles.downtimeUnitChipOff,
                                    pressed && styles.downtimeUnitChipPressed,
                                  ]}
                                >
                                  <Text
                                    style={
                                      manualDowntimeUnit === "h"
                                        ? styles.downtimeUnitChipTextOn
                                        : styles.downtimeUnitChipTextOff
                                    }
                                  >
                                    Horas
                                  </Text>
                                </Pressable>
                              </View>
                              <Pressable
                                onPress={() => void saveManualDowntimeFromDraft()}
                                disabled={
                                  downtimeSaving ||
                                  selectedWorkOrder.asset?.tracksMachineDowntime === false
                                }
                                style={({ pressed }) => [
                                  styles.downtimeSaveBtn,
                                  (downtimeSaving ||
                                    selectedWorkOrder.asset?.tracksMachineDowntime === false) &&
                                    styles.downtimeSaveBtnDisabled,
                                  pressed && styles.downtimeSaveBtnPressed,
                                ]}
                              >
                                <Text style={styles.downtimeSaveBtnText}>
                                  {downtimeSaving ? "Guardando…" : "Guardar"}
                                </Text>
                              </Pressable>
                            </View>
                            {selectedWorkOrder.status === "completed" ? (
                              <Text style={styles.downtimeSavedLine}>
                                Guardado:{" "}
                                <Text style={styles.detailRowValueText}>
                                  {formatMinutesShort(
                                    Math.max(0, Math.floor(Number(selectedWorkOrder.manualDowntimeMinutes ?? 0)))
                                  )}
                                </Text>
                              </Text>
                            ) : null}
                          </View>

                          {downtimeError ? <Text style={styles.errorText}>{downtimeError}</Text> : null}
                        </View>
                      </View>
                    ) : null}

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

                    {selectedWorkOrder.checklist.length > 0 ? (
                      <View style={styles.detailCard}>
                        <View style={styles.detailCardHeader}>
                          <Text style={styles.detailCardHeaderTitle}>Checklist</Text>
                        </View>
                        <View style={styles.detailCardBody}>
                          {selectedWorkOrder.status === "pending" ? (
                            detailCanStartSelectedWorkOrder ? (
                              <Text style={styles.checklistHint}>
                                Cambia el estado a <Text style={styles.checklistHintStrong}>En progreso</Text> para
                                editar el checklist.
                              </Text>
                            ) : (
                              <Text style={styles.checklistHint}>
                                Solo el técnico asignado puede iniciar esta tarea.
                              </Text>
                            )
                          ) : null}
                          <View style={styles.checklistGroupsStack}>
                          {displayChecklistGroups.map((group, groupIdx) => {
                            const renderChecklistItem = (
                              item: (typeof displayChecklist)[number],
                              ctx: { insideSection: boolean; loose?: boolean; isLast?: boolean }
                            ) => {
                            const depth = checklistItemDepth(item, selectedWorkOrder.checklist);
                            const indent = ctx.insideSection
                              ? undefined
                              : { marginLeft: Math.min(depth, 8) * 12 };
                            const rowStyle = ctx.insideSection
                              ? [
                                  styles.checklistSectionRow,
                                  ctx.isLast ? styles.checklistSectionRowLast : null,
                                ]
                              : ctx.loose
                                ? [
                                    styles.checklistLooseRow,
                                    ctx.isLast ? styles.checklistLooseRowLast : null,
                                    indent,
                                  ]
                                : [styles.checklistCard, indent];
                            return item.type === "step" ? (
                              <Pressable
                                key={item.id}
                                style={[
                                  ...rowStyle,
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
                            ) : item.type === "text_block" ? (
                              <View
                                key={item.id}
                                style={[
                                  ctx.insideSection
                                    ? [
                                        styles.checklistSectionRow,
                                        ctx.isLast ? styles.checklistSectionRowLast : null,
                                      ]
                                    : ctx.loose
                                      ? [
                                          styles.checklistLooseRow,
                                          ctx.isLast ? styles.checklistLooseRowLast : null,
                                          indent,
                                        ]
                                      : [{ marginBottom: 10 }, indent],
                                ]}
                              >
                                {item.fieldType === "title" ? (
                                  <Text style={styles.checklistTextBlockTitle}>{item.label}</Text>
                                ) : item.fieldType === "subtitle" ? (
                                  <Text style={styles.checklistTextBlockSubtitle}>{item.label}</Text>
                                ) : (
                                  <Text style={styles.checklistTextBlockBody}>{item.label}</Text>
                                )}
                              </View>
                            ) : (
                              <View
                                key={item.id}
                                style={[
                                  ...rowStyle,
                                ]}
                              >
                                {item.fieldType !== "checkbox" ? (
                                  <Text style={styles.checklistFieldLabel}>
                                    {item.label}
                                    {item.isOptional ? (
                                      <Text style={styles.checklistFieldOptionalHint}> (opcional)</Text>
                                    ) : null}
                                  </Text>
                                ) : null}
                                {!detailCanEditChecklist ? (
                                  item.fieldType === "photo" &&
                                  checklistPhotoUrls(item.value).length > 0 ? (
                                    <View style={styles.checklistPhotoGrid}>
                                      {checklistPhotoUrls(item.value).map((photoUrl, idx) => {
                                        const cacheKey = `${item.id}|${photoUrl}`;
                                        const previewUrl =
                                          checklistPhotoPreviewUrls[cacheKey] ?? photoUrl;
                                        return (
                                          <Pressable
                                            key={`${item.id}-readonly-${idx}-${photoUrl}`}
                                            onPress={() =>
                                              void openWorkOrderImageLightbox(previewUrl, item.label)
                                            }
                                            accessibilityRole="button"
                                            accessibilityLabel={`Ampliar foto ${idx + 1}: ${item.label}`}
                                          >
                                            <Image
                                              source={mobileImageSource(previewUrl)}
                                              style={styles.checklistPhotoPreview}
                                              resizeMode="cover"
                                              onError={() => {
                                                void refreshChecklistPhotoPreviewUrl(item.id, photoUrl);
                                              }}
                                            />
                                          </Pressable>
                                        );
                                      })}
                                    </View>
                                  ) : item.fieldType === "checkbox" ? (
                                    <View style={styles.checklistCheckboxCard}>
                                      <View
                                        style={[
                                          styles.checklistStepBox,
                                          item.value === true
                                            ? styles.checklistStepBoxOn
                                            : styles.checklistStepBoxOff,
                                        ]}
                                      >
                                        {item.value === true ? (
                                          <Ionicons name="checkmark" size={16} color={theme.white} />
                                        ) : null}
                                      </View>
                                      <Text
                                        style={[
                                          styles.checklistCheckboxText,
                                          item.value === true ? styles.checklistCheckboxTextDone : null,
                                        ]}
                                      >
                                        {item.label}
                                        {item.isOptional && item.value == null ? (
                                          <Text style={styles.checklistFieldOptionalHint}> · Sin respuesta</Text>
                                        ) : null}
                                      </Text>
                                    </View>
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
                                  <Pressable
                                    style={styles.checklistCheckboxCard}
                                    onPress={() => {
                                      if (item.isOptional) {
                                        if (item.value === true) {
                                          void updateChecklist(item.id, { value: false });
                                        } else if (item.value === false) {
                                          void updateChecklist(item.id, { value: null });
                                        } else {
                                          void updateChecklist(item.id, { value: true });
                                        }
                                      } else {
                                        void updateChecklist(item.id, {
                                          value: !(item.value === true),
                                        });
                                      }
                                    }}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: item.value === true }}
                                    accessibilityLabel={item.label || "Marcar si aplica"}
                                  >
                                    <View
                                      style={[
                                        styles.checklistStepBox,
                                        item.value === true
                                          ? styles.checklistStepBoxOn
                                          : item.value === false
                                            ? styles.checklistStepBoxOff
                                            : [styles.checklistStepBoxOff, styles.checklistStepBoxOptionalUnset],
                                      ]}
                                    >
                                      {item.value === true ? (
                                        <Ionicons name="checkmark" size={16} color={theme.white} />
                                      ) : null}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text
                                        style={[
                                          styles.checklistCheckboxText,
                                          item.value === true ? styles.checklistCheckboxTextDone : null,
                                        ]}
                                      >
                                        {item.label}
                                      </Text>
                                      {item.isOptional ? (
                                        <Text style={styles.checklistFieldOptionalHint}>
                                          Opcional: toque Sí → No → vacío
                                        </Text>
                                      ) : null}
                                    </View>
                                  </Pressable>
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
                                    onEndEditing={(event) => {
                                      const text = event.nativeEvent.text ?? checklistNumberDraft[item.id] ?? "";
                                      setChecklistNumberDraft((d) => {
                                        const next = { ...d };
                                        delete next[item.id];
                                        return next;
                                      });
                                      void updateChecklist(item.id, {
                                        value: parseChecklistNumberDraftValue(text),
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
                                        {checklistPhotoUrls(item.value).length > 0 ? (
                                          <View style={styles.checklistPhotoGrid}>
                                            {checklistPhotoUrls(item.value).map((photoUrl, idx) => {
                                              const cacheKey = `${item.id}|${photoUrl}`;
                                              const previewUrl =
                                                checklistPhotoPreviewUrls[cacheKey] ?? photoUrl;
                                              return (
                                                <View key={`${item.id}-${idx}-${photoUrl}`} style={styles.checklistPhotoTile}>
                                                  <Pressable
                                                    onPress={() =>
                                                      void openWorkOrderImageLightbox(previewUrl, item.label)
                                                    }
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Ampliar foto ${idx + 1}: ${item.label}`}
                                                  >
                                                    <Image
                                                      source={mobileImageSource(previewUrl)}
                                                      style={styles.checklistPhotoPreview}
                                                      resizeMode="cover"
                                                      onError={() => {
                                                        void refreshChecklistPhotoPreviewUrl(
                                                          item.id,
                                                          photoUrl
                                                        );
                                                      }}
                                                    />
                                                  </Pressable>
                                                  <Pressable
                                                    style={styles.checklistPhotoRemoveBtn}
                                                    onPress={() => void removeChecklistPhoto(item.id, photoUrl)}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Eliminar foto ${idx + 1}`}
                                                  >
                                                    <Ionicons name="close" size={14} color={theme.white} />
                                                  </Pressable>
                                                </View>
                                              );
                                            })}
                                          </View>
                                        ) : null}
                                        <Pressable
                                          style={styles.checklistPhotoActionBtn}
                                          onPress={() =>
                                            openChecklistPhotoSourcePicker(
                                              selectedWorkOrder.id,
                                              item.id
                                            )
                                          }
                                        >
                                          <Ionicons name="camera-outline" size={20} color={theme.primary} />
                                          <Text style={styles.checklistPhotoActionText}>
                                            {checklistPhotoUrls(item.value).length > 0
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
                            );
                            };
                            if (group.kind === "section") {
                              if (group.items.length === 0) {
                                return (
                                  <Text
                                    key={group.section.id}
                                    style={[
                                      styles.checklistGroupHeading,
                                      groupIdx > 0 ? styles.checklistSectionCardGap : null,
                                    ]}
                                  >
                                    {group.section.label}
                                  </Text>
                                );
                              }
                              const sectionExpanded = isChecklistSectionExpanded(group.section.id);
                              return (
                                <View
                                  key={group.section.id}
                                  style={[
                                    styles.checklistSectionCard,
                                    groupIdx > 0 ? styles.checklistSectionCardGap : null,
                                  ]}
                                >
                                  <Pressable
                                    style={styles.checklistSectionCardHeader}
                                    onPress={() => toggleChecklistSectionExpanded(group.section.id)}
                                    accessibilityRole="button"
                                    accessibilityState={{ expanded: sectionExpanded }}
                                    accessibilityLabel={`${group.section.label}, ${sectionExpanded ? "contraer" : "expandir"} sección`}
                                  >
                                    <Text style={styles.checklistSectionTitle}>{group.section.label}</Text>
                                    <Ionicons
                                      name={sectionExpanded ? "chevron-up" : "chevron-down"}
                                      size={20}
                                      color={theme.zinc600}
                                    />
                                  </Pressable>
                                  {sectionExpanded ? (
                                    <View style={styles.checklistSectionCardBody}>
                                      {group.items.map((item, itemIdx) =>
                                        renderChecklistItem(item, {
                                          insideSection: true,
                                          isLast: itemIdx === group.items.length - 1,
                                        })
                                      )}
                                    </View>
                                  ) : null}
                                </View>
                              );
                            }
                            return (
                              <View
                                key={`loose-${groupIdx}`}
                                style={[
                                  styles.checklistLooseGroup,
                                  groupIdx > 0 ? styles.checklistSectionCardGap : null,
                                ]}
                              >
                                {group.items.map((item, itemIdx) =>
                                  renderChecklistItem(item, {
                                    insideSection: false,
                                    loose: true,
                                    isLast: itemIdx === group.items.length - 1,
                                  })
                                )}
                              </View>
                            );
                          })}
                          </View>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.detailCard}>
                      <View style={styles.detailCardHeader}>
                        <Text style={styles.detailCardHeaderTitle}>Comentarios y evidencias</Text>
                        <Text style={styles.detailCardHeaderSub}>
                          Comenta y adjunta archivos o imágenes.
                        </Text>
                      </View>
                      <View style={styles.detailCardBody}>
                        <View style={styles.commentComposerCard}>
                          <TextInput
                            value={detailCommentDraft}
                            onChangeText={setDetailCommentDraft}
                            placeholder="Escribe un comentario..."
                            placeholderTextColor={theme.zinc400}
                            multiline
                            style={styles.commentComposerInput}
                          />
                          {detailCommentFiles.length > 0 ? (
                            <Text style={styles.commentAttachmentCount}>
                              {detailCommentFiles.length} archivo(s) seleccionado(s)
                            </Text>
                          ) : null}
                          <View style={styles.commentComposerActions}>
                            <Pressable
                              style={styles.commentAttachBtn}
                              onPress={openCommentAttachmentPicker}
                              accessibilityRole="button"
                            >
                              <Ionicons name="attach-outline" size={16} color={theme.zinc700} />
                              <Text style={styles.commentAttachBtnText}>Adjuntar</Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.commentSendBtn,
                                (detailCommentSaving ||
                                  (detailCommentDraft.trim().length === 0 &&
                                    detailCommentFiles.length === 0)) &&
                                  styles.commentSendBtnDisabled,
                              ]}
                              disabled={
                                detailCommentSaving ||
                                (detailCommentDraft.trim().length === 0 &&
                                  detailCommentFiles.length === 0)
                              }
                              onPress={() => void submitDetailComment()}
                              accessibilityRole="button"
                            >
                              <Text style={styles.commentSendBtnText}>
                                {detailCommentSaving ? "Enviando..." : "Comentar"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        {detailCommentsError ? (
                          <Text style={styles.detailErrorText}>{detailCommentsError}</Text>
                        ) : null}
                        {detailCommentsLoading ? (
                          <Text style={styles.detailRowMuted}>Cargando comentarios...</Text>
                        ) : detailComments.length === 0 ? (
                          <Text style={styles.detailRowMuted}>Aún no hay comentarios.</Text>
                        ) : (
                          <View style={styles.commentList}>
                            {detailComments.map((comment) => {
                              const parsed = parseCommentBodyWithAttachments(comment.body);
                              return (
                                <View key={comment.id} style={styles.commentItem}>
                                  <View style={styles.commentHeader}>
                                    <Text style={styles.commentAuthor}>
                                      {comment.user?.name ?? "Usuario"}
                                    </Text>
                                    <Text style={styles.commentDate}>
                                      {formatWoDetailDate(comment.createdAt)}
                                    </Text>
                                  </View>
                                  {parsed.text ? (
                                    <Text style={styles.commentBody}>{parsed.text}</Text>
                                  ) : null}
                                  {parsed.attachments.length > 0 ? (
                                    <View style={styles.attachmentGrid}>
                                      {parsed.attachments.map((a, idx) => (
                                        <Pressable
                                          key={`${comment.id}-${a.fileUrl}-${idx}`}
                                          style={styles.attachmentCell}
                                          onPress={() => void openAttachmentUrl(a.fileUrl, a.filename)}
                                        >
                                          {looksLikePdf(a.filename, a.fileUrl) ? (
                                            <View
                                              style={[styles.attachmentThumb, styles.attachmentPdfThumb]}
                                            >
                                              <Ionicons
                                                name="document-text"
                                                size={32}
                                                color={theme.primary}
                                              />
                                            </View>
                                          ) : (
                                            <View
                                              style={[styles.attachmentThumb, styles.attachmentPdfThumb]}
                                            >
                                              <Ionicons
                                                name={
                                                  looksLikeImageFilename(a.filename) &&
                                                  !isLikelyInternalDownloadUrl(a.fileUrl)
                                                    ? "image-outline"
                                                    : "document-attach"
                                                }
                                                size={32}
                                                color={theme.primary}
                                              />
                                            </View>
                                          )}
                                          <Text style={styles.attachmentCaption} numberOfLines={1}>
                                            {a.filename}
                                          </Text>
                                        </Pressable>
                                      ))}
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    </View>
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
                  visible={machinePickerVisible}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setMachinePickerVisible(false)}
                >
                  <View style={styles.checklistDropdownModalRoot}>
                    <Pressable
                      style={styles.checklistDropdownBackdrop}
                      onPress={() => setMachinePickerVisible(false)}
                    />
                    <View
                      style={[
                        styles.checklistDropdownSheet,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                      ]}
                    >
                      <Text style={styles.checklistDropdownSheetTitle}>Máquina</Text>
                      <ScrollView
                        style={styles.checklistDropdownScroll}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                      >
                        <Pressable
                          style={styles.checklistDropdownOption}
                          onPress={() => void patchWorkOrderAsset(null)}
                        >
                          <Text style={styles.checklistDropdownOptionTextMuted}>Sin máquina</Text>
                        </Pressable>
                        {machines.map((m) => {
                          const selected = selectedWorkOrder?.asset?.id === m.id;
                          return (
                            <Pressable
                              key={m.id}
                              style={[
                                styles.checklistDropdownOption,
                                selected && styles.checklistDropdownOptionSelected,
                              ]}
                              onPress={() => void patchWorkOrderAsset(m.id)}
                            >
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                  style={[
                                    styles.checklistDropdownOptionText,
                                    selected && styles.checklistDropdownOptionTextSelected,
                                  ]}
                                  numberOfLines={2}
                                >
                                  {m.name}
                                </Text>
                                <Text style={styles.detailRowSub}>{m.assetId}</Text>
                              </View>
                              {selected ? (
                                <Ionicons name="checkmark" size={20} color={theme.primary} />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                      <Pressable
                        style={styles.checklistDropdownCloseBtn}
                        onPress={() => setMachinePickerVisible(false)}
                      >
                        <Text style={styles.checklistDropdownCloseBtnText}>Cerrar</Text>
                      </Pressable>
                    </View>
                  </View>
                </Modal>

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
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.assigneeFilterScroll}
                  contentContainerStyle={styles.assigneeFilterSlider}
                  keyboardShouldPersistTaps="handled"
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
                {ordersError ? <Text style={styles.errorText}>{ordersError}</Text> : null}
                {ordersLoading && !workOrdersRefreshing ? (
                  <SectionLoadingState label="Cargando tareas..." />
                ) : (
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
                  {activeTasksSorted.length === 0 ? (
                    <Text style={styles.dashboardEmpty}>
                      No hay tareas pendientes ni en progreso.
                    </Text>
                  ) : (
                    activeTasksSorted.map((item) => (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.surfaceCard,
                          styles.activeRowCard,
                          { borderLeftColor: activeTaskRowBorderColor(item.status) },
                        ]}
                        onPress={() => openWorkOrder(item.id)}
                      >
                        <View style={styles.activeRowInner}>
                          <View style={styles.activeRowTextCol}>
                            <View style={styles.activeRowTitleRow}>
                              <Text style={styles.activeRowTitle} numberOfLines={1}>
                                {item.title}
                              </Text>
                              <WorkOrderStatusBadge status={item.status} />
                            </View>
                            <Text style={styles.activeRowMeta} numberOfLines={1}>
                              {activeTaskListMeta(item)}
                            </Text>
                          </View>
                          <View style={styles.taskCardAvatarPriorityRow}>
                            <TaskCardAssigneesRow item={item} />
                            <WorkOrderPriorityIconRN priority={item.priority} />
                          </View>
                        </View>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
                )}
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
              {kbError ? <Text style={styles.errorText}>{kbError}</Text> : null}
              {kbLoading && !knowledgeRefreshing ? (
                <SectionLoadingState label="Cargando biblioteca..." />
              ) : (
              <FlatList
                data={filteredKnowledge}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                refreshing={knowledgeRefreshing}
                onRefresh={() => {
                  void refreshKnowledgeFeed();
                }}
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
              )}
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
              {notificationsError ? <Text style={styles.errorText}>{notificationsError}</Text> : null}
              {notificationsLoading && !notificationsRefreshing ? (
                <SectionLoadingState label="Cargando notificaciones..." />
              ) : (
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
                    {item.body ? (
                      <Text style={styles.cardMeta}>
                        {parseChecklistRevisionNotificationBody(item.body)?.cleanBody ?? item.body}
                      </Text>
                    ) : null}
                    <Text style={styles.helpText}>
                      {new Date(item.createdAt).toLocaleString("es-MX", {
                        timeZone: APP_TIME_ZONE,
                      })}
                    </Text>
                  </Pressable>
                )}
              />
              )}
            </View>
          ) : profileLoading && !me ? (
            <SectionLoadingState label="Cargando perfil..." />
          ) : (
            <ScrollView
              contentContainerStyle={styles.profileContainer}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Text style={[styles.sectionTitle, { paddingTop: 8, paddingBottom: 8 }]}>
                Perfil del técnico
              </Text>
              {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
              <View style={[styles.surfaceCard, styles.sectionBlock, styles.sectionFirst]}>
                <Text style={styles.cardMeta}>Nombre: {me?.name ?? "—"}</Text>
                <Text style={styles.cardMeta}>Usuario: {me?.username ?? username}</Text>
                <Text style={styles.cardMeta}>Email: {me?.email ?? "Sin email"}</Text>
                <Text style={styles.cardMeta}>Rol: {me?.role ?? "tecnico"}</Text>
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
              source={
                isLikelyInternalDownloadUrl(inlinePdfWebViewUri(inlinePdf.uri)) && sessionCookieHeader
                  ? {
                      uri: inlinePdfWebViewUri(inlinePdf.uri),
                      headers: { Cookie: sessionCookieHeader },
                    }
                  : { uri: inlinePdfWebViewUri(inlinePdf.uri) }
              }
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
  loginHydrationState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loginHydrationText: { color: theme.zinc600, fontSize: 14, fontWeight: "500" },
  sectionLoadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 48,
  },
  sectionLoadingText: { color: theme.zinc600, fontSize: 14, fontWeight: "500" },
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
  headerProfileAvatarImage: { width: 26, height: 26, borderRadius: 13 },
  headerProfileAvatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerProfileAvatarFallbackText: { fontSize: 10, fontWeight: "800", color: theme.white },
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
  taskSlideDockPauseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.zinc300,
    backgroundColor: theme.white,
  },
  taskSlideDockPauseBtnText: { fontSize: 15, fontWeight: "700", color: theme.zinc700 },
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
  detailPageTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  detailPageTitleFlex: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  detailPagePauseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.zinc300,
    backgroundColor: theme.white,
    flexShrink: 0,
    marginTop: 2,
  },
  detailPagePauseBtnText: { fontSize: 14, fontWeight: "700", color: theme.zinc700 },
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
  machinePickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 40,
    paddingVertical: 4,
  },
  downtimeSwitchRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  downtimeSwitchLabel: { flex: 1, fontSize: 14, color: theme.zinc800, lineHeight: 20, paddingRight: 4 },
  downtimePreviewLine: { marginTop: 10, fontSize: 12, color: theme.zinc600, lineHeight: 18 },
  downtimeCompletedHint: { marginTop: 8, fontSize: 12, color: theme.zinc500, lineHeight: 18 },
  downtimeManualBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.zinc100,
  },
  downtimeManualTitle: { fontSize: 12, fontWeight: "600", color: theme.zinc700 },
  downtimeManualSub: { marginTop: 4, fontSize: 11, lineHeight: 16, color: theme.zinc500 },
  downtimeManualInputs: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  downtimeManualField: {
    minWidth: 88,
    flexGrow: 1,
    flexBasis: 100,
    borderWidth: 1,
    borderColor: theme.zinc300,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.zinc900,
    backgroundColor: theme.white,
  },
  downtimeUnitRow: { flexDirection: "row", gap: 6 },
  downtimeUnitChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  downtimeUnitChipOn: { borderColor: theme.accent, backgroundColor: "#FFF5F0" },
  downtimeUnitChipOff: { borderColor: theme.zinc300, backgroundColor: theme.white },
  downtimeUnitChipPressed: { opacity: 0.85 },
  downtimeUnitChipTextOn: { fontSize: 13, fontWeight: "600", color: theme.accent },
  downtimeUnitChipTextOff: { fontSize: 13, fontWeight: "500", color: theme.zinc700 },
  downtimeSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: theme.zinc900,
  },
  downtimeSaveBtnPressed: { opacity: 0.88 },
  downtimeSaveBtnDisabled: { opacity: 0.45 },
  downtimeSaveBtnText: { fontSize: 12, fontWeight: "600", color: theme.white },
  downtimeSavedLine: { marginTop: 10, fontSize: 11, color: theme.zinc500 },
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
  detailErrorText: {
    fontSize: 12,
    color: theme.red600,
    marginTop: 8,
  },
  commentComposerCard: {
    borderWidth: 1,
    borderColor: theme.zinc200,
    borderRadius: 10,
    backgroundColor: theme.zinc50,
    padding: 10,
    gap: 8,
  },
  commentComposerInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: theme.zinc300,
    borderRadius: 8,
    backgroundColor: theme.white,
    color: theme.zinc900,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  commentAttachmentCount: {
    fontSize: 12,
    color: theme.zinc500,
  },
  commentComposerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  commentAttachBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: theme.zinc300,
    borderRadius: 8,
    backgroundColor: theme.white,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  commentAttachBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.zinc700,
  },
  commentSendBtn: {
    borderRadius: 8,
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  commentSendBtnDisabled: {
    opacity: 0.6,
  },
  commentSendBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.white,
  },
  commentList: {
    gap: 8,
    marginTop: 10,
  },
  commentItem: {
    borderWidth: 1,
    borderColor: theme.zinc200,
    borderRadius: 10,
    backgroundColor: theme.white,
    padding: 10,
    gap: 6,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.zinc900,
    flexShrink: 1,
  },
  commentDate: {
    fontSize: 11,
    color: theme.zinc500,
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.zinc800,
  },
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
    backgroundColor: theme.primary50,
    borderWidth: 1,
    borderColor: theme.primary100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dashboardActiveBadgeText: { fontSize: 11, fontWeight: "800", color: theme.primary },
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
  completedRowCardTinted: {
    borderLeftWidth: 4,
    borderLeftColor: "#22C55E",
  },
  completedRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  completedRowTextCol: { flex: 1, minWidth: 0 },
  completedRowTitle: { fontSize: 14, fontWeight: "600", color: theme.zinc800 },
  completedRowMeta: { fontSize: 12, color: theme.zinc500, marginTop: 4 },
  activeRowCard: {
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  activeRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeRowTextCol: { flex: 1, minWidth: 0 },
  activeRowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeRowTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: theme.zinc800 },
  activeRowMeta: { fontSize: 12, color: theme.zinc500, marginTop: 4 },
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
  checklistSectionCard: {
    marginTop: 4,
    backgroundColor: theme.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.zinc300,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  checklistSectionCardGap: {
    marginTop: 16,
  },
  checklistSectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: theme.zinc100,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.zinc200,
  },
  checklistSectionCardBody: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: theme.white,
  },
  checklistGroupsStack: {
    gap: 16,
  },
  checklistLooseGroup: {
    backgroundColor: theme.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.zinc300,
    overflow: "hidden",
  },
  checklistLooseRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.zinc100,
    backgroundColor: theme.white,
  },
  checklistLooseRowLast: {
    borderBottomWidth: 0,
  },
  checklistSectionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.zinc100,
    backgroundColor: theme.white,
  },
  checklistSectionRowLast: {
    borderBottomWidth: 0,
  },
  checklistSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.zinc900,
    letterSpacing: 0.15,
  },
  checklistGroupHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.zinc900,
    marginTop: 4,
    marginBottom: 2,
  },
  checklistTextBlockTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.zinc900,
  },
  checklistTextBlockSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.zinc800,
  },
  checklistTextBlockBody: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.zinc700,
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
  checklistStepBoxOptionalUnset: {
    borderStyle: "dashed",
    borderColor: theme.zinc300,
  },
  checklistFieldOptionalHint: {
    fontSize: 11,
    color: theme.zinc400,
    fontWeight: "400",
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
  checklistCheckboxCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.zinc200,
    backgroundColor: theme.white,
  },
  checklistCheckboxText: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.zinc700 },
  checklistCheckboxTextDone: { color: theme.zinc500, textDecorationLine: "line-through" },
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
  checklistPhotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  checklistPhotoTile: {
    position: "relative",
  },
  checklistPhotoPreview: {
    width: 92,
    height: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.zinc200,
    backgroundColor: theme.zinc100,
  },
  checklistPhotoRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24,24,27,0.8)",
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
  assigneeFilterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: -16,
  },
  assigneeFilterSlider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexGrow: 0,
  },
  ongoingTasksNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.primary100,
    backgroundColor: theme.primary50,
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
    borderColor: theme.zinc300,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
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
