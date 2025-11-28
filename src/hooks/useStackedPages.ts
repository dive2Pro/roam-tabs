import { useState, useEffect, useRef, useCallback } from "react";

export interface StackedPage {
    id: string;
    element: HTMLElement;
    index: number;
}

export interface UseStackedPagesOptions<T = any> {
    containerRef: React.RefObject<HTMLElement>;
    pages: T[]; // External tabs/pages data, no URL listening
    getPageId: (page: T) => string; // Function to extract page ID from tab data
    onPageChange?: (pageId: string, page: T) => void; // Optional callback when most visible page changes
}

export interface UseStackedPagesReturn {
    stackedPages: StackedPage[];
    scrollToPage: (pageId: string) => void;
    getVisibleWidth: (pageId: string) => number;
}

/**
 * Hook for managing stacked pages navigation
 * Inspired by react-stacked-pages-hook from gatsby-digital-garden
 * @see https://github.com/mathieudutour/gatsby-digital-garden/tree/master/packages/react-stacked-pages-hook
 * 
 * This hook does NOT listen to URL changes. Pages/tabs are provided externally.
 */
export function useStackedPages<T = any>(
    options: UseStackedPagesOptions<T>
): UseStackedPagesReturn {
    const { containerRef, pages, getPageId, onPageChange } = options;
    const [stackedPages, setStackedPages] = useState<StackedPage[]>([]);
    const [visibleWidths, setVisibleWidths] = useState<Record<string, number>>(
        {}
    );
    const observerRef = useRef<IntersectionObserver | null>(null);

    console.log("[useStackedPages] Initialized with pages:", pages.length);

    // Use refs to store callbacks to avoid dependency issues
    const onPageChangeRef = useRef(onPageChange);
    const getPageIdRef = useRef(getPageId);
    const pagesRef = useRef(pages);

    // Update refs when props change
    useEffect(() => {
        console.log("[useStackedPages] Pages updated:", pages.length);
        onPageChangeRef.current = onPageChange;
        getPageIdRef.current = getPageId;
        pagesRef.current = pages;
    }, [onPageChange, getPageId, pages]);

    // Update stacked pages when pages change (from external source)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateStackedPages = () => {
            const currentPages = pagesRef.current;
            const currentGetPageId = getPageIdRef.current;
            const newStackedPages: StackedPage[] = currentPages.map((page, index) => {
                const pageId = currentGetPageId(page);
                const element = container.querySelector(
                    `[data-page-id="${pageId}"]`
                ) as HTMLElement;
                const found = !!element;
                if (!found) {
                    console.warn(`[useStackedPages] Page element not found for ID: ${pageId}`);
                }
                return {
                    id: pageId,
                    element: element || ({} as HTMLElement),
                    index,
                };
            });
            const foundCount = newStackedPages.filter(p => p.element && p.element.getBoundingClientRect).length;
            console.log(`[useStackedPages] Updated stacked pages: ${foundCount}/${newStackedPages.length} elements found`);
            setStackedPages(newStackedPages);
        };

        updateStackedPages();

        // Use MutationObserver to watch for DOM changes
        const observer = new MutationObserver(updateStackedPages);
        observer.observe(container, {
            childList: true,
            subtree: true,
        });

        return () => {
            observer.disconnect();
        };
    }, [containerRef]); // Only depend on containerRef, pages are accessed via ref

    // Calculate visible widths and handle scroll
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateVisibleWidths = () => {
            const containerRect = container.getBoundingClientRect();
            const widths: Record<string, number> = {};

            console.log(`[useStackedPages] Updating visible widths, container:`, {
                width: containerRect.width,
                left: containerRect.left,
                right: containerRect.right,
                stackedPagesCount: stackedPages.length
            });

            stackedPages.forEach((page) => {
                if (!page.element || !page.element.getBoundingClientRect) {
                    console.warn(`[useStackedPages] Page ${page.id} has no valid element`);
                    return;
                }

                const pageRect = page.element.getBoundingClientRect();

                // Calculate visible width: how much of the page is visible in the container
                // The page's left edge relative to container's left edge
                const pageLeftRelativeToContainer = pageRect.left - containerRect.left;
                // The page's right edge relative to container's left edge
                const pageRightRelativeToContainer = pageRect.right - containerRect.left;

                // Visible portion: from max(0, pageLeft) to min(containerWidth, pageRight)
                const visibleStart = Math.max(0, pageLeftRelativeToContainer);
                const visibleEnd = Math.min(containerRect.width, pageRightRelativeToContainer);
                const visibleWidth = Math.max(0, visibleEnd - visibleStart);

                widths[page.id] = visibleWidth;

                console.log(`[useStackedPages] Page ${page.id}:`, {
                    pageWidth: pageRect.width,
                    pageLeft: pageRect.left,
                    pageLeftRelativeToContainer,
                    pageRightRelativeToContainer,
                    containerWidth: containerRect.width,
                    visibleWidth,
                    visibleStart,
                    visibleEnd,
                    scrollLeft: container.scrollLeft
                });
            });

            console.log(`[useStackedPages] Visible widths:`, widths);
            setVisibleWidths(widths);

            // Find the most visible page and call onPageChange
            const currentOnPageChange = onPageChangeRef.current;
            if (currentOnPageChange && Object.keys(widths).length > 0) {
                const mostVisiblePage = Object.entries(widths).reduce((a, b) =>
                    a[1] > b[1] ? a : b
                );
                const threshold = containerRect.width * 0.5;
                console.log(`[useStackedPages] Most visible page: ${mostVisiblePage[0]} (${mostVisiblePage[1]}px), threshold: ${threshold}px`);
                if (mostVisiblePage[1] > threshold) {
                    const currentPages = pagesRef.current;
                    const currentGetPageId = getPageIdRef.current;
                    const page = currentPages.find((p) => currentGetPageId(p) === mostVisiblePage[0]);
                    if (page) {
                        console.log(`[useStackedPages] Calling onPageChange for: ${mostVisiblePage[0]}`);
                        currentOnPageChange(mostVisiblePage[0], page);
                    }
                }
            }
        };

        updateVisibleWidths();

        // Use IntersectionObserver for better performance
        if (stackedPages.length > 0) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    updateVisibleWidths();
                },
                {
                    root: container,
                    rootMargin: "0px",
                    threshold: [0, 0.1, 0.5, 1.0],
                }
            );

            stackedPages.forEach((page) => {
                if (page.element && observerRef.current) {
                    observerRef.current.observe(page.element);
                }
            });
        }

        container.addEventListener("scroll", updateVisibleWidths, {
            passive: true,
        });
        window.addEventListener("resize", updateVisibleWidths);

        return () => {
            container.removeEventListener("scroll", updateVisibleWidths);
            window.removeEventListener("resize", updateVisibleWidths);
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [containerRef, stackedPages]); // Removed onPageChange, pages, getPageId from deps - using refs instead

    const scrollToPage = useCallback(
        (pageId: string) => {
            const container = containerRef.current;
            if (!container) {
                console.warn(`[useStackedPages] scrollToPage: container not found`);
                return;
            }

            const page = stackedPages.find((p) => p.id === pageId);
            if (page && page.element) {
                console.log(`[useStackedPages] Scrolling to page: ${pageId}`);
                page.element.scrollIntoView({
                    behavior: "auto", // No animation
                    block: "nearest",
                    inline: "start",
                });
            } else {
                console.warn(`[useStackedPages] scrollToPage: page ${pageId} not found or has no element`);
            }
        },
        [containerRef, stackedPages]
    );

    const getVisibleWidth = useCallback(
        (pageId: string) => {
            return visibleWidths[pageId] ?? 0;
        },
        [visibleWidths]
    );

    return {
        stackedPages,
        scrollToPage,
        getVisibleWidth,
    };
}

