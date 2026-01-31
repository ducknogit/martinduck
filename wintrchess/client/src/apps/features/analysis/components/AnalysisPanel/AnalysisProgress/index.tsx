import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

import AnalysisStatus from "@analysis/constants/AnalysisStatus";
import useAnalysisProgressStore from "@analysis/stores/AnalysisProgressStore";
import useAnalysisSessionStore from "@analysis/stores/AnalysisSessionStore";
import ProgressReporter from "@/components/common/ProgressReporter";

import useAnalyseGame from "@analysis/hooks/useAnalyseGame";

function getStatusTitle(status: AnalysisStatus) {
    const statusTitles: Record<string, string | undefined> = {
        [AnalysisStatus.EVALUATING]: "progressReporter.evaluating",
        [AnalysisStatus.AWAITING_CAPTCHA]: "progressReporter.awaitingCaptcha"
    };

    return statusTitles[status];
}

function AnalysisProgress() {
    const { t } = useTranslation("analysis");

    const {
        evaluationProgress,
        analysisStatus,
        analysisError,
        setAnalysisError,
        setAnalysisStatus
    } = useAnalysisProgressStore();

    const {
        analysisSessionToken,
        analysisCaptchaError
    } = useAnalysisSessionStore();

    const analyseGame = useAnalyseGame();

    // Tab notification for complete analysis
    useEffect(() => {
        if (analysisStatus != AnalysisStatus.AWAITING_CAPTCHA) return;

        if (!document.hasFocus()) {
            document.title = t("progressReporter.completeNotification");
        }

        function focusListener() {
            document.title = "WintrChess";
            removeEventListener("focus", focusListener);
        }

        addEventListener("focus", focusListener);
    }, [analysisStatus]);

    // Attempt to classify generated evaluations
    useEffect(() => {
        if (analysisStatus != AnalysisStatus.AWAITING_CAPTCHA) return;

        if (analysisCaptchaError) {
            return setAnalysisError(analysisCaptchaError);
        }

        analyseGame();
    }, [
        analysisSessionToken,
        analysisStatus,
        analysisCaptchaError
    ]);

    // Local mode: ignore CAPTCHA state completely
    useEffect(() => {
        if (analysisStatus == AnalysisStatus.AWAITING_CAPTCHA) {
            setAnalysisStatus(AnalysisStatus.INACTIVE);
        }
    }, [analysisStatus, setAnalysisStatus]);

    const statusTitle = getStatusTitle(analysisStatus);

    if (
        analysisStatus == AnalysisStatus.INACTIVE
        || analysisStatus == AnalysisStatus.AWAITING_CAPTCHA
    ) return null;

    return <ProgressReporter
        progress={evaluationProgress}
        title={statusTitle ? t(statusTitle) : undefined}
        tooltip={analysisStatus == AnalysisStatus.EVALUATING
            ? t("progressReporter.evaluatingTooltip")
            : undefined
        }
        error={analysisError}
    />;
}

export default AnalysisProgress;
