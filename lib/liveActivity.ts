import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type ReadingLiveActivityModule = {
  startActivity(bookTitle: string, author: string, coverUrl: string, startPage: number): Promise<string | null>;
  updateActivity(elapsedSeconds: number, currentPage: number, isPaused: boolean): Promise<void>;
  endActivity(): Promise<void>;
};

const ReadingLiveActivity =
  requireOptionalNativeModule<ReadingLiveActivityModule>('ReadingLiveActivity');

export async function startReadingActivity(
  bookTitle: string,
  author: string,
  coverUrl: string,
  startPage: number
): Promise<void> {
  if (Platform.OS !== 'ios' || !ReadingLiveActivity) return;
  try {
    await ReadingLiveActivity.startActivity(bookTitle, author, coverUrl, startPage);
  } catch (e) {
    console.error('[LiveActivity] startActivity error:', e);
  }
}

export async function updateReadingActivity(
  elapsedSeconds: number,
  currentPage: number,
  isPaused: boolean
): Promise<void> {
  if (Platform.OS !== 'ios' || !ReadingLiveActivity) return;
  try {
    await ReadingLiveActivity.updateActivity(elapsedSeconds, currentPage, isPaused);
  } catch (e) {
    console.error('[LiveActivity] updateActivity error:', e);
  }
}

export async function endReadingActivity(): Promise<void> {
  if (Platform.OS !== 'ios' || !ReadingLiveActivity) return;
  try {
    await ReadingLiveActivity.endActivity();
  } catch (e) {
    console.error('[LiveActivity] endActivity error:', e);
  }
}
