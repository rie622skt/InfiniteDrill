import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
  useWindowDimensions,
} from "react-native";
import type { BucklingSupportType, Difficulty, ProblemCategory } from "../types";
import { ColumnDiagram } from "../components/ColumnDiagram";
import { BeamDiagram } from "../components/BeamDiagram";
import { BeamMDiagram, isBeamProblemWithDiagram } from "../components/BeamMDiagram";
import { BeamQDiagram } from "../components/BeamQDiagram";
import { SectionDiagram } from "../components/SectionDiagram";
import { TrussDiagram } from "../components/TrussDiagram";
import { FrameDiagram } from "../components/FrameDiagram";
import { DiagnosticRadarChart } from "../components/DiagnosticRadarChart";
import {
  useBeamProblem,
  ANSWER_TOLERANCE,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
} from "../hooks/useBeamProblem";

const WEB_CONTENT_MAX_WIDTH = 720;

/** 診断レポートのレーダー表示グループ（可読性のため3〜4軸ずつ） */
const CHART_GROUPS: { label: string; categories: ProblemCategory[] }[] = [
  { label: "梁", categories: ["simple-concentrated", "simple-distributed", "cantilever-concentrated", "cantilever-distributed", "overhang-concentrated", "overhang-distributed"] },
  { label: "断面・座屈・応力度・たわみ", categories: ["section-properties", "bending-stress", "buckling", "deflection"] },
  { label: "トラス・ラーメン", categories: ["truss-zero", "truss-calculation", "frame"] },
];

