import React, { useState } from "react";
import useGameLoader from "@analysis/hooks/useGameLoader";
import AnalysisPanel from "@analysis/components/AnalysisPanel";

import BoardArea from "./BoardArea";
import * as styles from "./Analysis.module.css";

function Analysis() {
    useGameLoader();
    const [boardHeight, setBoardHeight] = useState<number>();

    return <div className={styles.wrapper}>
        <header className={styles.hero}>
            <div className={styles.heroTitle}>Martin Duck Analysis Game</div>
            <div className={styles.heroSubtitle}>
                base on https://github.com/WintrCat/wintrchess
            </div>
        </header>

        <div className={styles.analysisSection}>
            <BoardArea onResize={h => setBoardHeight(h)} />

            <AnalysisPanel
                className={styles.panel}
                style={boardHeight ? { height: boardHeight } : undefined}
            />
        </div>
    </div>;
}

export default Analysis;
