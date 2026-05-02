import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

const NativeLiveActivity = requireOptionalNativeModule('ReadingLiveActivity');

export async function startReadingActivity(
  bookTitle: string,
  author: string,
  startPage: number
): Promise<void> {
  if (Platform.OS !== 'ios' || !NativeLiveActivity) return;
  try {
    await NativeLiveActivity.startActivity(bookTitle, author, startPage);
  } catch {}
}

export async function updateReadingActivity(
  elapsedSeconds: number,
  currentPage: number,
  isPaused: boolean
): Promise<void> {
  if (Platform.OS !== 'ios' || !NativeLiveActivity) return;
  try {
    await NativeLiveActivity.updateActivity(elapsedSeconds, currentPage, isPaused);
  } catch {}
}

export async function endReadingActivity(): Promise<void> {
  if (Platform.OS !== 'ios' || !NativeLiveActivity) return;
  try {
    await NativeLiveActivity.endActivity();
  } catch {}
}