export function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const {
    problem,
    isCorrect,
    score,
    generateProblem,
    checkAnswer,
    goToNext,
    isWeakMode,
    toggleWeakMode,
    mode,
    startDiagnosticSession,
    enterNormalMode,
    enterDiagnosticMode,
    sessionProgress,
    lastDiagnosticReport,
    stats,
    resetWeakModeData,
    currentDifficulty,
    setCurrentDifficulty,
    pinnedCategory,
    setPinnedCategory,
    diagnosticReports,
    resetDiagnosticSession,
  } = useBeamProblem();

  const [activePage, setActivePage] =
    useState<"normal" | "diagnostic" | "report">("normal");

  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      generateProblem();
    }
  }, [generateProblem]);

  const unit =
    !problem
      ? ""
      : problem.problemCategory === "truss-zero" ||
        problem.problemCategory === "truss-calculation"
        ? "kN"
        : problem.problemCategory === "buckling"
          ? problem.bucklingTarget === "P_ratio"
            ? "倍"
            : "m"
          : problem.problemCategory === "deflection"
            ? "倍"
            : problem.target === "M_max" || problem.target === "M_at_x" ||
              problem.target === "frame_M_beam" || problem.target === "frame_M_left" || problem.target === "frame_M_right"
          ? "kN·m"
          : problem.target === "Va" || problem.target === "Vb" || problem.target === "Q_at_x"
            ? "kN"
            : problem.target === "Z"
              ? "mm³"
              : problem.target === "I" || problem.target === "I_centroid"
                ? "mm⁴"
                : problem.target === "sigma"
                  ? "N/mm²"
                  : problem.target === "x_g"
                    ? "mm"
                    : "";

  const targetLabel =
    !problem
      ? ""
      : problem.problemCategory === "truss-zero" ||
        problem.problemCategory === "truss-calculation"
        ? problem.targetMember
          ? `N_${problem.targetMember}`
          : "N"
        : problem.problemCategory === "buckling"
          ? problem.bucklingTarget === "P_ratio"
            ? "P_k / P_k0"
            : "l_k"
          : problem.problemCategory === "deflection"
            ? "倍率"
            : problem.target === "M_max"
          ? "M_max"
          : problem.target === "M_at_x"
            ? "M(x)"
            : problem.target === "Va"
              ? "V_A"
              : problem.target === "Vb"
                ? "V_B"
                : problem.target === "Q_at_x"
                  ? "Q(x)"
                  : problem.target === "Z"
                ? "Z"
                : problem.target === "I" || problem.target === "I_centroid"
                  ? "I"
                  : problem.target === "sigma"
                    ? "σ"
                    : problem.target === "x_g"
                      ? "x_g"
                      : problem.problemCategory === "frame" && (problem.target === "frame_M_left" || problem.target === "frame_M_right" || problem.target === "frame_M_beam")
                      ? "M"
                      : "";

  const handleSelect = (value: number) => {
    if (problem === null || isCorrect !== null) return;
    checkAnswer(value);
  };

  const isDiagnostic = mode === "diagnostic";
  const sessionCompleted = sessionProgress.isCompleted;
  const hasActiveDiagnosticSession =
    sessionProgress.targetCount != null && !sessionProgress.isCompleted;
  const hasAnyDiagnosticReport = diagnosticReports.length > 0;

  const [diagnosticTarget, setDiagnosticTarget] = useState<number>(20);
  const [selectedReportIndex, setSelectedReportIndex] = useState<number>(-1);
  const [selectedChartGroup, setSelectedChartGroup] = useState<number>(0);
  const [showCompletedDiagnosticQuestion, setShowCompletedDiagnosticQuestion] =
    useState(false);
  const prevSessionCompletedRef = useRef(sessionCompleted);

  useEffect(() => {
    if (diagnosticReports.length === 0) {
      setSelectedReportIndex(-1);
    } else if (selectedReportIndex >= diagnosticReports.length) {
      setSelectedReportIndex(0);
    }
  }, [diagnosticReports.length, selectedReportIndex]);

  // 診断モードで「今回のセッションが完了した瞬間」にだけ、最後の問題表示モードに入れる
  useEffect(() => {
    const prev = prevSessionCompletedRef.current;
    if (!prev && sessionCompleted && activePage === "diagnostic") {
      setShowCompletedDiagnosticQuestion(true);
    }
    prevSessionCompletedRef.current = sessionCompleted;
  }, [activePage, sessionCompleted]);

  const difficultyLabel: Record<Difficulty, string> = {
    beginner: "初級",
    intermediate: "中級",
    advanced: "上級",
    mixed: "総合",
  };

  const handleChangeDifficulty = (difficulty: Difficulty) => {
    if (difficulty === currentDifficulty) return;
    setCurrentDifficulty(difficulty);
  };

  const formatValue = (v: number): string => {
    if (!Number.isFinite(v)) return String(v);
    const s = String(v);
    if (s.includes("e") || s.includes("E")) return s;
    const abs = Math.abs(v);
    if (abs >= 1000) {
      return v.toLocaleString("en-US", {
        minimumFractionDigits: s.includes(".") ? 1 : 0,
        maximumFractionDigits: s.includes(".") ? 1 : 0,
      });
    }
    return s;
  };

  const isWeb = Platform.OS === "web";
  const webScrollStyle = isWeb ? { width: "100%" as const } : undefined;
  const webContentStyle = isWeb
    ? {
        width: "100%" as const,
        maxWidth: Math.min(windowWidth, WEB_CONTENT_MAX_WIDTH),
        alignSelf: "center" as const,
      }
    : undefined;

  return (
    <ScrollView
      style={[styles.scroll, webScrollStyle]}
      contentContainerStyle={[styles.scrollContent, webContentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>構造力学ドリル</Text>
        {activePage === "normal" && (
          <Text style={styles.difficultyBadge}>
            {difficultyLabel[currentDifficulty]}モード
          </Text>
        )}
      </View>

      {/* ページタブ: 通常 / 診断 / レポート */}
      <View style={styles.pageTabs}>
        <TouchableOpacity
          style={[
            styles.pageTab,
            activePage === "normal" && styles.pageTabActive,
          ]}
          onPress={() => {
            setActivePage("normal");
            setShowCompletedDiagnosticQuestion(false);
            enterNormalMode();
          }}
        >
          <Text
            style={[
              styles.pageTabText,
              activePage === "normal" && styles.pageTabTextActive,
            ]}
          >
            通常モード
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pageTab,
            activePage === "diagnostic" && styles.pageTabActive,
          ]}
          onPress={() => {
            setActivePage("diagnostic");
            if (!sessionProgress.isCompleted && sessionProgress.targetCount != null) {
              enterDiagnosticMode();
            }
          }}
        >
          <Text
            style={[
              styles.pageTabText,
              activePage === "diagnostic" && styles.pageTabTextActive,
            ]}
          >
            診断モード
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pageTab,
            activePage === "report" && styles.pageTabActive,
          ]}
          onPress={() => {
            setActivePage("report");
            setShowCompletedDiagnosticQuestion(false);
          }}
        >
          <Text
            style={[
              styles.pageTabText,
              activePage === "report" && styles.pageTabTextActive,
            ]}
          >
            診断レポート
          </Text>
        </TouchableOpacity>
      </View>

      {/* 診断レポートページ */}
      {activePage === "report" && (
        <View style={styles.reportContainer}>
          {/* 1. 通常モードの苦手克服モードの状況（常に最上部に表示） */}
          <Text style={styles.reportTitle}>通常モードの苦手克服モードの状況</Text>
          <Text style={styles.reportText}>
            現在の設定: {isWeakMode ? "ON（苦手優先で出題）" : "OFF（ランダム出題）"}
          </Text>
          <Text style={[styles.reportText, { marginTop: 4 }]}>
            ※下記の正答率は、苦手克服モードを ON にして解いた問題だけを集計しています。
            未解答カテゴリや正答率の低いカテゴリが、次回以降より優先的に出題されます。
          </Text>
          <View style={{ marginTop: 4 }}>
            {ALL_CATEGORIES.map((cat) => {
              const s = stats[cat] ?? { total: 0, correct: 0, accuracy: 0 };
              return (
                <Text key={cat} style={styles.reportText}>
                  ・{CATEGORY_LABELS[cat]}: {Math.round(s.accuracy * 100)}%
                  （{s.correct}/{s.total}）
                </Text>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.diagnosticButton, { marginTop: 8, alignSelf: "flex-start" }]}
            onPress={() => {
              const message =
                "苦手克服モード用に蓄積したデータをすべて削除します。よろしいですか？";

              // Web では Alert のボタンが使えないため window.confirm で確認する
              if (Platform.OS === "web") {
                if (typeof window !== "undefined" && window.confirm(message)) {
                  resetWeakModeData();
                }
                return;
              }

              Alert.alert("データをリセット", message, [
                { text: "キャンセル", style: "cancel" },
                {
                  text: "リセットする",
                  style: "destructive",
                  onPress: resetWeakModeData,
                },
              ]);
            }}
          >
            <Text style={styles.diagnosticButtonText}>苦手克服モードのデータをリセット</Text>
          </TouchableOpacity>

          {/* 2. 診断結果（複数セッションの一覧＋タブ） */}
          <View style={{ marginTop: 16 }}>
            <Text style={styles.reportTitle}>診断結果</Text>
            {diagnosticReports.length === 0 ? (
              <Text style={styles.reportText}>
                まだ診断は実行されていません。
              </Text>
            ) : (
              <>
                <View style={styles.reportTabs}>
                  {diagnosticReports.map((rep, index) => {
                    const d = new Date(rep.createdAt);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    const hh = String(d.getHours()).padStart(2, "0");
                    const mi = String(d.getMinutes()).padStart(2, "0");
                    const acc = Math.round(rep.overallAccuracy * 100);
                    const label = `${yyyy}/${mm}/${dd} ${hh}:${mi}  ${rep.totalQuestions}問 ${acc}%`;
                    const isActive = index === selectedReportIndex;
                    return (
                      <TouchableOpacity
                        key={rep.sessionId}
                        style={[
                          styles.reportTab,
                          isActive && styles.reportTabActive,
                        ]}
                        onPress={() =>
                          setSelectedReportIndex((prev) =>
                            prev === index ? -1 : index
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.reportTabText,
                            isActive && styles.reportTabTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {selectedReportIndex >= 0 &&
                  diagnosticReports[selectedReportIndex] && (() => {
                  const rep = diagnosticReports[selectedReportIndex];
                  return (
                    <>
                      <Text style={styles.reportSummary}>
                        合計 {rep.totalQuestions} 問 /
                        正答率 {Math.round(rep.overallAccuracy * 100)}%
                        {rep.overallAvgDurationMs != null &&
                          ` / 平均 ${(rep.overallAvgDurationMs / 1000).toFixed(1)} 秒/問`}
                      </Text>
                      <Text style={[styles.reportSubtitle, { marginTop: 8 }]}>レーダー（表示グループ）</Text>
                      <View style={styles.reportTabs}>
                        {CHART_GROUPS.map((grp, idx) => {
                          const isActive = selectedChartGroup === idx;
                          return (
                            <TouchableOpacity
                              key={grp.label}
                              style={[styles.reportTab, isActive && styles.reportTabActive]}
                              onPress={() => setSelectedChartGroup(idx)}
                            >
                              <Text style={[styles.reportTabText, isActive && styles.reportTabTextActive]}>
                                {grp.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <DiagnosticRadarChart
                        categories={CHART_GROUPS[selectedChartGroup].categories}
                        statsByCategory={rep.statsByCategory}
                      />
                      <Text style={styles.reportSubtitle}>全カテゴリの正答率</Text>
                      <View style={{ marginBottom: 8 }}>
                        {ALL_CATEGORIES.map((cat) => {
                          const s = rep.statsByCategory[cat] ?? { total: 0, correct: 0, accuracy: 0 };
                          return (
                            <Text key={cat} style={styles.reportText}>
                              {CATEGORY_LABELS[cat]}: {Math.round(s.accuracy * 100)}%
                              （{s.correct}/{s.total}）
                            </Text>
                          );
                        })}
                      </View>
                      <Text style={styles.reportSubtitle}>弱点カテゴリ</Text>
                      {rep.weakCategories.length === 0 ? (
                        <Text style={styles.reportText}>
                          特に顕著な弱点カテゴリはありません。
                        </Text>
                      ) : (
                        <Text style={styles.reportText}>
                          {rep.weakCategories.map((cat: ProblemCategory) => CATEGORY_LABELS[cat]).join("、")}
                        </Text>
                      )}
                      <Text style={styles.reportSubtitle}>コメント</Text>
                      <Text style={styles.reportText}>
                        {rep.recommendation}
                      </Text>
                    </>
                  );
                })()}
              </>
            )}
          </View>
        </View>
      )}

      {/* 診断レポートページでは問題UIを隠す */}
      {activePage !== "report" && (
        <>
          {/* 上部ステータスエリア（通常 or 診断） */}
          {activePage === "diagnostic" ? (
            <>
              <View style={styles.diagnosticRow}>
                {showCompletedDiagnosticQuestion ? (
                  <View />
                ) : (
                  <>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modeTitle}>診断トレーニングモード</Text>
                      {!hasActiveDiagnosticSession ? (
                        <>
                          <Text style={styles.diagnosticDesc}>
                            決められた問数を一気に解いて、カテゴリー別の得意・苦手を分析するモードです。
                          </Text>
                          <Text style={styles.diagnosticDesc}>
                            問題数を選んで診断を開始してください。
                          </Text>
                          <View style={styles.diagnosticTargetRow}>
                            {[10, 20, 30].map((n) => (
                              <TouchableOpacity
                                key={n}
                                style={[
                                  styles.diagnosticTargetButton,
                                  diagnosticTarget === n && styles.diagnosticTargetButtonActive,
                                ]}
                                onPress={() => setDiagnosticTarget(n)}
                              >
                                <Text
                                  style={[
                                    styles.diagnosticTargetText,
                                    diagnosticTarget === n && styles.diagnosticTargetTextActive,
                                  ]}
                                >
                                  {n}問
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          {hasAnyDiagnosticReport && (
                            <TouchableOpacity
                              style={[styles.reportTab, { marginTop: 8 }]}
                              onPress={() => {
                                setActivePage("report");
                                setSelectedReportIndex(0);
                                setShowCompletedDiagnosticQuestion(false);
                              }}
                            >
                              <Text style={styles.reportTabText}>
                                前回の診断結果を見る
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : (
                        sessionProgress.targetCount != null && (
                          <Text style={styles.diagnosticProgress}>
                            進捗: {sessionProgress.answeredCount} /{" "}
                            {sessionProgress.targetCount} 問
                          </Text>
                        )
                      )}
                    </View>
                    {!hasActiveDiagnosticSession ? (
                      <TouchableOpacity
                        style={styles.diagnosticButton}
                        onPress={() => {
                          startDiagnosticSession(diagnosticTarget);
                        }}
                      >
                        <Text style={styles.diagnosticButtonText}>診断を開始</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.diagnosticButton}
                        onPress={() => {
                          resetDiagnosticSession();
                          setShowCompletedDiagnosticQuestion(false);
                        }}
                      >
                        <Text style={styles.diagnosticButtonText}>診断を中断して最初から</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
              {/* 診断タブ内に難易度セレクタを配置（通常モードの難易度を設定） */}
              <View style={styles.difficultySection}>
                <Text style={styles.difficultySectionTitle}>
                  通常モードの難易度を選択してください
                </Text>
                <TouchableOpacity
                  style={[
                    styles.difficultyCard,
                    currentDifficulty === "beginner" && styles.difficultyCardActive,
                  ]}
                  onPress={() => handleChangeDifficulty("beginner")}
                >
                  <Text
                    style={[
                      styles.difficultyCardTitle,
                      currentDifficulty === "beginner" && styles.difficultyCardTitleActive,
                    ]}
                  >
                    初級
                  </Text>
                  <Text style={styles.difficultyCardBody}>
                    ・単純梁の集中荷重は中央のみ（a = L/2）{"\n"}
                    ・片持ち梁の集中荷重は先端のみ（a = L）{"\n"}
                    ・寸法 a, b, L はすべて図に表示
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.difficultyCard,
                    currentDifficulty === "intermediate" && styles.difficultyCardActive,
                  ]}
                  onPress={() => handleChangeDifficulty("intermediate")}
                >
                  <Text
                    style={[
                      styles.difficultyCardTitle,
                      currentDifficulty === "intermediate" &&
                        styles.difficultyCardTitleActive,
                    ]}
                  >
                    中級
                  </Text>
                  <Text style={styles.difficultyCardBody}>
                    ・単純梁の集中荷重は必ず偏心（a ≠ L/2）{"\n"}
                    ・片持ち梁は任意位置の集中荷重も含む{"\n"}
                    ・図では b 寸法を隠し、L − a を自分で計算
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.difficultyCard,
                    currentDifficulty === "advanced" && styles.difficultyCardActive,
                  ]}
                  onPress={() => handleChangeDifficulty("advanced")}
                >
                  <Text
                    style={[
                      styles.difficultyCardTitle,
                      currentDifficulty === "advanced" && styles.difficultyCardTitleActive,
                    ]}
                  >
                    上級
                  </Text>
                  <Text style={styles.difficultyCardBody}>
                    ・出題内容は中級と同じ（今後トラス等を追加予定）{"\n"}
                    ・本試験レベルのミスパターンを意識した誤答肢{"\n"}
                    ・復習用として中級より高負荷な演習を想定
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.difficultyCard,
                    currentDifficulty === "mixed" && styles.difficultyCardActive,
                  ]}
                  onPress={() => handleChangeDifficulty("mixed")}
                >
                  <Text
                    style={[
                      styles.difficultyCardTitle,
                      currentDifficulty === "mixed" && styles.difficultyCardTitleActive,
                    ]}
                  >
                    総合
                  </Text>
                  <Text style={styles.difficultyCardBody}>
                    ・初級30%・中級50%・上級20%でランダムに出題（実力判定）{"\n"}
                    ・基礎から試験レベルまでバランス良く復習{"\n"}
                    ・実力チェック用のフリーモードとして利用
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.modeRow}>
              <View style={styles.modeSwitchRow}>
                <Text style={styles.modeLabel}>苦手克服モード</Text>
                <Switch
                  value={isWeakMode}
                  onValueChange={toggleWeakMode}
                  disabled={isDiagnostic}
                />
              </View>
            </View>
          )}
          {isWeakMode && activePage === "normal" && (
            <Text style={styles.weakIndicator}>苦手を特訓中...</Text>
          )}

          {activePage === "normal" && (
            <View style={styles.categorySection}>
              <Text style={styles.categorySectionTitle}>出題カテゴリ</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipsRow}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    pinnedCategory === null && styles.categoryChipActive,
                  ]}
                  onPress={() => setPinnedCategory(null)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      pinnedCategory === null && styles.categoryChipTextActive,
                    ]}
                  >
                    ランダム
                  </Text>
                </TouchableOpacity>
                {ALL_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      pinnedCategory === cat && styles.categoryChipActive,
                    ]}
                    onPress={() => setPinnedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        pinnedCategory === cat && styles.categoryChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {activePage === "normal" && score > 0 && (
            <Text style={styles.score}>連続正解: {score}</Text>
          )}

          {(activePage === "normal" ||
            (activePage === "diagnostic" &&
              (hasActiveDiagnosticSession || showCompletedDiagnosticQuestion))) && (
            <>
              <View style={styles.diagramContainer}>
                {problem ? (
                  problem.problemCategory === "section-properties" ? (
                    problem.sectionBmm != null && problem.sectionHmm != null ? (
                      <SectionDiagram
                        b={problem.sectionBmm}
                        h={problem.sectionHmm}
                        bInner={problem.sectionBInner}
                        hInner={problem.sectionHInner}
                        b1={problem.sectionB1mm}
                        b2={problem.sectionB2mm}
                        tf={problem.sectionTfMm}
                        tw={problem.sectionTwMm}
                      />
                    ) : (
                      <Text style={styles.placeholder}>
                        断面寸法が取得できません
                      </Text>
                    )
                  ) : problem.problemCategory === "bending-stress" ? (
                    <>
                      <BeamDiagram problem={problem} />
                      {problem.sectionBmm != null &&
                      problem.sectionHmm != null ? (
                        <View style={{ marginTop: 16 }}>
                          <SectionDiagram
                            b={problem.sectionBmm}
                            h={problem.sectionHmm}
                            bInner={problem.sectionBInner}
                            hInner={problem.sectionHInner}
                            b1={problem.sectionB1mm}
                            b2={problem.sectionB2mm}
                            tf={problem.sectionTfMm}
                            tw={problem.sectionTwMm}
                          />
                        </View>
                      ) : null}
                    </>
                  ) : problem.problemCategory === "buckling" &&
                    problem.bucklingSupportType != null ? (
                    <ColumnDiagram
                      supportType={problem.bucklingSupportType}
                      L={problem.L}
                    />
                  ) : problem.problemCategory === "frame" &&
                    problem.frameL != null &&
                    problem.frameH != null &&
                    (problem.frameP != null || problem.frameW != null || problem.frameHorizontalP != null) ? (
                    <FrameDiagram
                      frameL={problem.frameL}
                      frameH={problem.frameH}
                      frameP={problem.frameP}
                      frameW={problem.frameW}
                      frameHorizontalP={problem.frameHorizontalP}
                      hingePositionRatio={problem.frameHingeRatio ?? 0.5}
                    />
                  ) : (problem.problemCategory === "truss-zero" ||
                      problem.problemCategory === "truss-calculation") &&
                    problem.trussPattern != null &&
                    problem.targetMember != null &&
                    problem.trussP != null &&
                    problem.trussL != null ? (
                    <TrussDiagram
                      pattern={problem.trussPattern}
                      P={problem.trussP}
                      L={problem.trussL}
                      targetMember={problem.targetMember}
                    />
                  ) : (
                    <BeamDiagram problem={problem} />
                  )
                ) : (
                  <Text style={styles.placeholder}>問題を生成してください</Text>
                )}
              </View>

              <Text style={styles.question}>
                {(() => {
                  if (!problem) return "";
                  if (problem.customQuestion) return problem.customQuestion;
                  if (problem.problemCategory === "section-properties") {
                    if (problem.target === "Z") {
                      return "図の断面について、断面係数 Z を求めよ";
                    }
                    if (problem.target === "I") {
                      return "図の断面について、断面二次モーメント I を求めよ";
                    }
                    if (problem.target === "x_g") {
                      return "図のL形断面の図心の、左端からの距離 x_g [mm] を求めよ";
                    }
                    if (problem.target === "I_centroid") {
                      return "図のL形断面について、図心（x_g）を通る鉛直軸まわりの断面二次モーメント I [mm⁴] を求めよ";
                    }
                    return "図の断面について、断面特性を求めよ";
                  }
                  if (problem.problemCategory === "bending-stress") {
                    if (
                      problem.type === "concentrated" &&
                      problem.axialForceKN != null
                    ) {
                      return problem.sigmaCompressionSide
                        ? "軸力 N と曲げモーメント M が同時に作用するとき、圧縮側縁の応力度 σ = N/A − M/Z を求めよ。圧縮を正、引張を負として答えよ。"
                        : "軸力 N と曲げモーメント M が同時に作用するとき、引張側縁の応力度 σ = N/A + M/Z を求めよ";
                    }
                    return "図の梁に生じる最大曲げ応力度 σ を求めよ";
                  }
                  if (problem.problemCategory === "buckling") {
                    if (problem.bucklingTarget === "lk") {
                      return "図の柱の座屈長さ l_k を求めよ";
                    }
                    return "図の柱の弾性座屈荷重 P_k は、長さ L の両端ピン柱の何倍か求めよ";
                  }
                  if (problem.problemCategory === "frame") {
                    if (problem.frameHorizontalP != null) {
                      return "図の3ヒンジラーメンにおいて、左柱頭に水平荷重 P が作用するとき、左柱頭の曲げモーメントの大きさ M [kN·m] を求めよ";
                    }
                    return "図の3ヒンジラーメンにおいて、左柱頭の曲げモーメントの大きさ [kN·m] を求めよ";
                  }
                  if (
                    problem.problemCategory === "truss-zero" ||
                    problem.problemCategory === "truss-calculation"
                  ) {
                    const member =
                      problem.targetMember != null
                        ? `部材${problem.targetMember}`
                        : "指定部材";
                    return `図のトラスにおいて、${member}に生じる軸方向力 N を求めよ。ただし、引張をプラス、圧縮をマイナスとする。`;
                  }
                  if (problem.structure === "overhang") {
                    if (problem.target === "Va")
                      return "図の張り出し梁において、支点Aの反力 V_A を求めよ";
                    if (problem.target === "Vb")
                      return "図の張り出し梁において、支点Bの反力 V_B を求めよ";
                    if (problem.target === "M_max")
                      return "図の張り出し梁において、最大曲げモーメントの大きさを求めよ";
                  }
                  const structureLabel =
                    problem.structure === "cantilever"
                      ? "片持ち梁"
                      : problem.structure === "overhang"
                        ? "張り出し梁"
                        : "単純梁";
                  const x = problem.questionX;
                  if (problem.target === "M_max")
                    return `図の${structureLabel}において、最大曲げモーメントの大きさ（絶対値）を求めよ`;
                  if (problem.target === "M_at_x" && x != null)
                    return `図の${structureLabel}において、支点Aから ${x} m の位置の曲げモーメントの大きさを求めよ`;
                  if (problem.target === "Va")
                    return `図の${structureLabel}において、支点Aの反力 V_A を求めよ`;
                  if (problem.target === "Vb")
                    return `図の${structureLabel}において、支点Bの反力 V_B を求めよ`;
                  if (problem.target === "Q_at_x" && x != null)
                    return `図の${structureLabel}において、支点Aから ${x} m の位置のせん断力を求めよ。符号も含めて答えよ`;
                  return `図の${structureLabel}において、最大曲げモーメントの大きさ（絶対値）を求めよ`;
                })()}
              </Text>
              {problem && (
                <Text style={styles.info}>
                  {problem.problemCategory === "deflection"
                    ? "図は単純梁・片持ち梁のイメージです。倍率は公式の比例関係から答えてください。"
                    : problem.problemCategory === "section-properties" &&
                  problem.sectionBmm != null &&
                  problem.sectionHmm != null
                    ? problem.sectionShape === "L-shape" &&
                      problem.sectionB1mm != null &&
                      problem.sectionB2mm != null &&
                      problem.sectionLShapeHmm != null
                      ? `b1 = ${problem.sectionB1mm} mm, b2 = ${problem.sectionB2mm} mm, h = ${problem.sectionLShapeHmm} mm`
                      : problem.sectionShape === "H-shape" &&
                        problem.sectionTfMm != null &&
                        problem.sectionTwMm != null
                        ? `b = ${problem.sectionBmm} mm, h = ${problem.sectionHmm} mm, tf = ${problem.sectionTfMm} mm, tw = ${problem.sectionTwMm} mm`
                        : problem.sectionShape === "hollow-rect" &&
                        problem.sectionBInner != null &&
                        problem.sectionHInner != null
                        ? `外寸 b×h = ${problem.sectionBmm}×${problem.sectionHmm} mm, 内寸 b'×h' = ${problem.sectionBInner}×${problem.sectionHInner} mm`
                        : `b = ${problem.sectionBmm} mm, h = ${problem.sectionHmm} mm`
                    : problem.problemCategory === "bending-stress" &&
                        problem.type === "concentrated"
                      ? problem.axialForceKN != null
                        ? `N = ${problem.axialForceKN} kN, P = ${problem.P} kN, L = ${problem.L} m, a = ${problem.a} m, b = ${problem.b} m / 断面: b = ${problem.sectionBmm} mm, h = ${problem.sectionHmm} mm`
                        : `P = ${problem.P} kN, L = ${problem.L} m, a = ${problem.a} m, b = ${problem.b} m / 断面: b = ${problem.sectionBmm} mm, h = ${problem.sectionHmm} mm`
                      : problem.problemCategory === "buckling" &&
                          problem.bucklingSupportType != null
                        ? (() => {
                            const labels: Record<
                              BucklingSupportType,
                              string
                            > = {
                              "pinned-pinned": "両端ピン",
                              "fixed-fixed": "両端固定",
                              "fixed-pinned": "一端固定・他端ピン",
                              "fixed-free": "一端固定・他端自由",
                            };
                            return `${labels[problem.bucklingSupportType!]}、L = ${problem.L} m`;
                          })()
                        : problem.problemCategory === "frame" &&
                          problem.frameL != null &&
                          problem.frameH != null &&
                          (problem.frameP != null || problem.frameW != null || problem.frameHorizontalP != null)
                        ? problem.frameHorizontalP != null
                          ? `L = ${problem.frameL} m, h = ${problem.frameH} m, 水平 P = ${problem.frameHorizontalP} kN`
                          : problem.frameW != null
                            ? `L = ${problem.frameL} m, h = ${problem.frameH} m, w = ${problem.frameW} kN/m`
                            : `L = ${problem.frameL} m, h = ${problem.frameH} m, P = ${problem.frameP} kN`
                        : (problem.problemCategory === "truss-zero" ||
                            problem.problemCategory === "truss-calculation") &&
                          problem.trussP != null &&
                          problem.trussL != null
                          ? problem.problemCategory === "truss-zero"
                            ? `P = ${problem.trussP} kN, L = ${problem.trussL} m`
                            : problem.trussPattern === "pratt-truss"
                              ? problem.trussL === 8
                                ? `P = ${problem.trussP} kN, スパン 2L = 16 m, h = 6 m（3:4:5）`
                                : `P = ${problem.trussP} kN, スパン 2L = 8 m, h = 3 m（3:4:5）`
                              : `P = ${problem.trussP} kN, L = ${problem.trussL} m, h = L（高さ、斜材45度）`
                          : problem.structure === "overhang" &&
                              problem.type === "concentrated" &&
                              problem.overhangLength != null
                            ? problem.a < problem.L
                              ? `L = ${problem.L} m, c = ${problem.overhangLength} m, P = ${problem.P} kN, a = ${problem.a} m`
                              : `L = ${problem.L} m, c = ${problem.overhangLength} m, P = ${problem.P} kN`
                            : problem.structure === "overhang" &&
                              problem.type === "distributed" &&
                              problem.overhangLength != null
                            ? `L = ${problem.L} m, c = ${problem.overhangLength} m, w = ${problem.w} kN/m`
                            : problem.type === "concentrated"
                          ? problem.hideDimensionB
                            ? `P = ${problem.P} kN, L = ${problem.L} m, a = ${problem.a} m`
                            : `P = ${problem.P} kN, L = ${problem.L} m, a = ${problem.a} m, b = ${problem.b} m`
                          : `w = ${problem.w} kN/m, L = ${problem.L} m`}
                </Text>
              )}

              {isCorrect !== null && (
                <View style={styles.resultContainer}>
                  <Text
                    style={[
                      styles.result,
                      isCorrect ? styles.resultCorrect : styles.resultWrong,
                    ]}
                  >
                    {isCorrect ? "正解" : "不正解"}
                  </Text>
                  {!isCorrect && problem && (
                    <Text style={styles.correctAnswer}>
                      正解: {formatValue(problem.answer)} {unit}
                    </Text>
                  )}
                  {problem?.explanation != null &&
                    problem.explanation.length > 0 && (
                      <View style={styles.explanationBox}>
                        <Text style={styles.explanationTitle}>解説</Text>
                        <Text style={styles.explanationText}>
                          {problem.explanation}
                        </Text>
                      </View>
                    )}
                  {problem != null && isBeamProblemWithDiagram(problem) && (
                    <View style={styles.diagramSection}>
                      <Text style={styles.diagramCaption}>曲げモーメント図</Text>
                      <BeamMDiagram problem={problem} />
                      <Text style={styles.diagramCaption}>せん断力図</Text>
                      <BeamQDiagram problem={problem} />
                    </View>
                  )}
                </View>
              )}

              <View style={styles.options}>
                {problem?.choices.map((choice, index) => (
                  <TouchableOpacity
                    key={`${choice}-${index}`}
                    style={styles.optionButton}
                    onPress={() => handleSelect(choice)}
                    disabled={isCorrect !== null}
                  >
                    <Text style={styles.optionText}>
                      {formatValue(choice)} {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {activePage === "diagnostic" && !hasActiveDiagnosticSession ? (
                hasAnyDiagnosticReport && (
                  <TouchableOpacity
                    style={styles.nextButton}
                    onPress={() => {
                      setActivePage("report");
                      setSelectedReportIndex(0);
                      setShowCompletedDiagnosticQuestion(false);
                    }}
                  >
                    <Text style={styles.nextButtonText}>診断結果を見る</Text>
                  </TouchableOpacity>
                )
              ) : (
                <TouchableOpacity style={styles.nextButton} onPress={goToNext}>
                  <Text style={styles.nextButtonText}>次の問題へ</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
    paddingRight: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  difficultyBadge: {
    fontSize: 11,
    color: "#1976d2",
  },
  modeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
    marginBottom: 4,
  },
  modeSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeLabel: {
    fontSize: 14,
    color: "#333",
  },
  weakIndicator: {
    fontSize: 12,
    color: "#1976d2",
    marginBottom: 4,
  },
  categorySection: {
    marginBottom: 12,
  },
  categorySectionTitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
  },
  categoryChipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  categoryChipActive: {
    backgroundColor: "#e3f2fd",
    borderColor: "#1976d2",
  },
  categoryChipText: {
    fontSize: 12,
    color: "#555",
    maxWidth: 140,
  },
  categoryChipTextActive: {
    color: "#1976d2",
    fontWeight: "600",
  },
  score: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
    color: "#666",
  },
  diagramContainer: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    paddingRight: 12,
    marginBottom: 16,
    alignItems: "center",
    minHeight: 260,
  },
  placeholder: {
    color: "#999",
    fontSize: 14,
  },
  question: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
    paddingLeft: 20,
    paddingRight: 16,
  },
  info: {
    fontSize: 14,
    marginBottom: 20,
    marginTop: 4,
    color: "#666",
    paddingHorizontal: 4,
  },
  resultContainer: {
    marginBottom: 12,
    alignItems: "center",
  },
  result: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  correctAnswer: {
    fontSize: 16,
    marginTop: 6,
    color: "#333",
    fontWeight: "600",
  },
  explanationBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f0f7ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbdefb",
    alignSelf: "stretch",
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 22,
  },
  diagramSection: {
    marginTop: 16,
    alignSelf: "stretch",
    alignItems: "center",
  },
  diagramCaption: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
    marginBottom: 4,
  },
  resultCorrect: {
    color: "#2e7d32",
  },
  resultWrong: {
    color: "#c62828",
  },
  options: {
    gap: 10,
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 16,
    textAlign: "center",
    color: "#333",
  },
  nextButton: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  pageTabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginBottom: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
    padding: 2,
  },
  pageTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pageTabActive: {
    backgroundColor: "#ffffff",
  },
  pageTabText: {
    fontSize: 12,
    textAlign: "center",
    color: "#555",
  },
  pageTabTextActive: {
    fontWeight: "600",
    color: "#1976d2",
  },
  difficultySection: {
    marginTop: 8,
    marginBottom: 8,
  },
  difficultySectionTitle: {
    fontSize: 12,
    color: "#333",
    marginBottom: 4,
  },
  difficultyCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    backgroundColor: "#eceff1",
    marginTop: 6,
  },
  difficultyCardActive: {
    borderColor: "#1976d2",
    backgroundColor: "#e3f2fd",
  },
  difficultyCardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#37474f",
    marginBottom: 4,
  },
  difficultyCardTitleActive: {
    color: "#1976d2",
  },
  difficultyCardBody: {
    fontSize: 11,
    color: "#455a64",
    lineHeight: 18,
  },
  diagnosticRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  diagnosticProgress: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  diagnosticDesc: {
    fontSize: 12,
    color: "#555",
    marginTop: 2,
  },
  diagnosticButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#455a64",
  },
  diagnosticButtonText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  reportContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#333",
  },
  reportSummary: {
    fontSize: 13,
    color: "#333",
    marginBottom: 8,
  },
  reportSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 2,
    color: "#333",
  },
  reportText: {
    fontSize: 12,
    color: "#444",
    lineHeight: 18,
  },
  reportTabs: {
    marginTop: 8,
    marginBottom: 8,
  },
  reportTab: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#b0bec5",
    backgroundColor: "#eceff1",
    marginBottom: 4,
  },
  reportTabActive: {
    backgroundColor: "#1976d2",
    borderColor: "#1976d2",
  },
  reportTabText: {
    fontSize: 12,
    color: "#37474f",
  },
  reportTabTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  diagnosticTargetRow: {
    flexDirection: "row",
    marginTop: 6,
    gap: 6,
  },
  diagnosticTargetButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#90a4ae",
    backgroundColor: "#eceff1",
  },
  diagnosticTargetButtonActive: {
    backgroundColor: "#1976d2",
    borderColor: "#1976d2",
  },
  diagnosticTargetText: {
    fontSize: 12,
    color: "#455a64",
  },
  diagnosticTargetTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
});
