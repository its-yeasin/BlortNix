import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GRID_SIZE = 5;
const STORAGE_KEY = "@blortnix_highscore";

// Game states
type GameState = "ready" | "playing" | "paused" | "gameover";

// Cell types
type CellType = "empty" | "target" | "bomb" | "bonus" | "shrinking";

interface Cell {
  type: CellType;
  id: number;
  scale: Animated.Value;
  shrinkTimer?: NodeJS.Timeout;
  lifetime: number; // ms before it disappears
  spawnTime: number;
}

type GridState = (Cell | null)[][];

// Theme colors
const getTheme = (isDark: boolean) => ({
  background: isDark ? "#0a0a0f" : "#f5f5f7",
  cardBackground: isDark ? "#1a1a2e" : "#ffffff",
  cardBorder: isDark ? "#2a2a4e" : "#e0e0e0",
  text: isDark ? "#ffffff" : "#000000",
  textSecondary: isDark ? "#b3afafff" : "#666666",
  textMuted: isDark ? "#b3afafff" : "#999999",
  accent: "#00ff88",
  accentDark: "#00cc6a",
  danger: "#ff4444",
  warning: "#ffaa00",
  gold: "#ffd700",
  bombRed: "#ff3333",
  pauseOverlay: isDark ? "rgba(0, 0, 0, 0.95)" : "rgba(255, 255, 255, 0.95)",
});

// Get responsive cell size based on screen dimensions
const getCellSize = () => {
  const { width, height } = Dimensions.get("window");
  const minDimension = Math.min(width, height);
  const availableSpace = minDimension * 0.85;
  const gapTotal = (GRID_SIZE - 1) * 8;
  return Math.floor((availableSpace - gapTotal) / GRID_SIZE);
};

const createEmptyGrid = (): GridState => {
  return Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(null));
};

// Custom Icon Components (SVG-like paths rendered as Views)
const PauseIcon = ({
  size = 24,
  color = "#fff",
}: {
  size?: number;
  color?: string;
}) => (
  <View
    style={{
      width: size,
      height: size,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: size * 0.2,
    }}
  >
    <View
      style={{
        width: size * 0.25,
        height: size * 0.7,
        backgroundColor: color,
        borderRadius: 2,
      }}
    />
    <View
      style={{
        width: size * 0.25,
        height: size * 0.7,
        backgroundColor: color,
        borderRadius: 2,
      }}
    />
  </View>
);

const PlayIcon = ({
  size = 24,
  color = "#fff",
}: {
  size?: number;
  color?: string;
}) => (
  <View
    style={{
      width: size,
      height: size,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.6,
        borderTopWidth: size * 0.4,
        borderBottomWidth: size * 0.4,
        borderLeftColor: color,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        marginLeft: size * 0.15,
      }}
    />
  </View>
);

const HomeIcon = ({
  size = 24,
  color = "#fff",
}: {
  size?: number;
  color?: string;
}) => (
  <View
    style={{
      width: size,
      height: size,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.45,
        borderRightWidth: size * 0.45,
        borderBottomWidth: size * 0.35,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: color,
      }}
    />
    <View
      style={{
        width: size * 0.7,
        height: size * 0.45,
        backgroundColor: color,
        marginTop: -2,
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 2,
      }}
    />
  </View>
);

