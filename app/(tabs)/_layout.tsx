import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#f0c040',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} /> }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: 'Library', tabBarIcon: ({ color }) => <TabIcon emoji="📚" color={color} /> }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: ({ color }) => <TabIcon emoji="🔍" color={color} /> }}
      />
      <Tabs.Screen
        name="social"
        options={{ title: 'Social', tabBarIcon: ({ color }) => <TabIcon emoji="👥" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0f0f0f',
    borderTopColor: '#1a1a1a',
    borderTopWidth: 1,
    paddingBottom: 4,
  },
  tabLabel: { fontSize: 10 },
});
