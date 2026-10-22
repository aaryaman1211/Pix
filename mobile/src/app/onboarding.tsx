import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateOrJoin } from '@/components/create-or-join';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function OnboardingScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.title}>Who are you going with?</ThemedText>
          <ThemedText themeColor="textSecondary">
            A group shares one list of places, one memory folder and one set of important dates. It can be
            just the two of you, or a whole crew. You can be in more than one.
          </ThemedText>
          <CreateOrJoin />
          <Button title="Sign out" variant="secondary" small onPress={() => supabase.auth.signOut()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.four },
  title: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
});
