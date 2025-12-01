import React, { useEffect, useState, useCallback } from "react";
import { MultiSelect } from "@blueprintjs/select";
import { MenuItem } from "@blueprintjs/core";

interface PageOption {
  label: string;
  value: string;
}

// 防抖函数
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function (...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export function ClientConfig({
  selected,
  onSave,
}: {
  selected: PageOption[];
  onSave: (tabs: PageOption[]) => void;
}) {
  const [selectedPages, setSelectedPages] = useState<PageOption[]>(selected);
  const [allPages, setAllPages] = useState<PageOption[]>([]);
  const [filteredPages, setFilteredPages] = useState<PageOption[]>([]);
  useEffect(() => {
    // @ts-ignore
    window.roamAlphaAPI.data.async.fast
      .q(
        `
        [:find [(pull ?b [:block/uid :node/title]) ...]
        :where
            [?b :node/title ?title]
            [(not-empty ?title)]
        ]
        `
      )
      .then((res: any) => {
        const pages = res.map((item: any) => ({
          label: item[":node/title"],
          value: item[":block/uid"],
        }));
        // setAllPages(pages);
        //   setFilteredPages(pages);
      });
  }, []);

  // 防抖查询函数
  const debouncedQuery = useCallback(
    debounce((query: string) => {
      //   setQuery(query);
      if (!query) {
        setFilteredPages([]);
        return;
      }

      // @ts-ignore
      window.roamAlphaAPI.data.async.fast
        .q(
          `
        [:find [(pull ?b [:block/uid :node/title]) ...]
        :where
            [?b :node/title ?title]
            [(clojure.string/includes?  ?title "${query}")]
        ]
        `
        )
        .then((res: any) => {
          const pages = res.map((item: any) => ({
            label: item[":node/title"],
            value: item[":block/uid"],
          }));
          setFilteredPages(pages);
        })
        .catch((error: any) => {
          console.error("Error querying pages:", error);
          setFilteredPages([]);
        });
    }, 300),
    [allPages]
  );

  const handleItemSelect = (item: PageOption) => {
    if (!selectedPages.some((page) => page.value === item.value)) {
      const r = [...selectedPages, item];
      setSelectedPages(r);
      onSave(r);
    } else {
      const r = selectedPages.filter((page) => page.value !== item.value);
      setSelectedPages(r);
      onSave(r);
    }
  };

  const handleRemove = (item: string) => {
    const newSelectedPages = selectedPages.filter(
      (page) => page.label !== item
    );
    setSelectedPages(newSelectedPages);
    onSave(newSelectedPages);
  };

  const handleClear = () => {
    setSelectedPages([]);
  };

  return (
    <section className="bp3-dark">
      <MultiSelect<PageOption>
        items={filteredPages}
        selectedItems={selectedPages}
        itemPredicate={() => true} // 我们自己处理过滤
        itemRenderer={(item, { handleClick, modifiers, query }) => {
          const isItemSelected = selectedPages.some(
            (page) => page.value === item.value
          );
          return (
            <MenuItem
              active={modifiers.active}
              icon={isItemSelected ? "tick" : "blank"}
              key={item.value}
              onClick={handleClick}
              text={item.label}
              shouldDismissPopover={false}
            />
          );
        }}
        onItemSelect={handleItemSelect}
        tagRenderer={(item) => item.label}
        onQueryChange={(query) => {
          debouncedQuery(query);
        }}
        tagInputProps={{
          onRemove: handleRemove,

          rightElement:
            selectedPages.length > 0 ? (
              <button
                className="bp3-button bp3-minimal bp3-icon-cross"
                onClick={handleClear}
                aria-label="Clear selection"
              />
            ) : undefined,
          placeholder: "Select pages...",
        }}
        placeholder="Select pages..."
        noResults={<MenuItem disabled text="No results." />}
        resetOnSelect={true}
      />
    </section>
  );
}
