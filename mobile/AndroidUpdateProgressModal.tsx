import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  formatDownloadBytes,
  formatDownloadPercent,
} from "./lib/update-download";

export type AndroidUpdateUiPhase = "downloading" | "installing" | "error";

export type AndroidUpdateUiState = {
  visible: boolean;
  phase: AndroidUpdateUiPhase;
  versionName: string;
  progress: number;
  bytesWritten: number;
  bytesTotal: number;
  error: string | null;
};

type Props = {
  state: AndroidUpdateUiState;
  onClose: () => void;
  onRetryInstall: () => void;
  onOpenInstallSettings: () => void;
};

const theme = {
  primary: "#02257D",
  accent: "#F14C03",
  white: "#FFFFFF",
  zinc100: "#F4F4F5",
  zinc300: "#D4D4D8",
  zinc500: "#71717A",
  zinc700: "#3F3F46",
  zinc900: "#18181B",
  red600: "#DC2626",
};

export function AndroidUpdateProgressModal({
  state,
  onClose,
  onRetryInstall,
  onOpenInstallSettings,
}: Props) {
  const canDismiss = state.phase === "error";
  const percent = formatDownloadPercent(state.progress);
  const sizeLabel =
    state.bytesTotal > 0
      ? `${formatDownloadBytes(state.bytesWritten)} / ${formatDownloadBytes(state.bytesTotal)}`
      : state.bytesWritten > 0
        ? formatDownloadBytes(state.bytesWritten)
        : null;

  let title = "Descargando actualizacion";
  let subtitle = `Version ${state.versionName}`;
  if (state.phase === "installing") {
    title = "Preparando instalacion";
    subtitle = "Abriendo el instalador del sistema...";
  } else if (state.phase === "error") {
    title = "No se pudo actualizar";
    subtitle = state.error ?? "Ocurrio un error.";
  }

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (canDismiss) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {state.phase === "downloading" ? (
            <>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%` }]} />
              </View>
              <Text style={styles.percent}>{percent}</Text>
              {sizeLabel ? <Text style={styles.size}>{sizeLabel}</Text> : null}
            </>
          ) : null}

          {state.phase === "installing" ? (
            <ActivityIndicator color={theme.primary} style={styles.spinner} />
          ) : null}

          {state.phase === "error" ? (
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={onOpenInstallSettings}>
                <Text style={styles.secondaryButtonText}>Permitir instalaciones</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={onRetryInstall}>
                <Text style={styles.primaryButtonText}>Reintentar instalacion</Text>
              </Pressable>
              <Pressable style={styles.textButton} onPress={onClose}>
                <Text style={styles.textButtonLabel}>Cerrar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: theme.white,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 10,
  },
  title: {
    color: theme.zinc900,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: theme.zinc700,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.zinc100,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.zinc300,
  },
  fill: {
    height: "100%",
    backgroundColor: theme.primary,
    borderRadius: 999,
  },
  percent: {
    color: theme.primary,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  size: {
    color: theme.zinc500,
    fontSize: 13,
    textAlign: "center",
  },
  spinner: {
    marginVertical: 12,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.white,
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.zinc300,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: theme.zinc900,
    fontSize: 15,
    fontWeight: "600",
  },
  textButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  textButtonLabel: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: "600",
  },
});
