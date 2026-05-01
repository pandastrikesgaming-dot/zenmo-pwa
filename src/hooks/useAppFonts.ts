import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';

import { typography } from '../theme';

export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({
    [typography.fontFamily.display]: ArchivoBlack_400Regular,
    [typography.fontFamily.bodyRegular]: SpaceGrotesk_400Regular,
    [typography.fontFamily.bodyMedium]: SpaceGrotesk_500Medium,
    [typography.fontFamily.bodyBold]: SpaceGrotesk_700Bold,
  });

  return {
    fontsLoaded,
    fontError,
  };
}