const HeartIcon = ({
  size = 20,
  filled = true,
  color = "#ff4444",
}: {
  size?: number;
  filled?: boolean;
  color?: string;
}) => (
  <View
    style={{
      width: size,
      height: size,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <View
      style={{
        width: size * 0.8,
        height: size * 0.8,
        backgroundColor: filled ? color : "transparent",
        borderWidth: filled ? 0 : 2,
        borderColor: color,
        transform: [{ rotate: "-45deg" }],
        borderRadius: size * 0.15,
      }}
    >
      <View
        style={{
          position: "absolute",
          width: size * 0.8,
          height: size * 0.8,
          backgroundColor: filled ? color : "transparent",
          borderWidth: filled ? 0 : 2,
          borderColor: color,
          borderRadius: size * 0.4,
          top: -size * 0.4,
          left: 0,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size * 0.8,
          height: size * 0.8,
          backgroundColor: filled ? color : "transparent",
          borderWidth: filled ? 0 : 2,
          borderColor: color,
          borderRadius: size * 0.4,
          top: 0,
          left: size * 0.4,
        }}
      />
    </View>
  </View>
);

const StarIcon = ({
  size = 24,
  color = "#000",
}: {
  size?: number;
  color?: string;
}) => (
  <Text style={{ fontSize: size * 0.9, color, fontWeight: "bold" }}>★</Text>
);

const BombIcon = ({ size = 24 }: { size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <View
      style={{
        width: size * 0.7,
        height: size * 0.7,
        backgroundColor: "#1a1a1a",
        borderRadius: size * 0.35,
      }}
    />
    <View
      style={{
        position: "absolute",
        top: size * 0.05,
        width: size * 0.15,
        height: size * 0.25,
        backgroundColor: "#ff6600",
        borderRadius: size * 0.05,
      }}
    />
    <View
      style={{
        position: "absolute",
        top: size * 0.25,
        left: size * 0.25,
        width: size * 0.15,
        height: size * 0.15,
        backgroundColor: "rgba(255,255,255,0.4)",
        borderRadius: size * 0.1,
      }}
    />
  </View>
);

export default function BlortNixGame() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getTheme(isDark);
  const insets = useSafeAreaInsets();

  const [grid, setGrid] = useState<GridState>(createEmptyGrid);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<GameState>("ready");
  const [cellSize, setCellSize] = useState(getCellSize());
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showCombo, setShowCombo] = useState(false);

  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cellIdRef = useRef(0);
  const missedRef = useRef(0);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const pauseTimeRef = useRef(0); // Track total paused time

  // Handle screen rotation/resize
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", () => {
      setCellSize(getCellSize());
    });
    return () => subscription?.remove();
  }, []);

  // Load high score
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value !== null) {
        setHighScore(parseInt(value, 10));
      }
    });
  }, []);

  // Save high score
  const saveHighScore = useCallback(
    async (newScore: number) => {
      if (newScore > highScore) {
        setHighScore(newScore);
        await AsyncStorage.setItem(STORAGE_KEY, newScore.toString());
      }
    },
    [highScore]
  );

  // Get spawn rate based on level
  const getSpawnRate = useCallback(() => {
    return Math.max(400, 1200 - level * 80);
  }, [level]);

  // Get cell lifetime based on level
  const getCellLifetime = useCallback(() => {
    return Math.max(1200, 3000 - level * 150);
  }, [level]);

  // Spawn a new cell
  const spawnCell = useCallback(() => {
    if (gameState !== "playing") return;

    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => [...row]);

      // Find empty positions
      const emptyPositions: { row: number; col: number }[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!newGrid[r][c]) {
            emptyPositions.push({ row: r, col: c });
          }
        }
      }

      if (emptyPositions.length === 0) return prevGrid;

      // Pick random position
      const pos =
        emptyPositions[Math.floor(Math.random() * emptyPositions.length)];

      // Determine cell type (weighted random)
      const rand = Math.random();
      let type: CellType;
      if (rand < 0.08) {
        type = "bomb"; // 8% bomb
      } else if (rand < 0.18) {
        type = "bonus"; // 10% bonus (golden)
      } else {
        type = "target"; // 82% normal target
      }

      const lifetime =
        type === "bonus" ? getCellLifetime() * 0.6 : getCellLifetime();

      const newCell: Cell = {
        type,
        id: cellIdRef.current++,
        scale: new Animated.Value(0),
        lifetime,
        spawnTime: Date.now(),
      };

      // Animate spawn
      Animated.spring(newCell.scale, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start();

      newGrid[pos.row][pos.col] = newCell;
      return newGrid;
    });
  }, [gameState, getCellLifetime]);

  // Check for expired cells
  useEffect(() => {
    if (gameState !== "playing") return;

    const checkInterval = setInterval(() => {
      const now = Date.now() - pauseTimeRef.current;

      setGrid((prevGrid) => {
        let changed = false;
        let missed = 0;
        const newGrid = prevGrid.map((row) =>
          row.map((cell) => {
            if (cell && now - cell.spawnTime > cell.lifetime) {
              changed = true;
              if (cell.type === "target" || cell.type === "bonus") {
                missed++;
              }
              return null;
            }
            return cell;
          })
        );

        if (missed > 0) {
          missedRef.current += missed;
          setLives((prev) => {
            const newLives = prev - missed;
            if (newLives <= 0) {
              setGameState("gameover");
              saveHighScore(score);
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error
                );
              }
            }
            return Math.max(0, newLives);
          });
          setCombo(0);
        }

        return changed ? newGrid : prevGrid;
      });
    }, 100);

    return () => clearInterval(checkInterval);
  }, [gameState, saveHighScore, score]);

  // Spawn loop
  useEffect(() => {
    if (gameState === "playing") {
      const spawn = () => {
        spawnCell();
        spawnIntervalRef.current = setTimeout(spawn, getSpawnRate());
      };
      spawn();
    }

    return () => {
      if (spawnIntervalRef.current) {
        clearTimeout(spawnIntervalRef.current);
      }
    };
  }, [gameState, spawnCell, getSpawnRate]);

  // Level up based on score
  useEffect(() => {
    const newLevel = Math.floor(score / 500) + 1;
    if (newLevel > level && newLevel <= 15) {
      setLevel(newLevel);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [score, level]);

  // Start game
  const startGame = useCallback(() => {
    setGrid(createEmptyGrid());
    setScore(0);
    setCombo(0);
    setLives(3);
    setLevel(1);
    setGameState("playing");
    missedRef.current = 0;
    cellIdRef.current = 0;
    pauseTimeRef.current = 0;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  // Pause game
  const pauseGame = useCallback(() => {
    if (gameState === "playing") {
      setGameState("paused");
      pauseTimeRef.current = Date.now();
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [gameState]);

  // Resume game
  const resumeGame = useCallback(() => {
    if (gameState === "paused") {
      // Adjust spawn times for all cells to account for pause duration
      const pauseDuration = Date.now() - pauseTimeRef.current;
      setGrid((prevGrid) => {
        return prevGrid.map((row) =>
          row.map((cell) => {
            if (cell) {
              return { ...cell, spawnTime: cell.spawnTime + pauseDuration };
            }
            return cell;
          })
        );
      });
      setGameState("playing");
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [gameState]);

  // Go to home/menu
  const goToHome = useCallback(() => {
    if (spawnIntervalRef.current) {
      clearTimeout(spawnIntervalRef.current);
    }
    setGrid(createEmptyGrid());
    setGameState("ready");
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  // Handle cell tap
  const handleCellTap = useCallback(
    (row: number, col: number) => {
      if (gameState !== "playing") return;

      const cell = grid[row][col];
      if (!cell) return;

      const now = Date.now();
      const quickTap = now - lastTapTime < 300;
      setLastTapTime(now);

      if (cell.type === "bomb") {
        // Hit a bomb - lose a life and reset combo
        setLives((prev) => {
          const newLives = prev - 1;
          if (newLives <= 0) {
            setGameState("gameover");
            saveHighScore(score);
          }
          return Math.max(0, newLives);
        });
        setCombo(0);

        // Flash red
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: false,
          }),
          Animated.timing(flashAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start();

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        // Hit target or bonus
        const basePoints = cell.type === "bonus" ? 50 : 10;
        const timeBonus = Math.floor(
          ((cell.lifetime - (now - cell.spawnTime)) / cell.lifetime) * 10
        );
        const comboMultiplier = Math.min(combo + 1, 10);
        const quickBonus = quickTap ? 5 : 0;

        const points = (basePoints + timeBonus + quickBonus) * comboMultiplier;

        setScore((prev) => prev + points);
        setCombo((prev) => {
          const newCombo = prev + 1;
          if (newCombo >= 5) {
            setShowCombo(true);
            setTimeout(() => setShowCombo(false), 500);
          }
          return newCombo;
        });

        if (Platform.OS !== "web") {
          Haptics.impactAsync(
            cell.type === "bonus"
              ? Haptics.ImpactFeedbackStyle.Heavy
              : Haptics.ImpactFeedbackStyle.Light
          );
        }
      }

      // Remove cell with animation
      Animated.timing(cell.scale, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();

      setGrid((prevGrid) => {
        const newGrid = prevGrid.map((r) => [...r]);
        newGrid[row][col] = null;
        return newGrid;
      });
    },
    [gameState, grid, lastTapTime, combo, flashAnim, saveHighScore, score]
  );

  const gridContainerSize = cellSize * GRID_SIZE + 8 * (GRID_SIZE - 1);

  const flashColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", "rgba(255, 0, 0, 0.3)"],
  });

  // Calculate remaining time percentage for cell color
  const getCellStyle = (cell: Cell) => {
    const elapsed = Date.now() - cell.spawnTime;
    const remaining = Math.max(0, 1 - elapsed / cell.lifetime);

    if (cell.type === "bomb") {
      return { backgroundColor: "#ff3333", borderColor: "#ff0000" };
    }
    if (cell.type === "bonus") {
      return { backgroundColor: "#ffd700", borderColor: "#ffaa00" };
    }
    // Normal target - gets more red as time runs out
    const green = Math.floor(255 * remaining);
    return {
      backgroundColor: `rgb(255, ${green}, ${Math.floor(green * 0.5)})`,
      borderColor: isDark ? "#fff" : "#333",
    };
  };

  // Render lives with heart icons
  const renderLives = () => {
    const hearts = [];
    for (let i = 0; i < 3; i++) {
      hearts.push(
        <HeartIcon
          key={i}
          size={18}
          filled={i < lives}
          color={i < lives ? "#ff4444" : isDark ? "#333" : "#ddd"}
        />
      );
    }
    return hearts;
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top + 10 },
      ]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Flash overlay */}
      <Animated.View
        style={[styles.flashOverlay, { backgroundColor: flashColor }]}
      />

      {/* Header */}
      <View style={styles.header}>
        {/* Score Card */}
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            SCORE
          </Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {score.toLocaleString()}
          </Text>
          <Text style={[styles.statSubtext, { color: theme.textMuted }]}>
            Best: {highScore.toLocaleString()}
          </Text>
        </View>

        {/* Level & Combo Card */}
        <View
          style={[
            styles.statCard,
            styles.centerCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Text style={[styles.levelBadge, { color: theme.accent }]}>
            LEVEL {level}
          </Text>
          {combo >= 3 && (
            <Text
              style={[
                styles.comboText,
                { color: theme.warning },
                showCombo && styles.comboTextBig,
              ]}
            >
              {combo}x COMBO!
            </Text>
          )}
        </View>

        {/* Lives & Pause Card */}
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            LIVES
          </Text>
          <View style={styles.livesRow}>{renderLives()}</View>
          {gameState === "playing" && (
            <Pressable
              style={[
                styles.pauseButtonCompact,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.08)",
                },
              ]}
              onPress={pauseGame}
            >
              <PauseIcon size={14} color={theme.textSecondary} />
              <Text
                style={[
                  styles.pauseButtonLabel,
                  { color: theme.textSecondary },
                ]}
              >
                PAUSE
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Game Area */}
      <View style={styles.gameArea}>
        {gameState === "ready" && (
          <View style={styles.startScreen}>
            <View style={styles.startHeader}>
              <Text style={[styles.titleText, { color: theme.text }]}>
                BLORTNIX
              </Text>
              <Text
                style={[styles.subtitleText, { color: theme.textSecondary }]}
              >
                Tap the targets before they vanish!
              </Text>
            </View>

            <View
              style={[
                styles.legendCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.legendTitle, { color: theme.text }]}>
                HOW TO PLAY
              </Text>
              <View style={styles.legendGrid}>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendIcon,
                      { backgroundColor: isDark ? "#fff" : "#333" },
                    ]}
                  />
                  <View style={styles.legendTextContainer}>
                    <Text style={[styles.legendLabel, { color: theme.text }]}>
                      Target
                    </Text>
                    <Text
                      style={[
                        styles.legendDesc,
                        { color: theme.textSecondary },
                      ]}
                    >
                      +10 points
                    </Text>
                  </View>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendIcon, { backgroundColor: "#ffd700" }]}
                  >
                    <StarIcon size={18} color="#000" />
                  </View>
                  <View style={styles.legendTextContainer}>
                    <Text style={[styles.legendLabel, { color: theme.text }]}>
                      Bonus
                    </Text>
                    <Text
                      style={[
                        styles.legendDesc,
                        { color: theme.textSecondary },
                      ]}
                    >
                      +50 points
                    </Text>
                  </View>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendIcon, { backgroundColor: "#ff3333" }]}
                  >
                    <BombIcon size={20} />
                  </View>
                  <View style={styles.legendTextContainer}>
                    <Text style={[styles.legendLabel, { color: theme.text }]}>
                      Bomb
                    </Text>
                    <Text style={[styles.legendDesc, { color: theme.danger }]}>
                      Lose a life!
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Pressable
              style={[styles.playButton, { backgroundColor: theme.accent }]}
              onPress={startGame}
            >
              <PlayIcon size={24} color="#000" />
              <Text style={styles.playButtonText}>START GAME</Text>
            </Pressable>
          </View>
        )}

        {gameState === "gameover" && (
          <View
            style={[
              styles.gameOverContainer,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.gameOverText, { color: theme.danger }]}>
              GAME OVER
            </Text>

            <View style={styles.scoreDisplay}>
              <Text style={[styles.finalScoreText, { color: theme.text }]}>
                {score.toLocaleString()}
              </Text>
              <Text
                style={[styles.finalScoreLabel, { color: theme.textSecondary }]}
              >
                POINTS
              </Text>
            </View>

            {score >= highScore && score > 0 && (
              <View
                style={[
                  styles.achievementBadge,
                  {
                    backgroundColor: isDark
                      ? "rgba(255, 215, 0, 0.15)"
                      : "rgba(255, 215, 0, 0.1)",
                  },
                ]}
              >
                <Text style={[styles.newHighScore, { color: theme.gold }]}>
                  ★ NEW BEST! ★
                </Text>
              </View>
            )}

            <View style={styles.gameOverStats}>
              <View style={styles.statItem}>
                <Text
                  style={[styles.statItemLabel, { color: theme.textSecondary }]}
                >
                  Level Reached
                </Text>
                <Text style={[styles.statItemValue, { color: theme.text }]}>
                  {level}
                </Text>
              </View>
              <View
                style={[
                  styles.statDivider,
                  { backgroundColor: theme.cardBorder },
                ]}
              />
              <View style={styles.statItem}>
                <Text
                  style={[styles.statItemLabel, { color: theme.textSecondary }]}
                >
                  Best Score
                </Text>
                <Text style={[styles.statItemValue, { color: theme.text }]}>
                  {highScore.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.gameOverButtons}>
              <Pressable
                style={[styles.menuButton, { backgroundColor: theme.accent }]}
                onPress={startGame}
              >
                <PlayIcon size={20} color="#000" />
                <Text style={styles.menuButtonText}>PLAY AGAIN</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.menuButtonSecondary,
                  { borderColor: theme.cardBorder },
                ]}
                onPress={goToHome}
              >
                <HomeIcon size={18} color={theme.textSecondary} />
                <Text
                  style={[
                    styles.menuButtonSecondaryText,
                    { color: theme.textSecondary },
                  ]}
                >
                  MENU
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Pause Menu */}
        {gameState === "paused" && (
          <View
            style={[
              styles.pauseOverlay,
              { backgroundColor: theme.pauseOverlay },
            ]}
          >
            <View
              style={[
                styles.pauseMenu,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.pauseTitle, { color: theme.text }]}>
                PAUSED
              </Text>

              <View style={styles.pauseStatsGrid}>
                <View
                  style={[
                    styles.pauseStatCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pauseStatLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    SCORE
                  </Text>
                  <Text style={[styles.pauseStatValue, { color: theme.text }]}>
                    {score.toLocaleString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.pauseStatCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pauseStatLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    LEVEL
                  </Text>
                  <Text
                    style={[styles.pauseStatValue, { color: theme.accent }]}
                  >
                    {level}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.pauseLivesContainer,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pauseStatLabel,
                    { color: theme.textSecondary },
                  ]}
                >
                  LIVES
                </Text>
                <View style={styles.pauseLivesRow}>{renderLives()}</View>
              </View>

              <View style={styles.pauseButtons}>
                <Pressable
                  style={[styles.menuButton, { backgroundColor: theme.accent }]}
                  onPress={resumeGame}
                >
                  <PlayIcon size={20} color="#000" />
                  <Text style={styles.menuButtonText}>RESUME</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.menuButtonSecondary,
                    { borderColor: theme.cardBorder },
                  ]}
                  onPress={goToHome}
                >
                  <HomeIcon size={18} color={theme.textSecondary} />
                  <Text
                    style={[
                      styles.menuButtonSecondaryText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    MENU
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {gameState === "playing" && (
          <View
            style={[
              styles.gridWrapper,
              { width: gridContainerSize, height: gridContainerSize },
            ]}
          >
            <View style={styles.grid}>
              {grid.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                  {row.map((cell, colIndex) => (
                    <Pressable
                      key={colIndex}
                      onPress={() => handleCellTap(rowIndex, colIndex)}
                      style={[
                        styles.cell,
                        {
                          width: cellSize,
                          height: cellSize,
                          borderRadius: cellSize / 2,
                          backgroundColor: theme.cardBackground,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      {cell && (
                        <Animated.View
                          style={[
                            styles.cellInner,
                            {
                              width: cellSize - 4,
                              height: cellSize - 4,
                              borderRadius: (cellSize - 4) / 2,
                              transform: [{ scale: cell.scale }],
                            },
                            getCellStyle(cell),
                          ]}
                        >
                          {cell.type === "bomb" && (
                            <BombIcon size={cellSize * 0.5} />
                          )}
                          {cell.type === "bonus" && (
                            <StarIcon size={cellSize * 0.5} color="#000" />
                          )}
                        </Animated.View>
                      )}
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <Text style={[styles.footerText, { color: theme.textMuted }]}>
          {gameState === "playing"
            ? "Tap fast! Build combos!"
            : "A minimal reaction game"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 10,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    pointerEvents: "none",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    width: "100%",
    marginBottom: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    minHeight: 85,
    justifyContent: "center",
  },
  centerCard: {
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  statSubtext: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 4,
  },
  levelBadge: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  comboText: {
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 6,
  },
  comboTextBig: {
    fontSize: 13,
  },
  livesRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  pauseButtonCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 8,
    gap: 4,
  },
  pauseButtonLabel: {
    fontSize: 9,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  gameArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  startScreen: {
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
  },
  startHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  titleText: {
    fontSize: 48,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 4,
    marginBottom: 12,
  },
  subtitleText: {
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    textAlign: "center",
  },
  legendCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 28,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1.5,
    marginBottom: 18,
    textAlign: "center",
  },
  legendGrid: {
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  legendIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  legendTextContainer: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 15,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 2,
  },
  legendDesc: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    width: "100%",
  },
  playButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#000",
    letterSpacing: 1,
  },
  gameOverContainer: {
    alignItems: "center",
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 380,
    width: "90%",
  },
  gameOverText: {
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 20,
    letterSpacing: 2,
  },
  scoreDisplay: {
    alignItems: "center",
    marginBottom: 16,
  },
  finalScoreText: {
    fontSize: 52,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 4,
  },
  finalScoreLabel: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  achievementBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  newHighScore: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  gameOverStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 24,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statItemLabel: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  statItemValue: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  gameOverButtons: {
    gap: 12,
    width: "100%",
  },
  menuButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  menuButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  menuButtonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 2,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  menuButtonSecondaryText: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 0.5,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  pauseMenu: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 2,
    minWidth: 300,
    maxWidth: 340,
    width: "85%",
  },
  pauseTitle: {
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 24,
    letterSpacing: 2,
  },
  pauseStatsGrid: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginBottom: 12,
  },
  pauseStatCard: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  pauseStatLabel: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 6,
  },
  pauseStatValue: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  pauseLivesContainer: {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 24,
  },
  pauseLivesRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  pauseButtons: {
    gap: 12,
    width: "100%",
  },
  restartText: {
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 16,
  },
  gridWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  cell: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellInner: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  bombIcon: {
    fontSize: 24,
  },
  bonusIcon: {
    fontSize: 28,
    color: "#000",
    fontWeight: "bold",
  },
  footer: {
    marginTop: 16,
  },
  footerText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});
