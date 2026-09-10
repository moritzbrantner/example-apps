import AsyncStorage from '@react-native-async-storage/async-storage';

import { deserializeGiftState, GiftState, serializeGiftState } from './gifts';

export const GIFTS_STORAGE_KEY = '@expo-template/gifts/state-v1';

export async function loadGiftState(): Promise<GiftState> {
  return deserializeGiftState(await AsyncStorage.getItem(GIFTS_STORAGE_KEY));
}

export async function saveGiftState(state: GiftState): Promise<void> {
  await AsyncStorage.setItem(GIFTS_STORAGE_KEY, serializeGiftState(state));
}
