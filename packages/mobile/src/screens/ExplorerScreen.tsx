import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS, FONT } from '@linkdrive/shared/theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Explorer'>;

export function ExplorerScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { hostId, path } = route.params ?? {};

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bgBody }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {path || '/'}
        </Text>
      </View>

      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Explorer stub</Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
          Host: <Text style={{ fontFamily: 'Courier' }}>{hostId ?? 'local'}</Text>
          {'\n'}Phase 2 wires up SFTP ls + entry list.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 52,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: { padding: SPACING.sm },
  title: { flex: 1, fontSize: 14, fontWeight: FONT.medium, marginLeft: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyTitle: { fontSize: 16, fontWeight: FONT.semibold, marginBottom: SPACING.sm },
  emptyBody: { fontSize: 13, textAlign: 'center' },
});
