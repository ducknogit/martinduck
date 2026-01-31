import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Options as HotkeyOptions, useHotkeys } from "react-hotkeys-hook";

import { getNodeChain } from "shared/types/game/position/StateTreeNode";
import useAnalysisGameStore from "@analysis/stores/AnalysisGameStore";
import useAnalysisBoardStore from "@analysis/stores/AnalysisBoardStore";
import playBoardSound from "@/lib/boardSounds";

import StateTreeTraverserProps from "./StateTreeTraverserProps";
import * as styles from "./StateTreeTraverser.module.css";

const IconStart = () => (
    <span className="cc-btn">
        <svg aria-hidden="true" className="rtl-support" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M6.07001 22H5.94001C4.34001 22 4.01001 21.67 4.01001 20.07V3.94C4.01001 2.34 4.34001 2.01 5.94001 2.01H6.07001C7.67001 2.01 8.00001 2.34 8.00001 3.94V20.07C8.00001 21.67 7.67001 22 6.07001 22ZM19.93 21.13L19.86 21.2C18.73 22.33 18.26 22.33 17.13 21.2L10.73 14.83C9.00001 13.06 9.00001 10.93 10.73 9.16L17.13 2.79C18.26 1.66 18.73 1.66 19.86 2.79L19.93 2.86C21.06 3.99 21.06 4.46 19.93 5.59L13.56 11.99L19.93 18.39C21.06 19.52 21.06 19.99 19.93 21.12V21.13Z"></path></svg>
    </span>
);

const IconBack = () => (
    <span className="cc-btn">
        <svg aria-hidden="true" className="rtl-support" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M16.27 21.13L16.2 21.2C15.07 22.33 14.6 22.33 13.47 21.2L7.06996 14.83C5.33996 13.06 5.33996 10.93 7.06996 9.16L13.47 2.79C14.6 1.66 15.07 1.66 16.2 2.79L16.27 2.86C17.4 3.99 17.4 4.46 16.27 5.59L9.89996 11.99L16.27 18.39C17.4 19.52 17.4 19.99 16.27 21.12V21.13Z"></path></svg>
    </span>
);

const IconPlay = () => (
    <span className="cc-btn">
        <svg aria-hidden="true" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M20.5 12.8L7.77 21.53C6.5 22.43 6 22.16 6 20.6V3.32999C6 1.79999 6.5 1.52999 7.77 2.42999L20.5 11.2C21.33 11.77 21.33 12.23 20.5 12.8Z"></path></svg>
    </span>
);

const IconPause = () => (
    <span className="cc-btn">
        <svg aria-hidden="true" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h4v18H6zM14 3h4v18h-4z"></path></svg>
    </span>
);

const IconNext = () => (
    <span className="cc-btn">
        <svg aria-hidden="true" className="rtl-support" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7.73007 2.87L7.80007 2.8C8.93007 1.67 9.40007 1.67 10.5301 2.8L16.9301 9.17C18.6601 10.94 18.6601 13.07 16.9301 14.84L10.5301 21.21C9.40007 22.34 8.93007 22.34 7.80007 21.21L7.73007 21.14C6.60007 20.01 6.60007 19.54 7.73007 18.41L14.1001 12.01L7.73007 5.61C6.60007 4.48 6.60007 4.01 7.73007 2.88V2.87Z"></path></svg>
    </span>
);

const IconEnd = () => (
    <span className="cc-btn">
        <svg aria-hidden="true" className="rtl-support" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M17.9299 2H18.0599C19.6599 2 19.9899 2.33 19.9899 3.93V20.06C19.9899 21.66 19.6599 21.99 18.0599 21.99H17.9299C16.3299 21.99 15.9999 21.66 15.9999 20.06V3.93C15.9999 2.33 16.3299 2 17.9299 2ZM4.06991 2.87L4.13991 2.8C5.26991 1.67 5.73991 1.67 6.86991 2.8L13.2699 9.17C14.9999 10.94 14.9999 13.07 13.2699 14.84L6.86991 21.21C5.73991 22.34 5.26991 22.34 4.13991 21.21L4.06991 21.14C2.93991 20.01 2.93991 19.54 4.06991 18.41L10.4399 12.01L4.06991 5.61C2.93991 4.48 2.93991 4.01 4.06991 2.88V2.87Z"></path></svg>
    </span>
);

type Interval = ReturnType<typeof setInterval>;

const hotkeyConfig: HotkeyOptions = { preventDefault: true };

function StateTreeTraverser({ className, style }: StateTreeTraverserProps) {
    const { t } = useTranslation("analysis");

    const { analysisGame } = useAnalysisGameStore();

    const {
        currentStateTreeNode,
        setCurrentStateTreeNode,
        autoplayEnabled,
        setAutoplayEnabled
    } = useAnalysisBoardStore();

    const autoplayIntervalRef = useRef<Interval>();

    useEffect(() => {
        if (autoplayEnabled) {
            traverseForwards();

            autoplayIntervalRef.current = setInterval(traverseForwards, 1000);
        } else {
            clearInterval(autoplayIntervalRef.current);
        }
    }, [autoplayEnabled]);

    function traverseToBeginning() {
        setCurrentStateTreeNode(analysisGame.stateTree);
        setAutoplayEnabled(false);
    }

    function traverseToEnd() {
        const finalNode = getNodeChain(analysisGame.stateTree).at(-1)
            || analysisGame.stateTree;

        setCurrentStateTreeNode(finalNode);
        playBoardSound(finalNode);
        setAutoplayEnabled(false);
    }

    function traverseBackwards() {
        if (!currentStateTreeNode.parent) return;

        setCurrentStateTreeNode(currentStateTreeNode.parent);
        playBoardSound(currentStateTreeNode);
        setAutoplayEnabled(false);
    }

    function traverseForwards() {
        setCurrentStateTreeNode(currentNode => {
            const priorityChild = currentNode.children.at(0);

            if (priorityChild) {
                playBoardSound(priorityChild);

                return priorityChild;
            } else {
                setAutoplayEnabled(false);

                return currentNode;
            }
        });
    }

    useHotkeys("up, shift+left", traverseToBeginning, hotkeyConfig);
    useHotkeys("down, shift+right", traverseToEnd, hotkeyConfig);
    useHotkeys("left", traverseBackwards, hotkeyConfig);
    useHotkeys("right", traverseForwards, hotkeyConfig);

    return <div className={`${styles.wrapper} ${className}`} style={style}>
        <button className={styles.btn} onClick={traverseToBeginning} title={t("stateTreeTraverser.beginning")}>
            <IconStart />
        </button>
        <button className={styles.btn} onClick={traverseBackwards} title={t("stateTreeTraverser.back")}>
            <IconBack />
        </button>
        <button
            className={styles.btn}
            onClick={() => setAutoplayEnabled(!autoplayEnabled)}
            title={autoplayEnabled
                ? t("stateTreeTraverser.pause")
                : t("stateTreeTraverser.play")
            }
        >
            {autoplayEnabled ? <IconPause /> : <IconPlay />}
        </button>
        <button className={styles.btn} onClick={traverseForwards} title={t("stateTreeTraverser.next")}>
            <IconNext />
        </button>
        <button className={styles.btn} onClick={traverseToEnd} title={t("stateTreeTraverser.end")}>
            <IconEnd />
        </button>
    </div>;
}

export default StateTreeTraverser;
