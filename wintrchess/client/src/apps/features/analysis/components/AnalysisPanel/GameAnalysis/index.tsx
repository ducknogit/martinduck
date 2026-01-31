import React from "react";

import useAnalysisBoardStore from "@analysis/stores/AnalysisBoardStore";
import useAnalysisGameStore from "@analysis/stores/AnalysisGameStore";
import StateTreeEditor from "@/components/chess/StateTreeEditor";
import playBoardSound from "@/lib/boardSounds";
import EvaluationGraphArea from "../GameReport/EvaluationGraphArea";

import * as styles from "./GameAnalysis.module.css";

function GameAnalysis() {
    const { analysisGame } = useAnalysisGameStore();

    const {
        currentStateTreeNode,
        setCurrentStateTreeNode,
        setAutoplayEnabled
    } = useAnalysisBoardStore();
    
    return <div className={styles.analysisPane}>
        <div className={styles.moveBox}>
            <StateTreeEditor
                className={styles.stateTreeEditor}
                stateTreeRootNode={analysisGame.stateTree}
                onMoveClick={node => {
                    setCurrentStateTreeNode(node);
                
                    if (node != currentStateTreeNode) {
                        playBoardSound(node);
                    }

                    setAutoplayEnabled(false);
                }}
            />
        </div>

        <EvaluationGraphArea />
    </div>;
}

export default GameAnalysis;
