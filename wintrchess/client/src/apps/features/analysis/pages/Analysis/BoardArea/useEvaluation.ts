import { useEffect, useState } from "react";

import { defaultEvaluation } from "shared/constants/utils";
import { getTopEngineLine } from "shared/types/game/position/EngineLine";
import useAnalysisGameStore from "@analysis/stores/AnalysisGameStore";
import useAnalysisBoardStore from "@analysis/stores/AnalysisBoardStore";
import useRealtimeEngineStore from "@analysis/stores/RealtimeEngineStore";
import useSettingsStore from "@/stores/SettingsStore";

function useEvaluation() {
    const engineEnabled = useSettingsStore(
        state => state.settings.analysis.engine.enabled
    );

    const gameAnalysisOpen = useAnalysisGameStore(
        state => state.gameAnalysisOpen
    );

    const currentNode = useAnalysisBoardStore(
        state => state.currentStateTreeNode
    );

    const { displayedEngineLines } = useRealtimeEngineStore();

    const [evaluation, setEvaluation] = useState(defaultEvaluation);

    useEffect(() => {
        // Priority 1: Realtime engine evaluation (if enabled)
        if (engineEnabled) {
            const realtimeEval = displayedEngineLines.at(0)?.evaluation;
            if (realtimeEval) {
                return setEvaluation(realtimeEval);
            }
        }

        // Priority 2: Analysis evaluation from node data
        const analysisEval = getTopEngineLine(currentNode?.state.engineLines || [])?.evaluation;
        if (analysisEval) {
            return setEvaluation(analysisEval);
        }

        // Priority 3: Default (only if no analysis open)
        if (!gameAnalysisOpen) setEvaluation(defaultEvaluation);
    }, [displayedEngineLines, currentNode, engineEnabled, gameAnalysisOpen]);

    // Always return evaluation (show analysis data even when realtime engine is off)
    return evaluation;
}

export default useEvaluation;