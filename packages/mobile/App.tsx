import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';
import { HostsProvider } from './src/context/HostsContext';
import { ExplorerScreen } from './src/screens/ExplorerScreen';
import { HostsScreen } from './src/screens/HostsScreen';
import { AddHostScreen } from './src/screens/AddHostScreen';

export type RootStackParamList = {
  Explorer: { hostId?: string; path?: string } | undefined;
  Hosts: undefined;
  AddHost: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <HostsProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <Stack.Navigator
                initialRouteName="Hosts"
                screenOptions={{ headerShown: false, animation: 'fade' }}
              >
                <Stack.Screen name="Hosts" component={HostsScreen} />
                <Stack.Screen name="Explorer" component={ExplorerScreen} />
                <Stack.Screen name="AddHost" component={AddHostScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </HostsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
