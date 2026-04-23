import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useHosts } from '../context/HostsContext';
import { SPACING, RADIUS, FONT } from '@linkdrive/shared/theme';
import type { RootStackParamList } from '../../App';
import type { Host } from '@linkdrive/shared/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddHost'>;

export function AddHostScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { add } = useHosts();

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [user, setUser] = useState('');

  const canSave = name.trim() && host.trim() && user.trim() && port.trim();

  const save = () => {
    if (!canSave) return;
    const h: Host = {
      id: `${Date.now()}`,
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port, 10) || 22,
      user: user.trim(),
      protocol: 'sftp',
      auth: { type: 'key', useAgent: false },
      transport: { mode: 'direct' },
      createdAt: Date.now(),
    };
    add(h);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bgBody }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Add host</Text>
      </View>

      <View style={{ padding: SPACING.lg, gap: SPACING.md }}>
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="My VPS"
          colors={colors}
        />
        <Field
          label="Host"
          value={host}
          onChange={setHost}
          placeholder="example.com or 203.0.113.5"
          autoCapitalize="none"
          colors={colors}
        />
        <Field
          label="Port"
          value={port}
          onChange={setPort}
          keyboardType="number-pad"
          colors={colors}
        />
        <Field
          label="User"
          value={user}
          onChange={setUser}
          placeholder="root"
          autoCapitalize="none"
          colors={colors}
        />

        <Pressable
          disabled={!canSave}
          onPress={save}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: colors.accentBrand,
              opacity: !canSave ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.saveText}>Save host</Text>
        </Pressable>
        <Text style={[styles.note, { color: colors.textDim }]}>
          Auth, key pinning, and transport options land in Phase 3.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  colors,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.textDim}
        style={[
          styles.input,
          {
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        {...rest}
      />
    </View>
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
  title: { fontSize: 15, fontWeight: FONT.semibold, marginLeft: 4 },
  label: { fontSize: 11, fontWeight: FONT.semibold, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    marginTop: SPACING.sm,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: FONT.semibold, fontSize: 14 },
  note: { fontSize: 11, textAlign: 'center' },
});
