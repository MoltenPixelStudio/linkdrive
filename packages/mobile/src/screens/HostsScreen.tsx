import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Server } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useHosts } from '../context/HostsContext';
import { SPACING, RADIUS, FONT } from '@linkdrive/shared/theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Hosts'>;

export function HostsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { hosts } = useHosts();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bgBody }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.brandRow}>
          <View style={[styles.brandDot, { backgroundColor: colors.accentBrand }]} />
          <Text style={[styles.title, { color: colors.text }]}>LinkDrive</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('AddHost')}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: colors.accentBrand,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Plus size={14} color="#fff" />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      {hosts.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { borderColor: colors.borderSubtle }]}>
            <Server size={22} color={colors.textDim} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No hosts yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Add your VPS or a LAN peer to start exploring.
          </Text>
        </View>
      ) : (
        <FlatList
          data={hosts}
          keyExtractor={(h) => h.id}
          contentContainerStyle={{ padding: SPACING.lg }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('Explorer', { hostId: item.id, path: item.defaultPath })
              }
              style={({ pressed }) => [
                styles.hostCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.hostRow}>
                <View style={[styles.dot, { backgroundColor: item.color || colors.accentBrand }]} />
                <Text style={[styles.hostName, { color: colors.text }]}>{item.name}</Text>
              </View>
              <Text style={[styles.hostAddr, { color: colors.textMuted }]}>
                {item.user}@{item.host}:{item.port}
              </Text>
              <Text style={[styles.hostMeta, { color: colors.textDim }]}>
                {item.protocol.toUpperCase()} · {item.transport.mode}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 52,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  brandDot: { width: 16, height: 16, borderRadius: RADIUS.sm },
  title: { fontWeight: FONT.semibold, fontSize: 16 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  addText: { color: '#fff', fontWeight: FONT.semibold, fontSize: 12 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: { fontSize: 16, fontWeight: FONT.semibold, marginBottom: 4 },
  emptyBody: { fontSize: 13, textAlign: 'center', maxWidth: 260 },
  hostCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hostName: { fontSize: 15, fontWeight: FONT.semibold },
  hostAddr: { fontSize: 12, fontFamily: 'Courier', marginBottom: 6 },
  hostMeta: { fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
});
