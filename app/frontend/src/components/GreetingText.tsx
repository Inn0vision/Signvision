import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface GreetingTextProps {
  text?: string;
}

const GreetingText: React.FC<GreetingTextProps> = ({ text = 'Hello, how are you?' }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  text: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Itim',
    textAlign: 'center',
  },
});

export default GreetingText;
