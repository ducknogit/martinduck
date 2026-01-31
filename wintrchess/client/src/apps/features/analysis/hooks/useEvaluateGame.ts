import { useTranslation } from "react-i18next";

import AnalysedGame from "shared/types/game/AnalysedGame";
import { getNodeChain } from "shared/types/game/position/StateTreeNode";
import AnalysisStatus from "@analysis/constants/AnalysisStatus";
import useSettingsStore from "@/stores/SettingsStore";
import useAnalysisBoardStore from "@analysis/stores/AnalysisBoardStore";
import useAnalysisProgressStore from "@analysis/stores/AnalysisProgressStore";
import useAnalysisGameStore from "@analysis/stores/AnalysisGameStore";
import createGameEvaluator from "../lib/evaluate";
import useAnalyseGame from "./useAnalyseGame";

function useEvaluateGame() {
    const { t } = useTranslation("analysis");

    const settings = useSettingsStore(
        state => state.settings.analysis.engine
    );

    const dispatchCurrentNodeUpdate = useAnalysisBoardStore(
        state => state.dispatchCurrentNodeUpdate
    );

    const {
        setAnalysisStatus,
        setEvaluationProgress,
        setAnalysisError
    } = useAnalysisProgressStore();

    const { setAnalysisGame } = useAnalysisGameStore();
    const { setCurrentStateTreeNode } = useAnalysisBoardStore();

    const analyseGame = useAnalyseGame();

    async function evaluateGame(analysisGame: AnalysedGame) {
        setAnalysisStatus(AnalysisStatus.EVALUATING);

        // Reset analysis data to force re-evaluation (cache busting)
        const allNodes = getNodeChain(analysisGame.stateTree);
        for (const node of allNodes) {
            node.state.engineLines = [];
            node.state.evaluation = undefined;
            node.state.classification = undefined;
        }

        const evaluator = createGameEvaluator(analysisGame, {
            engineVersion: settings.version,
            engineDepth: settings.depth,
            engineTimeLimit: settings.timeLimitEnabled
                ? settings.timeLimit : undefined,
            cloudEngineLines: 0,
            maxEngineCount: 4,
            engineConfig: engine => engine.setLineCount(settings.lines),
            onProgress: progress => {
                setEvaluationProgress(progress);
                dispatchCurrentNodeUpdate();
            }
        });

        evaluator.evaluate()
            .then(async () => {
                // Persist updated tree/state before classification
                setAnalysisGame(analysisGame);
                setCurrentStateTreeNode(prev => prev); // trigger subscribers
                setAnalysisStatus(AnalysisStatus.INACTIVE);
                await analyseGame();
            })
            .catch(err => {
                if (err == "abort") return;

                console.error(err);
                setAnalysisError(t("analysisError"));
            });

        return evaluator.controller;
    }

    return evaluateGame;
}

export default useEvaluateGame;
