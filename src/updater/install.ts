import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import type { UpdateInfo } from './github';

/**
 * Downloads the release APK and hands it to Android's package installer. The first time, Android asks to allow
 * JeepMonitor to "install unknown apps". The new APK must be signed with the same key as the installed app.
 */
export async function downloadAndInstall(update: UpdateInfo, onProgress: (fraction: number) => void): Promise<void> {
  const target = `${FileSystem.cacheDirectory}${update.apkName}`;
  await FileSystem.deleteAsync(target, { idempotent: true });
  const task = FileSystem.createDownloadResumable(update.apkUrl, target, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const result = await task.downloadAsync();
  if (!result || result.status !== 200) throw new Error(`Download failed (${result?.status ?? 'no response'})`);
  onProgress(1);
  const uri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: uri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
