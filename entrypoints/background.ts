async function configureSidePanelAction() {
  if (!browser.sidePanel?.setPanelBehavior) {
    return;
  }

  await browser.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true,
  });
}

export default defineBackground(() => {
  void configureSidePanelAction();

  browser.runtime.onInstalled.addListener(() => {
    void configureSidePanelAction();
  });
});
