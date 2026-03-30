import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

interface CharacterAvatarProps {
  source?: any;
}

const CharacterAvatar: React.FC<CharacterAvatarProps> = ({ source }) => {
  return (
    <View style={styles.container}>
      {source ? (
        <Image 
          source={source} 
          style={styles.avatar}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.avatarPlaceholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 200,
    height: 280,
    borderRadius: 150,
  },
  avatarPlaceholder: {
    width: 200,
    height: 280,
    borderRadius: 150,
    backgroundColor: '#A7D9FE',
  },
});

export default CharacterAvatar;
