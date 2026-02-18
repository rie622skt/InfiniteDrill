import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

const FRAMES = [
  require("../../untitled_0003.png"),
  require("../../untitled_0004.png"),
];

const FRAME_INTERVAL_MS = 200;

export function DragonMascot() {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % FRAMES.length);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.container}>
      <Image source={FRAMES[frameIndex]} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  image: {
    width: 96,
    height: 96,
  },
});
