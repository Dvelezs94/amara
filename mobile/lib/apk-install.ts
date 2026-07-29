import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

const APK_MIME = "application/vnd.android.package-archive";
/** FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK */
const INSTALL_FLAGS = 1 | 268435456;

/**
 * Opens the system APK installer for a local file:// APK.
 * Linking.openURL(file://...) fails on modern Android — needs a content:// URI.
 */
export async function installLocalApk(fileUri: string): Promise<void> {
  if (Platform.OS !== "android") {
    throw new Error("La instalacion de APK solo esta disponible en Android.");
  }
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    type: APK_MIME,
    flags: INSTALL_FLAGS,
  });
}

/** Opens Android settings so the user can allow installing unknown apps for this package. */
export async function openUnknownSourcesSettings(packageName: string): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.MANAGE_UNKNOWN_APP_SOURCES",
      {
        data: `package:${packageName}`,
      }
    );
  } catch {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      {
        data: `package:${packageName}`,
      }
    );
  }
}
