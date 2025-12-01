import { useCallback, useLayoutEffect, useRef } from "react";

export function useEvent(handler: Function) {
    const handlerRef = useRef(handler);

    useLayoutEffect(() => {
        handlerRef.current = handler;
    });

    return useCallback((...args: any[]) => {
        const fn = handlerRef.current;
        if (fn) {
            return fn(...args);
        }
    }, []);
}