import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateOrJoin } from '@/components/create-or-join';
import { FloatingBlobs } from '@/components/floating';
import { HeroBlob } from '@/components/hero-blob';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { signOut } from '@/lib/push';
import { supabase } from '@/lib/supabase';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FloatingBlobs strength={0.8} />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <HeroBlob height={180} />
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="title">Who are you going with?</ThemedText>
          <ThemedText themeColor="textSoft">
            A group shares one list of places, one memory folder and one set of important dates. Just the two of
            you, or the whole crew. You can be in more than one.
          </ThemedText>
        </View>
        <CreateOrJoin />
        <Button title="Sign out" variant="secondary" small onPress={signOut} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.four, gap: Spacing.four },
});
