import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingBlobs } from '@/components/floating';
import { HeroBlob } from '@/components/hero-blob';
import { PastelView } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Input, Segmented } from '@/components/ui';
import { Pastel, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        // With email confirmation on, there is no session until the link is clicked.
        if (!data.session) {
          setNotice('Check your email to confirm your account, then sign in.');
          setMode('sign-in');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.includes('@') && password.length >= 6 && (mode === 'sign-in' || name.trim());

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FloatingBlobs strength={0.8} />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <HeroBlob />
        <View style={{ gap: Spacing.two, marginBottom: Spacing.three }}>
          <ThemedText style={styles.logo}>Pix</ThemedText>
          <ThemedText themeColor="textSoft" style={styles.tagline}>Places you want to go, and the memories you make there.</ThemedText>
        </View>

        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'sign-in', label: 'Sign in' },
            { value: 'sign-up', label: 'Create account' },
          ]}
        />

        {mode === 'sign-up' && (
          <Input label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
        )}
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
          onSubmitEditing={() => canSubmit && submit()}
        />

        <ErrorText>{error}</ErrorText>
        {notice && (
          <PastelView color={Pastel.mint} style={styles.notice}>
            <ThemedText type="smallBold">{notice}</ThemedText>
          </PastelView>
        )}

        <Button
          title={mode === 'sign-in' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
          style={{ marginTop: Spacing.two }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  logo: { fontSize: 72, lineHeight: 76, fontWeight: '800', letterSpacing: -3 },
  tagline: { fontSize: 20, lineHeight: 26, fontWeight: '600', maxWidth: 300 },
  notice: { borderRadius: Radius.field, padding: Spacing.three },
});
