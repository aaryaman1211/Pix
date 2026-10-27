import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Card, ErrorText, Loading, Stars } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import type { PlaceDetails } from '@/lib/types';

// Address, hours, contact and Google reviews for an opened place.
export function PlaceDetailsSection({ details, error }: { details: PlaceDetails | null; error: string | null }) {
  const c = useColors();
  const [showHours, setShowHours] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  if (error) return <ErrorText>{`Couldn't load details. ${error}`}</ErrorText>;
  if (!details) return <Loading />;

  const today = details.hours?.[(new Date().getDay() + 6) % 7]; // Google lists Monday first
  const reviews = showAllReviews ? details.reviews : details.reviews.slice(0, 2);

  return (
    <View style={{ gap: Spacing.three }}>
      {details.summary && (
        <ThemedText themeColor="textSoft" style={{ fontSize: 17, lineHeight: 24 }}>
          {details.summary}
        </ThemedText>
      )}

      <Card style={{ gap: Spacing.three }}>
        {details.hours && (
          <Pressable onPress={() => setShowHours((v) => !v)} style={styles.row} accessibilityRole="button">
            <Icon name="calendar" size={18} />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText style={{ fontWeight: '700', color: details.openNow === false ? c.danger : c.text }}>
                {details.openNow === undefined ? 'Hours' : details.openNow ? 'Open now' : 'Closed now'}
              </ThemedText>
              {(showHours ? details.hours : today ? [today] : []).map((h) => (
                <ThemedText key={h} type="small" themeColor="textMuted">
                  {h}
                </ThemedText>
              ))}
            </View>
            <Icon name={showHours ? 'chevronDown' : 'chevronRight'} size={12} color={c.textMuted} />
          </Pressable>
        )}

        {details.address && (
          <Pressable
            onPress={() => details.mapsUrl && Linking.openURL(details.mapsUrl)}
            style={styles.row}
            accessibilityRole="link">
            <Icon name="pin" size={18} />
            <ThemedText type="small" style={{ flex: 1 }}>
              {details.address}
            </ThemedText>
          </Pressable>
        )}

        {details.phone && (
          <Pressable onPress={() => Linking.openURL(`tel:${details.phone!.replace(/\s/g, '')}`)} style={styles.row}>
            <Icon name="phone" size={18} />
            <ThemedText type="small" style={{ flex: 1 }}>
              {details.phone}
            </ThemedText>
          </Pressable>
        )}

        {details.website && (
          <Pressable onPress={() => Linking.openURL(details.website!)} style={styles.row}>
            <Icon name="globe" size={18} />
            <ThemedText type="small" numberOfLines={1} style={{ flex: 1 }}>
              {details.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </ThemedText>
          </Pressable>
        )}
      </Card>

      {details.reviews.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="label" themeColor="textSecondary">
            Reviews from Google
          </ThemedText>
          {reviews.map((r, i) => (
            <Card key={i} style={{ gap: Spacing.two }}>
              <View style={styles.reviewHead}>
                <ThemedText type="smallBold" style={{ flex: 1 }} numberOfLines={1}>
                  {r.author}
                </ThemedText>
                {r.when && (
                  <ThemedText type="small" themeColor="textMuted">
                    {r.when}
                  </ThemedText>
                )}
              </View>
              {r.rating ? <Stars value={r.rating} size={12} /> : null}
              <ThemedText type="small" themeColor="textSoft" numberOfLines={showAllReviews ? undefined : 5}>
                {r.text}
              </ThemedText>
            </Card>
          ))}
          {details.reviews.length > 2 && (
            <Pressable onPress={() => setShowAllReviews((v) => !v)} hitSlop={8}>
              <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
                {showAllReviews ? 'Show fewer reviews' : `Show all ${details.reviews.length} reviews`}
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
