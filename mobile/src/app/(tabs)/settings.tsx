import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ErrorText, Input, Loading, Segmented, TabHeader, useTabBarSpace } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useActiveGroup, useGroups } from '@/lib/groups';
import { describeArea, findAreas, setLocationPref, useLocation } from '@/lib/location';
import { supabase } from '@/lib/supabase';

const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 25];

type Area = { label: string; lat: number; lng: number };

export default function SettingsScreen() {
  const group = useActiveGroup();
  const { refresh: refreshGroups } = useGroups();
  const { session } = useAuth();
  const { coords, error: locationError, refresh: refreshLocation, pref } = useLocation();
  const bottomSpace = useTabBarSpace();

  // Which option is showing; picking "area" only commits once an area is chosen.
  const [mode, setMode] = useState<'device' | 'custom' | null>(null);
  const shownMode = mode ?? pref?.mode ?? 'device';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Area[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deviceCoords = pref?.mode === 'device' ? coords : null;
  useEffect(() => {
    if (!deviceCoords) return;
    let cancelled = false;
    describeArea(deviceCoords).then((label) => !cancelled && setDeviceLabel(label));
    return () => {
      cancelled = true;
    };
  }, [deviceCoords]);

  async function chooseMode(next: 'device' | 'custom') {
    setMode(next);
    setError(null);
    if (next === 'device') await setLocationPref({ mode: 'device' });
  }

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const found = await findAreas(query.trim());
      setResults(found);
      if (found.length === 0) setError('No matching area. Try adding the city, e.g. "Bandra, Mumbai".');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  async function pick(area: Area) {
    await setLocationPref({ mode: 'custom', ...area });
    setResults(null);
    setQuery('');
  }

  async function setRadius(km: number) {
    const { error } = await supabase.from('groups').update({ search_radius_m: km * 1000 }).eq('id', group.id);
    if (error) setError(error.message);
    else refreshGroups();
  }

  if (!pref) return <Loading />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} keyboardShouldPersistTaps="handled">
        <TabHeader title="Settings" subtitle="Where Pix looks for places" />
        <View style={styles.body}>
          {/* Location */}
          <Card style={{ gap: Spacing.three }}>
            <ThemedText type="label" themeColor="textSecondary">
              Search from
            </ThemedText>
            <Segmented
              value={shownMode}
              onChange={chooseMode}
              options={[
                { value: 'device', label: 'My location' },
                { value: 'custom', label: 'Pick an area' },
              ]}
            />

            {shownMode === 'device' ? (
              <View style={[styles.current, { backgroundColor: Palette.mint }]}>
                <Icon name="pin" size={22} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="label">Right now</ThemedText>
                  <ThemedText style={styles.currentLabel} numberOfLines={2}>
                    {locationError ? 'Location unavailable' : deviceLabel ?? 'Finding you…'}
                  </ThemedText>
                </View>
                {locationError && <Button title="Retry" small variant="white" onPress={refreshLocation} />}
              </View>
            ) : (
              <>
                {pref.mode === 'custom' && (
                  <View style={[styles.current, { backgroundColor: Palette.sky }]}>
                    <Icon name="pin" size={22} />
                    <View style={{ flex: 1 }}>
                      <ThemedText type="label">Searching around</ThemedText>
                      <ThemedText style={styles.currentLabel} numberOfLines={2}>
                        {pref.label}
                      </ThemedText>
                    </View>
                  </View>
                )}
                <View style={styles.searchRow}>
                  <View style={{ flex: 1 }}>
                    <Input
                      placeholder={pref.mode === 'custom' ? 'Change area…' : 'e.g. Bandra, Mumbai'}
                      value={query}
                      onChangeText={setQuery}
                      onSubmitEditing={search}
                      returnKeyType="search"
                      autoCorrect={false}
                    />
                  </View>
                  <Button title="Find" small onPress={search} loading={searching} disabled={!query.trim()} style={{ minHeight: 54 }} />
                </View>
                {results?.map((r) => (
                  <Pressable
                    key={`${r.lat},${r.lng}`}
                    onPress={() => pick(r)}
                    style={({ pressed }) => [styles.result, pressed && { opacity: 0.7 }]}>
                    <ThemedText style={{ flex: 1, fontWeight: '600' }}>{r.label}</ThemedText>
                    <Chip label="Use this" color={Palette.track} />
                  </Pressable>
                ))}
              </>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              This is saved on this phone only. Everyone in the group can pick their own.
            </ThemedText>
          </Card>

          {/* Radius */}
          <Card style={{ gap: Spacing.three }}>
            <ThemedText type="label" themeColor="textSecondary">
              Search radius
            </ThemedText>
            <View style={styles.radiusRow}>
              <ThemedText style={styles.radiusValue}>{group.search_radius_m / 1000}</ThemedText>
              <ThemedText style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>km</ThemedText>
            </View>
            <View style={styles.chips}>
              {RADIUS_OPTIONS_KM.map((km) => (
                <Chip
                  key={km}
                  label={`${km} km`}
                  color={Palette.track}
                  selected={group.search_radius_m === km * 1000}
                  onPress={() => setRadius(km)}
                />
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Search and Discover look within this distance. Shared by everyone in {group.name}.
            </ThemedText>
          </Card>

          <ErrorText>{error}</ErrorText>

          {/* Account */}
          <Card style={{ gap: Spacing.two }}>
            <ThemedText type="label" themeColor="textSecondary">
              Account
            </ThemedText>
            <ThemedText style={{ fontWeight: '600' }}>{session?.user.email}</ThemedText>
            <Button title="Sign out" variant="secondary" small onPress={() => supabase.auth.signOut()} style={{ alignSelf: 'flex-start' }} />
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.canvas },
  body: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.field,
    padding: Spacing.three,
  },
  currentLabel: { fontSize: 18, lineHeight: 23, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
  },
  radiusRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  radiusValue: { fontSize: 64, lineHeight: 68, fontWeight: '800', letterSpacing: -2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
