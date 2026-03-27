import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
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

type AppSection = "workOrders" | "knowledgeBase" | "notifications" | "profile";
type WoStatus = "open" | "in_progress" | "completed" | "cancelled";
type WoPriority = "low" | "medium" | "high" | "urgent";

type WorkOrderListItem = {
  id: string;
  folio?: string | null;
  title: string;
  status: WoStatus;
  priority: WoPriority;
  dueDate: string | null;
  assetName: string | null;
  assetAssetId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
};

type ChecklistItem = {
  id: string;
  type: "step" | "field";
  label: string;
  completed: boolean | null;
  value: unknown;
  fieldType: string | null;
};

type WorkOrderDetail = {
  id: string;
  folio?: string | null;
  title: string;
  description: string | null;
  status: WoStatus;
  priority: WoPriority;
  dueDate: string | null;
  asset: { id: string; name: string; assetId: string } | null;
  checklist: ChecklistItem[];
  notes: { id: string; body: string; createdAt: string }[];
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

function absoluteFileUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_HOST}${path}`;
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
  const [completedVisibleCount, setCompletedVisibleCount] = useState(10);

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

  async function loadWorkOrders() {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const query = selectedAssigneeId
        ? `?assigneeId=${encodeURIComponent(selectedAssigneeId)}`
        : "";
      const data = await apiFetch<WorkOrderListItem[]>(`/api/work-orders${query}`);
      setWorkOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "No se pudo cargar ordenes.");
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

  async function openKnowledgeFile(file: KnowledgeItem) {
    const url = absoluteFileUrl(file.fileUrl);
    await Linking.openURL(url);
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
      await Linking.openURL(result.uri);
    } catch (error) {
      setKbError(error instanceof Error ? error.message : "No se pudo descargar el archivo.");
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

  async function updateStatus(status: WoStatus) {
    if (!selectedWorkOrder) return;
    try {
      await apiFetch<{ ok: true }>(`/api/work-orders/${selectedWorkOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await Promise.all([loadWorkOrders(), openWorkOrder(selectedWorkOrder.id)]);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No se pudo actualizar estado.");
    }
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
      setSelectedWorkOrderId(null);
      setSelectedWorkOrder(null);
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

  function priorityChipStyle(priority: WoPriority) {
    if (priority === "high") return styles.priorityChipHigh;
    if (priority === "urgent") return styles.priorityChipUrgent;
    if (priority === "low") return styles.priorityChipLow;
    return styles.priorityChipMedium;
  }

  function priorityChipTextStyle(priority: WoPriority) {
    if (priority === "high") return styles.priorityChipTextHigh;
    if (priority === "urgent") return styles.priorityChipTextUrgent;
    if (priority === "low") return styles.priorityChipTextLow;
    return styles.priorityChipTextMedium;
  }

  function statusChipStyle(status: WoStatus) {
    if (status === "open") return styles.statusOpen;
    if (status === "in_progress") return styles.statusInProgress;
    if (status === "completed") return styles.statusCompleted;
    return styles.statusCancelled;
  }

  const boardColumns: { key: WoStatus; title: string }[] = [
    { key: "open", title: "Abiertas" },
    { key: "in_progress", title: "En progreso" },
    { key: "completed", title: "Terminadas" },
  ];

  useEffect(() => {
    if (!isLoggedIn) return;
    loadWorkOrders();
  }, [isLoggedIn, selectedAssigneeId]);

  useEffect(() => {
    setCompletedVisibleCount(10);
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
              <Text style={styles.loginTitle}>Iniciar sesion</Text>

              <View style={styles.loginFieldBlock}>
                <Text style={styles.loginLabel}>Usuario</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder=""
                  placeholderTextColor="#A7AEC6"
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
                  placeholderTextColor="#A7AEC6"
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
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{firstName}</Text>
          <Pressable
            style={styles.headerAlertButton}
            onPress={() => setActiveSection("notifications")}
          >
            <Ionicons name="notifications-outline" size={20} color="#C2CEEC" />
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
                <View style={styles.header}>
                  <Pressable
                    style={styles.backIconButton}
                    onPress={() => {
                      setSelectedWorkOrderId(null);
                      setSelectedWorkOrder(null);
                      setDetailError(null);
                    }}
                  >
                    <Ionicons name="arrow-back" size={20} color="#FFBF8A" />
                  </Pressable>
                  <Text style={styles.cardTitle}>{selectedWorkOrder?.folio ?? selectedWorkOrder?.id ?? "Orden"}</Text>
                </View>
                {detailLoading ? (
                  <Text style={styles.cardMeta}>Cargando detalle...</Text>
                ) : detailError ? (
                  <Text style={styles.errorText}>{detailError}</Text>
                ) : selectedWorkOrder ? (
                  <>
                    <Text style={styles.detailTitle}>{selectedWorkOrder.title}</Text>
                    {selectedWorkOrder.description ? (
                      <Text style={styles.cardMeta}>{selectedWorkOrder.description}</Text>
                    ) : null}
                    <View style={styles.chipsRow}>
                      <View style={[styles.statusChip, statusChipStyle(selectedWorkOrder.status)]}>
                        <Text style={styles.statusChipText}>{statusLabel(selectedWorkOrder.status)}</Text>
                      </View>
                      <View style={[styles.priorityChip, priorityChipStyle(selectedWorkOrder.priority)]}>
                        <Text style={[styles.priorityChipText, priorityChipTextStyle(selectedWorkOrder.priority)]}>
                          Prioridad: {priorityLabel(selectedWorkOrder.priority)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardMeta}>
                      Activo:{" "}
                      {selectedWorkOrder.asset
                        ? `${selectedWorkOrder.asset.name} (${selectedWorkOrder.asset.assetId})`
                        : "Sin activo"}
                    </Text>
                    <Text style={styles.cardMeta}>Vence: {selectedWorkOrder.dueDate ?? "—"}</Text>

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

                    {selectedWorkOrder.checklist.length > 0 ? (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Checklist</Text>
                        {selectedWorkOrder.status === "open" ? (
                          <Text style={styles.helpText}>Haz clic en Iniciar para editar checklist.</Text>
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
                              <Pressable
                                style={styles.ghostButton}
                                disabled={selectedWorkOrder.status !== "in_progress"}
                                onPress={() => updateChecklist(item.id, { completed: !(item.completed ?? false) })}
                              >
                                <Text style={styles.ghostButtonText}>
                                  {item.completed ? "Marcar pendiente" : "Marcar completado"}
                                </Text>
                              </Pressable>
                            ) : (
                              <TextInput
                                value={item.value != null ? String(item.value) : ""}
                                editable={selectedWorkOrder.status === "in_progress"}
                                placeholder="Escribir valor"
                                placeholderTextColor="#A7AEC6"
                                style={styles.input}
                                onEndEditing={(e) =>
                                  updateChecklist(item.id, { value: e.nativeEvent.text ?? "" })
                                }
                              />
                            )}
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Comentarios</Text>
                      <Text style={styles.helpText}>Usa @usuario para etiquetar personas.</Text>
                      <TextInput
                        value={newComment}
                        onChangeText={setNewComment}
                        placeholder="Escribe un comentario"
                        placeholderTextColor="#A7AEC6"
                        multiline
                        style={styles.textarea}
                      />
                      <Pressable style={styles.secondaryButton} onPress={addComment}>
                        <Text style={styles.secondaryButtonText}>Agregar comentario</Text>
                      </Pressable>
                      {selectedWorkOrder.notes.map((note) => (
                        <View key={note.id} style={styles.card}>
                          <Text style={styles.cardMeta}>{note.body}</Text>
                          <Text style={styles.helpText}>{note.createdAt}</Text>
                        </View>
                      ))}
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
                {ordersLoading ? <Text style={styles.cardMeta}>Cargando ordenes...</Text> : null}
                {ordersError ? <Text style={styles.errorText}>{ordersError}</Text> : null}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.canvasContent}
                >
                  {boardColumns.map((column) => {
                    const columnItems = workOrders.filter((item) => item.status === column.key);
                    const visibleItems =
                      column.key === "completed"
                        ? columnItems.slice(0, completedVisibleCount)
                        : columnItems;
                    return (
                      <View key={column.key} style={styles.canvasColumn}>
                        <View style={styles.canvasColumnHeader}>
                          <Text style={styles.canvasColumnTitle}>{column.title}</Text>
                          <Text style={styles.canvasColumnCount}>{columnItems.length}</Text>
                        </View>
                        <ScrollView
                          nestedScrollEnabled
                          style={styles.canvasColumnList}
                          contentContainerStyle={styles.canvasColumnListContent}
                          showsVerticalScrollIndicator={false}
                          showsHorizontalScrollIndicator={false}
                        >
                          {visibleItems.map((item) => (
                            <Pressable key={item.id} style={styles.card} onPress={() => openWorkOrder(item.id)}>
                              <Text style={styles.cardTitle}>{item.folio ?? item.id}</Text>
                              <Text style={styles.cardMeta}>{item.title}</Text>
                              <Text style={styles.cardMeta}>
                                {item.assetName
                                  ? `${item.assetName}${item.assetAssetId ? ` (${item.assetAssetId})` : ""}`
                                  : "Sin activo"}
                              </Text>
                              <View style={styles.chipsRow}>
                                <View style={[styles.statusChip, statusChipStyle(item.status)]}>
                                  <Text style={styles.statusChipText}>{statusLabel(item.status)}</Text>
                                </View>
                                <View style={[styles.priorityChip, priorityChipStyle(item.priority)]}>
                                  <Text style={[styles.priorityChipText, priorityChipTextStyle(item.priority)]}>
                                    {priorityLabel(item.priority)}
                                  </Text>
                                </View>
                              </View>
                            </Pressable>
                          ))}
                          {column.key === "completed" && columnItems.length > completedVisibleCount ? (
                            <Pressable
                              style={styles.loadMoreButton}
                              onPress={() =>
                                setCompletedVisibleCount((count) =>
                                  Math.min(count + 10, columnItems.length)
                                )
                              }
                            >
                              <Text style={styles.loadMoreButtonText}>Cargar mas</Text>
                            </Pressable>
                          ) : null}
                        </ScrollView>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )
          ) : activeSection === "knowledgeBase" ? (
            <View style={styles.kbContainer}>
              <TextInput
                value={kbQuery}
                onChangeText={setKbQuery}
                placeholder="Buscar articulo..."
                placeholderTextColor="#A7AEC6"
                style={styles.input}
              />
              {kbLoading ? <Text style={styles.cardMeta}>Cargando base de conocimiento...</Text> : null}
              {kbError ? <Text style={styles.errorText}>{kbError}</Text> : null}
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
              <View style={styles.header}>
                <Text style={styles.sectionTitle}>Notificaciones</Text>
                <Pressable style={styles.ghostButton} onPress={markAllNotificationsRead}>
                  <Text style={styles.ghostButtonText}>Marcar todo leido</Text>
                </Pressable>
              </View>
              {notificationsLoading ? <Text style={styles.cardMeta}>Cargando notificaciones...</Text> : null}
              {notificationsError ? <Text style={styles.errorText}>{notificationsError}</Text> : null}
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
              <Text style={styles.sectionTitle}>Perfil del Operador</Text>
              {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
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
                  placeholderTextColor="#A7AEC6"
                  secureTextEntry
                  style={styles.input}
                />
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Nueva contrasena"
                  placeholderTextColor="#A7AEC6"
                  secureTextEntry
                  style={styles.input}
                />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirmar nueva contrasena"
                  placeholderTextColor="#A7AEC6"
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
            style={[styles.bottomNavItem, activeSection === "workOrders" && styles.bottomNavItemActive]}
            onPress={() => setActiveSection("workOrders")}
          >
            <Ionicons
              name="clipboard-outline"
              size={16}
              color={activeSection === "workOrders" ? "#FFFFFF" : "#C2CEEC"}
            />
            <Text style={[styles.bottomNavText, activeSection === "workOrders" && styles.bottomNavTextActive]}>
              Ordenes
            </Text>
          </Pressable>
          <Pressable
            style={[styles.bottomNavItem, activeSection === "knowledgeBase" && styles.bottomNavItemActive]}
            onPress={() => setActiveSection("knowledgeBase")}
          >
            <Ionicons
              name="library-outline"
              size={16}
              color={activeSection === "knowledgeBase" ? "#FFFFFF" : "#C2CEEC"}
            />
            <Text style={[styles.bottomNavText, activeSection === "knowledgeBase" && styles.bottomNavTextActive]}>
              Base
            </Text>
          </Pressable>
          <Pressable
            style={[styles.bottomNavItem, activeSection === "profile" && styles.bottomNavItemActive]}
            onPress={() => setActiveSection("profile")}
          >
            <Ionicons
              name="person-outline"
              size={16}
              color={activeSection === "profile" ? "#FFFFFF" : "#C2CEEC"}
            />
            <Text style={[styles.bottomNavText, activeSection === "profile" && styles.bottomNavTextActive]}>
              Perfil
            </Text>
          </Pressable>
        </View>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#121826" },
  container: { flex: 1, padding: 14 },
  loginContainer: {
    justifyContent: "center",
    padding: 20,
    gap: 14,
    backgroundColor: "#232B3F",
  },
  loginTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  loginFieldBlock: { gap: 8 },
  loginLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  loginInput: {
    backgroundColor: "#07152A",
    borderWidth: 1,
    borderColor: "#2A3E5A",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 15,
  },
  loginButton: {
    backgroundColor: "#A93A12",
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  loginKeyboardAvoid: { flex: 1, backgroundColor: "#232B3F" },
  loginScroll: { backgroundColor: "#232B3F" },
  loginScrollContent: { flexGrow: 1, justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerAlertButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A3E5A",
    backgroundColor: "#31394B",
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
    backgroundColor: "#F36C21",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerAlertBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  backIconButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2A3E5A",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#31394B",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  subtitle: { fontSize: 14, color: "#A7AEC6", marginBottom: 8 },
  logout: { color: "#FFBF8A", fontWeight: "600" },
  input: {
    backgroundColor: "#0F1E33",
    borderWidth: 1,
    borderColor: "#2A3E5A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: "#F36C21",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D95A16",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonDisabled: { backgroundColor: "#8B532F" },
  primaryButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  errorText: { color: "#FF9B9B", fontSize: 13 },
  contentArea: { flex: 1 },
  profileContainer: { gap: 10, paddingBottom: 26 },
  kbContainer: { flex: 1, gap: 10 },
  detailContent: { gap: 12, paddingBottom: 30 },
  detailTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText: { fontWeight: "700", fontSize: 12 },
  statusOpen: { backgroundColor: "#FEF1E9" },
  statusInProgress: { backgroundColor: "#DDE5F7" },
  statusCompleted: { backgroundColor: "#D7F3D7" },
  statusCancelled: { backgroundColor: "#E6E6E6" },
  priorityChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#31394B",
  },
  priorityChipText: { color: "#C2CEEC", fontSize: 12, fontWeight: "700" },
  priorityChipLow: { backgroundColor: "#31394B" },
  priorityChipMedium: { backgroundColor: "#31394B" },
  priorityChipHigh: { backgroundColor: "#4A3417" },
  priorityChipUrgent: { backgroundColor: "#4A1D22" },
  priorityChipTextLow: { color: "#A7AEC6" },
  priorityChipTextMedium: { color: "#C2CEEC" },
  priorityChipTextHigh: { color: "#F7C57A" },
  priorityChipTextUrgent: { color: "#FF9B9B" },
  section: {
    gap: 8,
    marginTop: 8,
    backgroundColor: "#232B3F",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A3E5A",
    padding: 14,
  },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  helpText: { color: "#A7AEC6", fontSize: 12 },
  actionsRow: { flexDirection: "row", gap: 8, marginVertical: 8 },
  secondaryButton: {
    backgroundColor: "#1F3C88",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#557DDA",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  ghostButton: {
    borderWidth: 1,
    borderColor: "#557DDA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  ghostButtonText: { color: "#C2CEEC", fontWeight: "600" },
  logoutButton: {
    backgroundColor: "#F36C21",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D95A16",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  logoutButtonText: { color: "#FFFFFF", fontWeight: "700" },
  checklistCard: {
    backgroundColor: "#25324C",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2A3E5A",
    gap: 8,
  },
  checklistHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkBullet: { width: 12, height: 12, borderRadius: 999 },
  checkBulletDone: { backgroundColor: "#6FAF6F" },
  checkBulletTodo: { backgroundColor: "#FFBF8A" },
  textarea: {
    minHeight: 90,
    textAlignVertical: "top",
    backgroundColor: "#31394B",
    borderWidth: 1,
    borderColor: "#2A3E5A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
  },
  canvasShell: {
    flex: 1,
    backgroundColor: "#232B3F",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A3E5A",
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#31394B",
    borderWidth: 1,
    borderColor: "#557DDA",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterTagText: { color: "#FFFFFF", fontWeight: "600", fontSize: 12 },
  filterTagRemove: { color: "#FFBF8A", fontWeight: "700", fontSize: 12 },
  filterUsersScroll: { flexGrow: 0, maxHeight: 44 },
  filterUsersRow: { gap: 8, alignItems: "center", paddingRight: 8 },
  userFilterChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#31394B",
    backgroundColor: "#25324C",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "center",
  },
  userFilterChipActive: {
    backgroundColor: "#F36C21",
    borderColor: "#F36C21",
  },
  userFilterChipText: { color: "#C2CEEC", fontSize: 12, fontWeight: "600" },
  userFilterChipTextActive: { color: "#FFFFFF" },
  canvasContent: {
    gap: 12,
    paddingRight: 12,
    flexGrow: 1,
    alignItems: "stretch",
  },
  canvasColumn: {
    width: 290,
    backgroundColor: "#25324C",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A3E5A",
    padding: 10,
    gap: 10,
    alignSelf: "stretch",
  },
  canvasColumnList: {
    flex: 1,
  },
  canvasColumnListContent: {
    gap: 10,
    paddingBottom: 6,
  },
  canvasColumnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  canvasColumnTitle: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  canvasColumnCount: {
    color: "#C2CEEC",
    backgroundColor: "#31394B",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  bottomNav: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#25324C",
    paddingTop: 6,
    paddingHorizontal: 14,
    marginHorizontal: -14,
    marginBottom: -14,
    backgroundColor: "#232B3F",
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A3E5A",
    gap: 4,
    paddingVertical: 6,
    backgroundColor: "#31394B",
  },
  bottomNavItemActive: {
    backgroundColor: "#F36C21",
  },
  bottomNavText: {
    color: "#C2CEEC",
    fontWeight: "700",
    fontSize: 12,
  },
  bottomNavTextActive: {
    color: "#FFFFFF",
  },
  listContent: { gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: "#0F1E33",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2A3E5A",
    gap: 4,
    shadowColor: "#102137",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  notificationUnreadCard: {
    borderColor: "#557DDA",
    backgroundColor: "#102137",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },
  cardMeta: { color: "#A7AEC6", fontSize: 13 },
  emptyText: { color: "#A7AEC6", textAlign: "center", marginTop: 12 },
  loadMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#557DDA",
    backgroundColor: "#25324C",
    paddingVertical: 10,
  },
  loadMoreButtonText: {
    color: "#C2CEEC",
    fontWeight: "700",
    fontSize: 12,
  },
});
