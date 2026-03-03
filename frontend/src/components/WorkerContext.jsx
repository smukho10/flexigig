import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "./UserContext";

const WorkerContext = createContext();
export const useWorker = () => useContext(WorkerContext);

export const WorkerProvider = ({ children }) => {
    const { user } = useUser();
    const [worker, setWorker] = useState(null);
    const [workerLoading, setWorkerLoading] = useState(true);

    useEffect(() => {
        if (!user || user.isbusiness) {
            setWorker(null);
            setWorkerLoading(false);
            return;
        }
        const fetchWorker = async () => {
            setWorkerLoading(true);
            try {
                const res = await fetch(`/api/worker/${user.id}`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    setWorker(data);
                }
            } catch (err) {
                console.error("Failed to fetch worker:", err);
            } finally {
                setWorkerLoading(false);
            }
        };

        fetchWorker();
    }, [user]);

    return <WorkerContext.Provider value={{ worker, setWorker, workerLoading }}>{children}</WorkerContext.Provider>;
};