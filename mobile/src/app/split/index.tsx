import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Empty, ErrorText, Loading } from '@/components/ui';
import { Pastel, pastelAt, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { dayLabel } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { useMembers } from '@/lib/members';
import {
  balances,
  createSettlement,
  deleteExpenseById,
  loadSplit,
  rupees,
  suggestTransfers,
  type Expense,
  type Transfer,
} from '@/lib/plan';
import { useQuery } from '@/lib/use-query';

export default function SplitScreen() {
  const group = useActiveGroup();
  const members = useMembers(group.id);
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery(() => loadSplit(group.id), [group.id]);

  const name = (id: string) => (id === me ? 'You' : (members.find((m) => m.id === id)?.name ?? 'Someone'));

  if (!query.data && query.loading) return <Loading />;
  const { expenses, shares, settlements } = query.data ?? { expenses: [], shares: [], settlements: [] };
  const transfers = suggestTransfers(balances(expenses, shares, settlements));

  async function settle(t: Transfer) {
    setBusy(true);
    setError(null);
    try {
      await createSettlement(group.id, me, { from_user: t.from, to_user: t.to, amount_minor: t.amount });
      query.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmSettle(t: Transfer) {
    Alert.alert(`Mark ${rupees(t.amount)} as paid?`, `This records that you paid ${name(t.to)}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, I paid', onPress: () => settle(t) },
    ]);
  }

  function confirmDelete(e: Expense) {
    Alert.alert(`Delete "${e.title}"?`, 'Balances will be recalculated without it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpenseById(e.id);
            query.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
  }

  return (
    <FlatList
      data={expenses}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={query.loading && !!query.data} onRefresh={query.reload} />}
      ListHeaderComponent={
        <View style={{ gap: Spacing.three }}>
          <Button title="Add an expense" icon="plus" onPress={() => router.push('/split/new')} />

          <Card color={transfers.length ? Pastel.salmon : Pastel.mint}>
            <ThemedText type="smallBold" themeColor="textSoft">
              Balances
            </ThemedText>
            {transfers.length === 0 ? (
              <ThemedText type="subtitle">{expenses.length ? 'All settled up' : 'Nothing to split yet'}</ThemedText>
            ) : (
              transfers.map((t) => (
                <View key={`${t.from}-${t.to}`} style={styles.transfer}>
                  <ThemedText style={{ flex: 1, fontWeight: '600' }}>
                    {name(t.from)} {t.from === me ? 'owe' : 'owes'} {name(t.to)} {rupees(t.amount)}
                  </ThemedText>
                  {t.from === me && <Button title="I paid" variant="white" small onPress={() => confirmSettle(t)} loading={busy} />}
                </View>
              ))
            )}
          </Card>

          <ErrorText>{error ?? query.error}</ErrorText>
          {expenses.length > 0 && (
            <ThemedText type="smallBold" themeColor="textMuted">
              Expenses
            </ThemedText>
          )}
        </View>
      }
      ListEmptyComponent={
        <Empty
          color={Pastel.yellow}
          title="No expenses yet"
          body="Add what you paid for dinner or a trip, choose who shares it, and Pix works out who owes whom."
        />
      }
      renderItem={({ item, index }) => {
        const payer = members.find((m) => m.id === item.paid_by);
        const mine = shares.find((s) => s.expense_id === item.id && s.user_id === me)?.share_minor;
        return (
          <Card color={pastelAt(index + 2)} onLongPress={item.created_by === me ? () => confirmDelete(item) : undefined}>
            <View style={styles.expenseTop}>
              {payer && <Avatar member={payer} size={30} />}
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: '700' }} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSoft">
                  {name(item.paid_by)} paid · {dayLabel(item.spent_on)}
                </ThemedText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <ThemedText style={{ fontWeight: '800', fontSize: 18 }}>{rupees(item.amount_minor)}</ThemedText>
                {mine != null && (
                  <ThemedText type="small" themeColor="textSoft">
                    your share {rupees(mine)}
                  </ThemedText>
                )}
              </View>
            </View>
          </Card>
        );
      }}
      ListFooterComponent={
        expenses.length > 0 ? (
          <ThemedText type="small" themeColor="textMuted" style={{ textAlign: 'center' }}>
            Press and hold an expense you added to delete it.
          </ThemedText>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.four, gap: Spacing.three - 4, paddingBottom: Spacing.six },
  transfer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  expenseTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
});
