#!/bin/bash

echo "Checking connected adb devices..."
adb devices

echo "Setting up port reverse for backend (8001)..."
adb reverse tcp:8001 tcp:8001

echo "Starting React Native..."
npx react-native run-android
