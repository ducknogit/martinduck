import { useEffect } from "react";

type GTagFunction = (...args: any[]) => void;

const googleTagURL = "https://www.googletagmanager.com/gtag/js?id=";
const measurementId = process.env.ANALYTICS_MEASUREMENT_ID;

function useAnalyticsTag() {
    if (!measurementId) return;

    useEffect(() => {
        const script = document.createElement("script");
        script.src = googleTagURL + measurementId;
        script.async = true;
        document.head.appendChild(script);

        window.dataLayer ??= [];

        const gtag: GTagFunction = function() {
            window.dataLayer.push(arguments);
        };

        gtag("js", new Date());
        gtag("config", measurementId);
    }, []);
}

export default useAnalyticsTag;