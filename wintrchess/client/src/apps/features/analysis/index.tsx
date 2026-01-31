import React, { lazy, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";

import { useAltcha } from "@/apps/features/analysis/hooks/useAltcha";
import { removeDefaultConsentLink } from "@/lib/consent";

import * as styles from "./index.module.css";

const Analysis = lazy(() => import("./pages/Analysis"));

import "@/i18n";
import "@/index.css";

const root = ReactDOM.createRoot(
    document.querySelector(".root")!
);

const queryClient = new QueryClient();

function App() {
    const executeCaptcha = useAltcha();

    useEffect(() => {
        removeDefaultConsentLink();
        executeCaptcha();
    }, []);

    return <QueryClientProvider client={queryClient}>
        <BrowserRouter>
            <div className={styles.wrapper}>
                <Routes>
                    <Route path="/analysis" element={<Analysis/>} />
                    <Route path="*" element={<Analysis/>} />
                </Routes>
            </div>
            <ToastContainer />
        </BrowserRouter>
    </QueryClientProvider>;
}

root.render(<App/>);
