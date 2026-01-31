import { useTranslation } from "react-i18next";
import { solveChallenge } from "altcha-lib";
import { Challenge } from "altcha-lib/types";

import useAnalysisSessionStore from "@analysis/stores/AnalysisSessionStore";

export function useAltcha() {
    const { t } = useTranslation("analysis");

    const {
        setAnalysisSessionToken,
        setAnalysisCaptchaError
    } = useAnalysisSessionStore();

    // Local deployment: bypass captcha + session negotiation.
    function execute() {
        setAnalysisSessionToken("local-session");
        setAnalysisCaptchaError(undefined);
        return Promise.resolve();
    }

    return execute;
}
