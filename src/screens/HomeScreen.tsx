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
} from "react-native";
import type { ProblemCategory } from "../types";
import { BeamDiagram } from "../components/BeamDiagram";
import { DiagnosticRadarChart } from "../components/DiagnosticRadarChart";
import { useBeamProblem, ANSWER_TOLERANCE } from "../hooks/useBeamProblem";

export function HomeScreen() {
  const {
    problem,
    isCorrect,
    score,
    generateProblem,
    checkAnswer,
    goToNext,
    overallAccuracy,
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

  const unit = problem?.target === "M_max" ? "kN·m" : "kN";
  const targetLabel =
    problem?.target === "M_max"
      ? "M_max"
      : problem?.target === "Va"
        ? "V_A"
        : "V_B";

  const handleSelect = (value: number) => {
    if (problem === null || isCorrect !== null) return;
    checkAnswer(value);
  };

  const overallAccuracyPercent =
    overallAccuracy == null ? null : Math.round(overallAccuracy * 100);

  const isDiagnostic = mode === "diagnostic";
  const sessionCompleted = sessionProgress.isCompleted;
  const hasActiveDiagnosticSession =
    sessionProgress.targetCount != null && !sessionProgress.isCompleted;
  const hasAnyDiagnosticReport = diagnosticReports.length > 0;

  const [diagnosticTarget, setDiagnosticTarget] = useState<number>(20);
  const [selectedReportIndex, setSelectedReportIndex] = useState<number>(-1);
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>構造力学ドリル</Text>

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
            <Text style={styles.reportText}>
              ・単純梁×集中荷重:{" "}
              {Math.round(stats["simple-concentrated"].accuracy * 100)}%
              （{stats["simple-concentrated"].correct}/
              {stats["simple-concentrated"].total}）
            </Text>
            <Text style={styles.reportText}>
              ・単純梁×等分布荷重:{" "}
              {Math.round(stats["simple-distributed"].accuracy * 100)}%
              （{stats["simple-distributed"].correct}/
              {stats["simple-distributed"].total}）
            </Text>
            <Text style={styles.reportText}>
              ・片持ち梁×集中荷重:{" "}
              {Math.round(stats["cantilever-concentrated"].accuracy * 100)}%
              （{stats["cantilever-concentrated"].correct}/
              {stats["cantilever-concentrated"].total}）
            </Text>
            <Text style={styles.reportText}>
              ・片持ち梁×等分布荷重:{" "}
              {Math.round(stats["cantilever-distributed"].accuracy * 100)}%
              （{stats["cantilever-distributed"].correct}/
              {stats["cantilever-distributed"].total}）
            </Text>
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
                      <DiagnosticRadarChart
                        statsByCategory={rep.statsByCategory}
                      />
                      <Text style={styles.reportSubtitle}>弱点カテゴリ</Text>
                      {rep.weakCategories.length === 0 ? (
                        <Text style={styles.reportText}>
                          特に顕著な弱点カテゴリはありません。
                        </Text>
                      ) : (
                        <Text style={styles.reportText}>
                          {rep.weakCategories
                            .map((cat: ProblemCategory) => {
                              switch (cat) {
                                case "simple-concentrated":
                                  return "単純梁×集中荷重";
                                case "simple-distributed":
                                  return "単純梁×等分布荷重";
                                case "cantilever-concentrated":
                                  return "片持ち梁×集中荷重";
                                case "cantilever-distributed":
                                  return "片持ち梁×等分布荷重";
                                default:
                                  return cat;
                              }
                            })
                            .join("、")}
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

          {activePage === "normal" && score > 0 && (
            <Text style={styles.score}>連続正解: {score}</Text>
          )}

          {(activePage === "normal" ||
            (activePage === "diagnostic" &&
              (hasActiveDiagnosticSession || showCompletedDiagnosticQuestion))) && (
            <>
              <View style={styles.diagramContainer}>
                {problem ? (
                  <BeamDiagram problem={problem} />
                ) : (
                  <Text style={styles.placeholder}>問題を生成してください</Text>
                )}
              </View>

              <Text style={styles.question}>
                {(() => {
                  const structureLabel =
                    problem?.structure === "cantilever" ? "片持ち梁" : "単純梁";
                  if (problem?.target === "M_max")
                    return `図の${structureLabel}において、最大曲げモーメントの大きさ（絶対値）を求めよ`;
                  if (problem?.target === "Va")
                    return `図の${structureLabel}において、支点Aの反力 V_A を求めよ`;
                  if (problem?.target === "Vb")
                    return `図の${structureLabel}において、支点Bの反力 V_B を求めよ`;
                  return `図の${structureLabel}において、最大曲げモーメントの大きさ（絶対値）を求めよ`;
                })()}
              </Text>
              {problem && (
                <Text style={styles.info}>
                  {problem.type === "concentrated"
                    ? `P = ${problem.P} kN, L = ${problem.L} m, a = ${problem.a} m, b = ${problem.b} m`
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
                      正解: {problem.answer}{" "}
                      {problem.target === "M_max" ? "kN·m" : "kN"}
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
                      {choice} {problem.target === "M_max" ? "kN·m" : "kN"}
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
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#333",
  },
  modeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    padding: 16,
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
  },
  info: {
    fontSize: 14,
    marginBottom: 16,
    color: "#666",
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
