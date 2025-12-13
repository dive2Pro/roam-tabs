const CLASS_NAME = "roam-stack-last-edited-block";
const QUERY_SELECTOR = `.${CLASS_NAME}`;

const debounce = (fn: (...args: any[]) => void, delay = 300) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};

export function observeLastEditedBlock(
  section: HTMLElement,
  onBlockChange: (block: HTMLElement) => void,
  querySelector = QUERY_SELECTOR ,
) {
  if (!section) return;
  const handler = ((el: HTMLElement) => {
    section.querySelectorAll(querySelector).forEach((el) => {
      el.classList.remove(CLASS_NAME);
    });
    el.closest(".rm-block-main")?.classList.add(CLASS_NAME);
    onBlockChange(el as HTMLElement);
  });
  section.arrive("textarea", handler);
  return () => {
    section.unbindArrive("textarea", handler);
  };
}

// 分成三个变量，分别持有 roam-body-main 下最近编辑的 block id, 以及 sidebar 下最近编辑的 block id, 以及当前窗口的 block id
// 当有 textarea 进场，监听是否是 block 获得焦点， 获取 xpath
let unsub = () => {
  //
};
export function watchAllRoamSections() {
  unsub();
  let sidebarLastEditedBlockId = "";
  let mainViewLastEditedBlockId = "";
  const sidebar = document.querySelector("#right-sidebar") as HTMLElement;
  const unSubscribeSidebar = observeLastEditedBlock(
    sidebar,
    (block) => {
      sidebarLastEditedBlockId = block.id;
    },
    QUERY_SELECTOR
  );
  const mainView = document.querySelector(".roam-main") as HTMLElement;
  const unSubscribeMainView = observeLastEditedBlock(
    mainView,
    (block) => {
      if (!block.closest(".roam-body-main")) {
        return;
      }
      mainViewLastEditedBlockId = block.id;
    },
    `.roam-body-main ${QUERY_SELECTOR}`
  );
  const handler = (el: HTMLElement) => {
    const foundId = [sidebarLastEditedBlockId, mainViewLastEditedBlockId].find(
      (id) => {
        return el.id === id;
      }
    );
    if (foundId) {
      el.closest(".rm-block-main")?.classList.add(CLASS_NAME);
    }
  };
  document.arrive("div", handler);
  unsub = () => {
    document.unbindArrive("div", handler);
    unSubscribeSidebar();
    unSubscribeMainView();
  };
  return unsub;
}

export function unwatchAllRoamSections() {
  unsub();
}
